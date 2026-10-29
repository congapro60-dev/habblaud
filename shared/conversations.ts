export type ConversationStatus = 'OPEN' | 'CHECKPOINTED' | 'COMPLETED' | 'ARCHIVED' | 'BLOCKED';

export type ConversationMessageRole = 'director' | 'head';
export interface ConversationMessage {
  id: string;
  workOrderId: string;
  role: ConversationMessageRole;
  text: string;
  idempotencyKey?: string;
  createdAt: number;
}

export interface ConversationRecord {
  id: string;
  title: string;
  projectPath?: string;
  workOrderId?: string;
  workOrderIds: string[];
  messages: ConversationMessage[];
  headId?: string;
  requestedRoute?: string;
  servedRoute?: string;
  checkpoint?: string;
  report?: string;
  status: ConversationStatus;
  evidenceRefs: string[];
  createdAt: number;
  updatedAt: number;
}

export type ConversationEventType = 'CONVERSATION_CREATED' | 'MESSAGE_APPENDED' | 'CHECKPOINT_SAVED' | 'REPORT_SAVED' | 'CONVERSATION_ARCHIVED' | 'CONVERSATION_BLOCKED';
export interface ConversationEvent {
  sequence: number;
  conversationId: string;
  type: ConversationEventType;
  payload: Record<string, unknown>;
  at: number;
}
