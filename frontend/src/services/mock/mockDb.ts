import { ApiError } from '@/services/apiError';
import { SEED_CANDIDATES, SEED_MESSAGES } from '@/services/mock/mockData';
import type { Candidate } from '@/types/candidate';
import type {
  BulkSendResult,
  FailureCode,
  Message,
  MessageStatus,
  ScheduledMessage,
  ScheduleResult,
} from '@/types/message';
import type { MessageTemplate } from '@/types/template';

const STORAGE_KEY = 'ccp:mock-db:v2';
const FAIL_KEY = 'ccp:mock-fail';

export type CandidateRecord = Omit<Candidate, 'lastMessageAt' | 'lastMessageStatus'>;

export type MessageRecord = Omit<Message, 'canRetry'>;

/** body keeps its placeholders until the message is sent. */
export type ScheduledRecord = Omit<ScheduledMessage, 'canCancel'>;

export interface StatusEvent {
  status: Exclude<MessageStatus, 'pending'>;
  at: string;
  failureCode?: FailureCode;
}

export interface MockDb {
  candidates: CandidateRecord[];
  messages: MessageRecord[];
  pendingCallbacks: Record<string, StatusEvent[]>;
  idempotency: Record<string, Message | BulkSendResult | ScheduleResult>;
  templates: MessageTemplate[];
  scheduled: ScheduledRecord[];
}

let db: MockDb | null = null;

const isBrowser = () => typeof window !== 'undefined';

function seedDb(): MockDb {
  return {
    candidates: structuredClone(SEED_CANDIDATES),
    messages: structuredClone(SEED_MESSAGES),
    pendingCallbacks: {},
    idempotency: {},
    templates: [],
    scheduled: [],
  };
}

function readStoredDb(): MockDb | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MockDb) : null;
  } catch {
    return null;
  }
}

function isFailureSimulated(): boolean {
  if (!isBrowser()) return false;
  try {
    return window.localStorage.getItem(FAIL_KEY) === '1';
  } catch {
    return false;
  }
}

export function getDb(): MockDb {
  db ??= readStoredDb() ?? seedDb();
  // Stored before these features existed.
  db.templates ??= [];
  db.scheduled ??= [];
  return db;
}

export function saveDb(): void {
  if (!db || !isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Storage is full or blocked; data stays in memory for this session.
  }
}

export async function simulateNetwork(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 400));
  if (isFailureSimulated()) {
    throw new ApiError('We could not reach the server. Check your connection and try again.', 503);
  }
}