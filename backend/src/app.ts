import http from 'node:http';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import { WebSocketServer } from 'ws';
import { config } from './config.js';
import { lessons } from './lessons.js';
import { explain } from './gemini.js';
import { logger } from './logger.js';
import type { LabManager, LabSession } from './types.js';

const idPattern = /^[0-9a-f-]{36}$/;

export function createApp(manager: LabManager) {
  const app = express();
  app.disable('x-powered-by');
  app.use(pinoHttp({ logger }));
  app.use(helmet({ contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'], imgSrc: ["'self'", 'data:', 'blob:'], frameSrc: ["'self'"],
    connectSrc: ["'self'", 'ws:', 'wss:'],
  } } }));
  app.use(cors({ origin: false }));
  app.use(express.json({ limit: '24kb' }));
  app.use('/api', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false }));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/api/ai/status', (_req, res) => res.json({ configured: Boolean(config.GEMINI_API_KEY), model: config.GEMINI_MODEL }));

  app.post('/api/labs', rateLimit({ windowMs: 60_000, limit: 5 }), async (_req, res, next) => {
    try { res.status(201).json(publicSession(await manager.start())); } catch (error) { next(error); }
  });

  app.get('/api/labs/:id/target-status', async (req, res, next) => {
    try {
      const session = validSession(manager, req.params.id);
      const target = manager.target(session.sessionId);
      const ready = target ? await isTargetReady(target) : false;
      res.setHeader('Cache-Control', 'no-store');
      res.json({ ready, state: ready ? 'ready' : 'starting' });
    } catch (error) { next(error); }
  });

  app.get('/api/labs/:id', (req, res) => {
    const session = validSession(manager, req.params.id);
    res.json(publicSession(session));
  });

  app.delete('/api/labs/:id', async (req, res, next) => {
    try {
      const id = req.params.id;
      if (typeof id !== 'string' || !idPattern.test(id) || !manager.get(id)) return res.status(404).json({ error: 'ラボが見つかりません。' });
      await manager.stop(id);
      res.json({ ok: true });
    } catch (error) { next(error); }
  });

  app.post('/api/labs/:id/explain', rateLimit({ windowMs: 60_000, limit: 10 }), async (req, res, next) => {
    try {
      validSession(manager, req.params.id);
      const lessonId = Number(req.body.lessonId);
      const lesson = lessons.find((candidate) => candidate.id === lessonId);
      if (!lesson) return res.status(400).json({ error: 'レッスンが正しくありません。' });
      const command = typeof req.body.command === 'string' ? req.body.command.slice(0, 300) : '';
      const output = typeof req.body.output === 'string' ? stripAnsi(req.body.output).slice(-8000) : '';
      if (!command) return res.status(400).json({ error: '解説するコマンドがありません。' });
      res.json(await explain({ lesson: lesson.title, description: lesson.description, command, output }));
    } catch (error) { next(error); }
  });

  app.use('/lab/:id/target', async (req, res, next) => {
    try {
      const session = validSession(manager, req.params.id);
      const target = manager.target(session.sessionId);
      if (!target) return targetStartingPage(res);
      if (target.host === 'demo') return demoTarget(res);
      proxyTarget(req, res, target);
    } catch (error) { next(error); }
  });

  app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ error }, 'request failed');
    const notFound = error.message === 'Session not found';
    res.status(notFound ? 404 : 503).json({ error: notFound ? 'ラボが見つかりません。' : error.message || 'サーバーエラーが発生しました。' });
  });
  return app;
}

export function attachTerminal(server: http.Server, manager: LabManager) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url ?? '', 'http://localhost');
    if (url.pathname !== '/ws/terminal') { socket.destroy(); return; }
    const id = url.searchParams.get('sessionId') ?? '';
    if (!idPattern.test(id) || !manager.get(id)) { socket.destroy(); return; }
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
  });
  wss.on('connection', async (ws, request) => {
    const id = new URL(request.url ?? '', 'http://localhost').searchParams.get('sessionId')!;
    try {
      const terminal = await manager.terminal(id);
      let command = '';
      terminal.onData((chunk) => { if (ws.readyState === ws.OPEN) ws.send(chunk); });
      terminal.onClose(() => ws.close());
      ws.on('message', (raw) => {
        const value = raw.toString();
        for (const character of value) {
          if (character === '\r') { if (command.trim()) logger.info({ sessionId: id, command: redact(command.trim()) }, 'command'); command = ''; }
          else if (character === '\x7f') command = command.slice(0, -1);
          else if (character >= ' ' && !character.startsWith('\x1b')) command += character;
        }
        terminal.write(raw as Buffer);
      });
      ws.on('close', () => terminal.close());
      ws.on('error', () => terminal.close());
    } catch { ws.close(1011, 'Terminal unavailable'); }
  });
  return wss;
}

