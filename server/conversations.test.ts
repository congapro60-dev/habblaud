import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { ConversationStore } from './conversations';

describe('ConversationStore', () => {
  it('replays checkpoint, report and archive without raw secret fields', () => {
    const dir = mkdtempSync(join(tmpdir(), 'habblaud-conversations-'));
    try {
      const file = join(dir, 'conversations.ndjson');
      const store = new ConversationStore(file, () => 1_700_000_000_000);
      const c = store.create({ title: 'Reunião de arquitetura', workOrderId: 'wo-1' });
      expect(store.update(c.id, { action: 'checkpoint', checkpoint: 'Plan aprovado' }).status).toBe('CHECKPOINTED');
      expect(store.update(c.id, { action: 'report', report: 'Testes passados' }).status).toBe('COMPLETED');
      expect(store.update(c.id, { action: 'archive' }).status).toBe('ARCHIVED');
      const restored = new ConversationStore(file);
      restored.load();
      expect(restored.get(c.id)?.conversation).toMatchObject({ status: 'ARCHIVED', checkpoint: 'Plan aprovado', report: 'Testes passados' });
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
