import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ConversationEvent, ConversationMessage, ConversationRecord, ConversationStatus } from '../shared/conversations';

const MAX_LINE = 64 * 1024;
const SECRET = /(?:access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|api[_-]?key|password|authorization|cookie|sk-[A-Za-z0-9_-]{12,})/i;

export class ConversationError extends Error {
  constructor(readonly code: 'invalid' | 'not-found' | 'unavailable', message: string) { super(message); }
}

function text(value: unknown, name: string, max: number, required = false): string | undefined {
  if (value === undefined || value === null) { if (required) throw new ConversationError('invalid', `${name} é obrigatório`); return undefined; }
  if (typeof value !== 'string') throw new ConversationError('invalid', `${name} inválido`);
  const out = value.trim();
  if (required && !out) throw new ConversationError('invalid', `${name} é obrigatório`);
  if (out.length > max || out.includes('\0') || SECRET.test(out)) throw new ConversationError('invalid', `${name} contém dado proibido`);
  return out || undefined;
}

export class ConversationStore {
  private readonly records = new Map<string, ConversationRecord>();
  private readonly events: ConversationEvent[] = [];
  private sequence = 1;
  private loaded = false;
  private error?: string;

  constructor(private readonly file: string, private readonly now: () => number = Date.now) {}

  load(): void {
    if (this.loaded) return;
    this.loaded = true;
    if (!existsSync(this.file)) return;
    try {
      for (const line of readFileSync(this.file, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        if (Buffer.byteLength(line) > MAX_LINE) throw new Error('conversation line too large');
        this.apply(JSON.parse(line) as ConversationEvent);
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
      throw new ConversationError('unavailable', `kho conversation lỗi: ${this.error}`);
    }
  }

  list(): ConversationRecord[] { this.ready(); return [...this.records.values()].sort((a, b) => b.updatedAt - a.updatedAt).map((x) => structuredClone(x)); }
  get(id: string): { conversation: ConversationRecord; events: ConversationEvent[] } | undefined { this.ready(); const c = this.records.get(id); return c ? { conversation: structuredClone(c), events: this.events.filter((e) => e.conversationId === id).map((e) => structuredClone(e)) } : undefined; }

  create(raw: unknown): ConversationRecord {
    this.ready();
    const b = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const now = this.now();
    const c: ConversationRecord = {
      id: randomUUID(), title: text(b.title, 'title', 240, true)!, projectPath: text(b.projectPath, 'projectPath', 1024), workOrderId: text(b.workOrderId, 'workOrderId', 100), workOrderIds: typeof b.workOrderId === 'string' ? [text(b.workOrderId, 'workOrderId', 100)!] : [], messages: [], headId: text(b.headId, 'headId', 100), requestedRoute: text(b.requestedRoute, 'requestedRoute', 200), status: 'OPEN', evidenceRefs: [], createdAt: now, updatedAt: now,
    };
    this.append({ type: 'CONVERSATION_CREATED', conversationId: c.id, payload: { conversation: c }, at: now });
    return structuredClone(c);
  }

  update(id: string, raw: unknown): ConversationRecord {
    this.ready();
    if (!this.records.has(id)) throw new ConversationError('not-found', 'conversation không tồn tại');
    const b = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const action = b.action;
    if (action === 'message') {
      const workOrderId = text(b.workOrderId, 'workOrderId', 100, true)!;
      const role = b.role === 'head' ? 'head' : b.role === 'director' ? 'director' : undefined;
      if (!role) throw new ConversationError('invalid', 'role de conversation inválido');
      const key = text(b.idempotencyKey, 'idempotencyKey', 160);
      const existing = this.records.get(id)!.messages.find((message) => key && message.idempotencyKey === key);
      if (existing) return structuredClone(this.records.get(id)!);
      const message: ConversationMessage = { id: randomUUID(), workOrderId, role, text: text(b.text, 'text', 8000, true)!, ...(key ? { idempotencyKey: key } : {}), createdAt: this.now() };
      this.append({ type: 'MESSAGE_APPENDED', conversationId: id, payload: { message }, at: message.createdAt });
    } else if (action === 'checkpoint') this.append({ type: 'CHECKPOINT_SAVED', conversationId: id, payload: { checkpoint: text(b.checkpoint, 'checkpoint', 8000, true) }, at: this.now() });
    else if (action === 'report') this.append({ type: 'REPORT_SAVED', conversationId: id, payload: { report: text(b.report, 'report', 8000, true) }, at: this.now() });
    else if (action === 'archive') this.append({ type: 'CONVERSATION_ARCHIVED', conversationId: id, payload: {}, at: this.now() });
    else if (action === 'block') this.append({ type: 'CONVERSATION_BLOCKED', conversationId: id, payload: { reason: text(b.reason, 'reason', 1000, true) }, at: this.now() });
    else throw new ConversationError('invalid', 'action de conversation inválida');
    return structuredClone(this.records.get(id)!);
  }

  private ready(): void { this.load(); if (this.error) throw new ConversationError('unavailable', this.error); }
  private append(input: Omit<ConversationEvent, 'sequence'>): void {
    const event: ConversationEvent = { sequence: this.sequence, ...input };
    const line = `${JSON.stringify(event)}\n`;
    if (Buffer.byteLength(line) > MAX_LINE) throw new ConversationError('invalid', 'evento grande demais');
    try { mkdirSync(dirname(this.file), { recursive: true }); appendFileSync(this.file, line, { encoding: 'utf8', mode: 0o600, flag: 'a' }); } catch (err) { throw new ConversationError('unavailable', `não foi possível gravar conversation: ${err instanceof Error ? err.message : String(err)}`); }
    this.apply(event);
  }
  private apply(event: ConversationEvent): void {
    if (event.sequence !== this.sequence || !event.conversationId || SECRET.test(JSON.stringify(event.payload))) throw new Error('conversation event inválido');
    const p = event.payload ?? {};
    const c = this.records.get(event.conversationId);
    if (event.type === 'CONVERSATION_CREATED') { if (c || !p.conversation) throw new Error('conversation duplicada'); const created = structuredClone(p.conversation as ConversationRecord); created.workOrderIds ??= created.workOrderId ? [created.workOrderId] : []; created.messages ??= []; this.records.set(event.conversationId, created); }
    else if (!c) throw new Error('event sem conversation');
    else if (event.type === 'MESSAGE_APPENDED') { const message = p.message as ConversationMessage; if (!message || typeof message.workOrderId !== 'string' || (message.role !== 'director' && message.role !== 'head') || typeof message.text !== 'string') throw new Error('message de conversation inválida'); c.messages.push(structuredClone(message)); c.messages = c.messages.slice(-64); c.workOrderIds = [...new Set([...c.workOrderIds, message.workOrderId])].slice(-64); c.workOrderId = message.workOrderId; c.updatedAt = event.at; }
    else if (event.type === 'CHECKPOINT_SAVED') { c.checkpoint = p.checkpoint as string; c.status = 'CHECKPOINTED'; c.updatedAt = event.at; }
    else if (event.type === 'REPORT_SAVED') { c.report = p.report as string; c.status = 'COMPLETED'; c.updatedAt = event.at; }
    else if (event.type === 'CONVERSATION_ARCHIVED') { c.status = 'ARCHIVED'; c.updatedAt = event.at; }
    else if (event.type === 'CONVERSATION_BLOCKED') { c.status = 'BLOCKED'; c.updatedAt = event.at; }
    else throw new Error('conversation event desconhecido');
    this.events.push(structuredClone(event)); this.sequence++;
  }
}
