import { describe, expect, it } from 'vitest';
import { modelLabel, OpenCodeSource, statusOf } from './opencode';
import { project } from '../../shared/world/projection';

describe('OpenCode adapter normalization', () => {
  it('uses the reported provider/model identity', () => {
    expect(modelLabel({ id: 'ses_1', model: { providerID: '9router-local', modelID: 'ag/gemini-3.8-flash-high' } })).toBe('9router-local/ag/gemini-3.8-flash-high');
    expect(modelLabel({ id: 'ses_1', model: { providerID: '9router-local', id: 'ag/gemini-3.8-flash-high' } })).toBe('9router-local/ag/gemini-3.8-flash-high');
  });

  it('does not infer model from status or route names', () => {
    expect(modelLabel({ id: 'ses_1', status: 'busy' })).toBeUndefined();
  });

  it('rejects non-loopback OpenCode URLs before making requests', () => {
    const source = new OpenCodeSource({ office: {} as never, env: { HABBLAUD_OPENCODE_URL: 'https://remote.example' } });
    source.start();
    expect(source.sources()[0]).toMatchObject({ ok: false, path: 'tắt' });
  });

  it('maps permission and busy states without granting control', () => {
    expect(statusOf({ id: 'ses_1' }, { ses_1: 'permission' })).toEqual({ status: 'waiting', waitingFor: 'OpenCode cần bạn' });
    expect(statusOf({ id: 'ses_1' }, { ses_1: 'busy' })).toEqual({ status: 'working' });
    expect(statusOf({ id: 'ses_1' }, {})).toEqual({ status: 'idle' });
  });

  it('does not project historical idle sessions as active office agents', () => {
    expect(statusOf({ id: 'old-session' }, {})).toEqual({ status: 'idle' });
  });

  it('projects a live session and optional 9Router catalog without control calls', async () => {
    const calls: string[] = [];
    const added: Array<Record<string, unknown>> = [];
    const office = {
      beginBoot: () => undefined,
      endBoot: () => undefined,
      addMain: (input: Record<string, unknown>) => added.push(input),
      applyTranscript: () => undefined,
      addActivity: () => undefined,
      setStatus: () => undefined,
      closeMain: () => undefined,
    } as never;
    const response = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 404, json: async () => body }) as Response;
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith('/session')) return response([{ id: 'ses_1', directory: 'C:/demo', title: 'Build', model: { providerID: '9router-local', modelID: 'deepseek-v4.1-flash-free' } }]);
      if (url.endsWith('/session/status')) return response({ ses_1: 'busy' });
      if (url.endsWith('/v1/models')) return response({ data: [{ id: 'opencode/deepseek-v4.1-flash-free' }] });
      return response({}, false);
    };
    const source = new OpenCodeSource({ office, env: { HABBLAUD_OPENCODE_URL: 'http://127.0.0.1:4096', HABBLAUD_9ROUTER_URL: 'http://127.0.0.1:20128' }, fetchImpl, pollMs: 10 });
    source.start();
    await new Promise((resolve) => setTimeout(resolve, 100));
    source.stop();
    expect(added[0]).toMatchObject({ provider: 'claude', engine: 'opencode', sessionId: 'ses_1', status: 'working' });
    expect(source.sources()[0]).toMatchObject({ ok: true, sessions: 1 });
    expect(calls.some((url) => url.endsWith('/v1/models'))).toBe(true);
    const projected = project({ rooms: [{ id: 'C:/demo' }], agents: [added[0] as never], theme: 'none', version: 'test', options: { compactions: false, tokensVisible: false } }, { floorId: () => 'f_1234567890', agentId: () => 'a_12345678' }, 1);
    expect(projected.floors).toEqual([]);
  });
});
