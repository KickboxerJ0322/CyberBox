import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { DemoLabManager } from '../src/demoManager.js';
import type { LabManager, LabSession } from '../src/types.js';

const managers: DemoLabManager[] = [];
afterEach(async () => { await Promise.all(managers.map((manager) => manager.shutdown())); managers.length = 0; });
function setup() { const manager = new DemoLabManager(); managers.push(manager); return { manager, app: createApp(manager) }; }

describe('CyberBox API', () => {
  it('reports health and AI status', async () => {
    const { app } = setup();
    const health = await request(app).get('/api/health');
    expect(health.status).toBe(200);
    expect(health.body.status).toBe('ok');
    const ai = await request(app).get('/api/ai/status');
    expect(ai.status).toBe(200);
    expect(ai.body).toHaveProperty('configured');
    expect(ai.body).toHaveProperty('model');
  });

  it('starts, checks target readiness, and stops a lab', async () => {
    const { app } = setup();
    const start = await request(app).post('/api/labs');
    expect(start.status).toBe(201);
    const target = await request(app).get(`/api/labs/${start.body.sessionId}/target-status`);
    expect(target.status).toBe(200);
    expect(target.body).toEqual({ ready: true, state: 'ready' });
    const stop = await request(app).delete(`/api/labs/${start.body.sessionId}`);
    expect(stop.status).toBe(200);
  });

  it('returns a safe AI fallback', async () => {
    const { app } = setup();
    const start = await request(app).post('/api/labs');
    const response = await request(app).post(`/api/labs/${start.body.sessionId}/explain`).send({ lessonId: 3, command: 'nmap target', output: '3000/tcp open http' });
    expect(response.status).toBe(200);
    expect(response.body.details.length).toBeGreaterThan(0);
    expect(['gemini', 'fallback']).toContain(response.body.source);
    expect(response.body).toHaveProperty('model');
  });

  it('returns assistant commands with source and server-side safety status', async () => {
    const { app } = setup();
    const start = await request(app).post('/api/labs');
    const response = await request(app).post(`/api/labs/${start.body.sessionId}/assistant`).send({ lessonId: 6, message: 'ログインのSQLインジェクションを試したい' });
    expect(response.status).toBe(200);
    expect(['gemini', 'fallback']).toContain(response.body.source);
    expect(response.body.commands.length).toBeGreaterThan(0);
    expect(response.body.commands[0].safe).toBe(true);
  });

  it('removes conflicting proxy headers from target HTML', async () => {
    const upstream = http.createServer((_req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.write('<!doctype html><base href="/">');
      res.end('<p>Target ready</p>');
    });
    await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));
    const address = upstream.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not start');
    const id = '11111111-1111-4111-8111-111111111111';
    const session: LabSession = { sessionId: id, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(), status: 'running' };
    const manager: LabManager = {
      start: async () => session,
      stop: async () => undefined,
      get: (value) => value === id ? session : undefined,
      terminal: async () => { throw new Error('not used'); },
      target: () => ({ host: '127.0.0.1', port: address.port }),
      shutdown: async () => undefined,
    };
    try {
      const response = await request(createApp(manager)).get(`/lab/${id}/target/`);
      expect(response.status).toBe(200);
      expect(Boolean(response.headers['content-length'] && response.headers['transfer-encoding'])).toBe(false);
      expect(response.headers['content-security-policy']).toBeUndefined();
      expect(response.text).toContain(`<base href="/lab/${id}/target/">`);
    } finally {
      await new Promise<void>((resolve, reject) => upstream.close((error) => error ? reject(error) : resolve()));
    }
  });
});
