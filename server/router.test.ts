import { describe, expect, it } from 'vitest';
import { RouterService } from './router';

describe('9Router cockpit', () => {
  it('discovers models without trusting free badges or exposing credentials', async () => {
    const service = new RouterService({ HABBLAUD_9ROUTER_URL: 'http://127.0.0.1:20128' }, async () => new Response(JSON.stringify({ data: [{ id: 'glm-5.3-flash-free', free: true, supportsTools: true }] }), { status: 200 }), () => 1_700_000_000_000);
    const catalog = await service.refresh(true);
    expect(catalog).toMatchObject({ health: 'ok', quotaState: 'unknown', baseUrl: 'http://127.0.0.1:20128' });
    expect(catalog.models[0]).toMatchObject({ providerId: '9router', modelId: 'glm-5.3-flash-free', costClass: 'unknown', quotaState: 'unknown', supportsTools: true });
    expect(JSON.stringify(catalog)).not.toMatch(/apiKey|token|secret|cookie/i);
  });

  it('fails closed for a non-loopback URL', async () => {
    const service = new RouterService({ HABBLAUD_9ROUTER_URL: 'https://router.example' }, async () => { throw new Error('must not call'); });
    expect((await service.refresh(true)).health).toBe('unavailable');
  });

  it('reads nested tool capability and blocks unverified models for work roles', async () => {
    const service = new RouterService({ HABBLAUD_9ROUTER_URL: 'http://127.0.0.1:20128' }, async () => new Response(JSON.stringify({ data: [
      { id: 'ag/gemini-3.8-flash-high', capabilities: { tools: true } },
      { id: 'ag/unknown-tools' },
    ] }), { status: 200 }));
    expect((await service.select('ag/gemini-3.8-flash-high', 'balanced-code', 'worker')).modelId).toBe('ag/gemini-3.8-flash-high');
    await expect(service.select('ag/unknown-tools', 'balanced-code', 'worker')).rejects.toThrow(/capability tools/);
  });

  it('auto route never selects a bare combo id', async () => {
    const service = new RouterService({ HABBLAUD_9ROUTER_URL: 'http://127.0.0.1:20128' }, async () => new Response(JSON.stringify({ data: [
      { id: 'gpt-6-astra', capabilities: { tools: true } },
      { id: 'ag/gemini-3.8-flash-high', capabilities: { tools: true } },
    ] }), { status: 200 }));
    expect((await service.select(undefined, 'balanced-code', 'worker')).modelId).toBe('ag/gemini-3.8-flash-high');
  });
});