function publicSession(session: LabSession) {
  return { sessionId: session.sessionId, createdAt: session.createdAt, expiresAt: session.expiresAt, status: session.status, demoMode: session.demoMode };
}

function validSession(manager: LabManager, id: string | string[] | undefined) {
  if (typeof id !== 'string' || !idPattern.test(id)) throw new Error('Session not found');
  const session = manager.get(id);
  if (!session) throw new Error('Session not found');
  return session;
}

function isTargetReady(target: { host: string; port: number }): Promise<boolean> {
  if (target.host === 'demo') return Promise.resolve(true);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ready: boolean) => { if (!settled) { settled = true; resolve(ready); } };
    const request = http.request({ hostname: target.host, port: target.port, path: '/', method: 'GET' }, (response) => {
      response.resume();
      finish((response.statusCode ?? 500) < 500);
      request.destroy();
    });
    request.setTimeout(2_000, () => { request.destroy(); finish(false); });
    request.on('error', () => finish(false));
    request.end();
  });
}

function redact(value: string) { return /(?:password|token|api[_-]?key|cookie)\s*[=:]/i.test(value) ? '[REDACTED]' : value.slice(0, 500); }
function stripAnsi(value: string) { return value.replace(/[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d\/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g, ''); }

function proxyTarget(req: Request, res: Response, target: { host: string; port: number }) {
  const prefix = `/lab/${req.params.id}/target`;
  const path = req.originalUrl.slice(prefix.length) || '/';
  const headers = { ...req.headers, host: `${target.host}:${target.port}` };
  delete headers['content-length'];
  const upstream = http.request({ hostname: target.host, port: target.port, path, method: req.method, headers }, (response) => {
    res.status(response.statusCode ?? 502);
    const html = response.headers['content-type']?.includes('text/html');
    for (const [key, value] of Object.entries(response.headers)) {
      if (value !== undefined && !['content-security-policy', 'x-frame-options', 'content-length'].includes(key)) res.setHeader(key, value);
    }
    if (html) {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => res.send(Buffer.concat(chunks).toString('utf8').replace(/<base href="\/">/i, `<base href="${prefix}/">`)));
    } else response.pipe(res);
  });
  upstream.setTimeout(15_000, () => upstream.destroy(new Error('Target timeout')));
  upstream.on('error', () => { if (!res.headersSent) targetStartingPage(res); });
  req.pipe(upstream);
}

function demoTarget(res: Response) {
  res.type('html').send('<!doctype html><html><head><style>body{margin:0;background:#fff;font-family:Arial;color:#333}.bar{height:64px;background:#546e7a;color:white;display:flex;align-items:center;padding:0 24px;font-size:21px}.main{text-align:center;padding:70px 20px}.card{max-width:520px;margin:20px auto;padding:24px;border:1px solid #ddd;border-radius:8px;box-shadow:0 4px 16px #0001}</style></head><body><div class="bar">OWASP Juice Shop <small style="margin-left:auto">CyberBox Demo</small></div><div class="main"><div class="card"><h2>Target Web is ready</h2><p>Docker環境では、ここに実際のOWASP Juice Shopが表示されます。</p></div></div></body></html>');
}

function targetStartingPage(res: Response) {
  res.status(503).type('html').setHeader('Retry-After', '3');
  res.send('<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta http-equiv="refresh" content="3"><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f7faf9;color:#334;font-family:sans-serif}.box{text-align:center;padding:32px}.spinner{width:28px;height:28px;margin:auto;border:3px solid #cce8df;border-top-color:#21ad88;border-radius:50%;animation:s 1s linear infinite}@keyframes s{to{transform:rotate(360deg)}}</style></head><body><div class="box"><div class="spinner"></div><h3>演習サイトを準備しています</h3><p>数秒後に自動で再確認します。</p></div></body></html>');
}
