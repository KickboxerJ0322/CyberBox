import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { DemoLabManager } from '../src/demoManager.js';

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
  });
});
