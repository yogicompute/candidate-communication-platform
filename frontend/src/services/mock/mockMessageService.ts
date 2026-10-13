import { ApiError } from '@/services/apiError';
import type { MessageService } from '@/services/messageService';
import {
  getDb,
  saveDb,
  simulateNetwork,
  type CandidateRecord,
  type MessageRecord,
  type StatusEvent,
} from '@/services/mock/mockDb';
import { failureFor, submitToProvider } from '@/services/mock/mockProvider';
import type { BulkRecipientResult, BulkSendResult, Message, MessageStatus } from '@/types/message';
import { MAX_ATTEMPTS, MAX_BULK_RECIPIENTS, validateMessageBody } from '@/utils/messages';

const PROGRESS_ORDER: MessageStatus[] = ['pending', 'sent', 'delivered', 'read'];

function canTransition(from: MessageStatus, to: MessageStatus): boolean {
  if (from === 'failed' || from === 'read') return false;
  if (to === 'failed') return from === 'pending' || from === 'sent';
  return PROGRESS_ORDER.indexOf(to) > PROGRESS_ORDER.indexOf(from);
}

function applyEvent(record: MessageRecord, event: StatusEvent): void {
  if (!canTransition(record.status, event.status)) return;
  record.status = event.status;
  record.updatedAt = event.at;
  if (event.status === 'failed') {
    record.failedAt = event.at;
    record.failure = failureFor(event.failureCode ?? 'delivery_timeout');
    return;
  }
  record.sentAt ??= event.at;
  if (event.status === 'delivered' || event.status === 'read') record.deliveredAt ??= event.at;
  if (event.status === 'read') record.readAt = event.at;
}

export function syncMessageStatuses(): void {
  const db = getDb();
  const now = Date.now();
  let changed = false;

  for (const [reference, events] of Object.entries(db.pendingCallbacks)) {
    const due = events.filter((event) => Date.parse(event.at) <= now);
    if (due.length === 0) continue;
    const record = db.messages.find((message) => message.providerReference === reference);
    if (record) due.forEach((event) => applyEvent(record, event));
    const remaining = events.filter((event) => Date.parse(event.at) > now);
    if (remaining.length > 0) {
      db.pendingCallbacks[reference] = remaining;
    } else {
      delete db.pendingCallbacks[reference];
    }
    changed = true;
  }

  if (changed) saveDb();
}

export function latestMessageFor(candidateId: string): MessageRecord | undefined {
  let latest: MessageRecord | undefined;
  for (const message of getDb().messages) {
    if (message.candidateId !== candidateId) continue;
    if (!latest || Date.parse(message.createdAt) > Date.parse(latest.createdAt)) latest = message;
  }
  return latest;
}

function canRetry(record: MessageRecord): boolean {
  return (
    record.status === 'failed' &&
    Boolean(record.failure?.retryable) &&
    record.retriedById === null &&
    record.attemptNumber < MAX_ATTEMPTS
  );
}

function toMessage(record: MessageRecord): Message {
  return { ...record, canRetry: canRetry(record) };
}

function findCandidate(id: string): CandidateRecord | undefined {
  return getDb().candidates.find((candidate) => candidate.id === id.toUpperCase());
}

function requireValidBody(body: string): string {
  const text = body.trim();
  const error = validateMessageBody(text);
  if (error) throw new ApiError('Please fix the message.', 400, { body: error });
  return text;
}

function createAttempt(
  candidate: CandidateRecord,
  body: string,
  options: { bulkRequestId: string | null; retryOf?: MessageRecord },
): MessageRecord {
  const db = getDb();
  const now = Date.now();
  const createdAt = new Date(now).toISOString();
  const attemptNumber = options.retryOf ? options.retryOf.attemptNumber + 1 : 1;

  const record: MessageRecord = {
    id: `msg_${crypto.randomUUID()}`,
    candidateId: candidate.id,
    body,
    status: 'pending',
    providerReference: null,
    bulkRequestId: options.bulkRequestId,
    attemptNumber,
    retryOfId: options.retryOf?.id ?? null,
    retriedById: null,
    failure: null,
    createdAt,
    updatedAt: createdAt,
    sentAt: null,
    deliveredAt: null,
    readAt: null,
    failedAt: null,
  };

  const result = submitToProvider(candidate.phone, attemptNumber, now);
  if (result.accepted) {
    record.providerReference = result.reference;
    db.pendingCallbacks[result.reference] = result.events;
  } else {
    record.status = 'failed';
    record.failure = result.failure;
    record.failedAt = createdAt;
  }

  db.messages.push(record);
  if (options.retryOf) options.retryOf.retriedById = record.id;
  return record;
}

function sendToRecipient(candidateId: string, body: string, bulkRequestId: string): BulkRecipientResult {
  const candidate = findCandidate(candidateId);
  if (!candidate) {
    return { candidateId, candidateName: null, accepted: false, message: null, error: 'This candidate no longer exists.' };
  }
  try {
    const message = toMessage(createAttempt(candidate, body, { bulkRequestId }));
    return {
      candidateId,
      candidateName: candidate.fullName,
      accepted: message.status !== 'failed',
      message,
      error: message.failure?.message ?? null,
    };
  } catch {
    return {
      candidateId,
      candidateName: candidate.fullName,
      accepted: false,
      message: null,
      error: 'Something went wrong while sending to this candidate.',
    };
  }
}

export const mockMessageService: MessageService = {
  async listForCandidate(candidateId) {
    await simulateNetwork();
    syncMessageStatuses();
    const candidate = findCandidate(candidateId);
    if (!candidate) throw new ApiError('This candidate does not exist or was removed.', 404);
    return getDb()
      .messages.filter((message) => message.candidateId === candidate.id)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .map(toMessage);
  },

  async send({ candidateId, body, idempotencyKey }) {
    await simulateNetwork();
    const db = getDb();
    const previous = db.idempotency[idempotencyKey];
    if (previous) return previous as Message;

    const text = requireValidBody(body);
    const candidate = findCandidate(candidateId);
    if (!candidate) throw new ApiError('This candidate does not exist or was removed.', 404);

    const response = toMessage(createAttempt(candidate, text, { bulkRequestId: null }));
    db.idempotency[idempotencyKey] = response;
    saveDb();
    return response;
  },

  async sendBulk({ candidateIds, body, idempotencyKey }) {
    await simulateNetwork();
    const db = getDb();
    const previous = db.idempotency[idempotencyKey];
    if (previous) return previous as BulkSendResult;

    const text = requireValidBody(body);
    const uniqueIds = Array.from(new Set(candidateIds.map((id) => id.toUpperCase())));
    if (uniqueIds.length === 0) throw new ApiError('Select at least one candidate.', 400);
    if (uniqueIds.length > MAX_BULK_RECIPIENTS) {
      throw new ApiError(`You can message up to ${MAX_BULK_RECIPIENTS} candidates at once.`, 400);
    }

    const bulkRequestId = `bulk_${crypto.randomUUID()}`;
    const results = uniqueIds.map((id) => sendToRecipient(id, text, bulkRequestId));
    const acceptedCount = results.filter((result) => result.accepted).length;
    const response: BulkSendResult = {
      bulkRequestId,
      total: results.length,
      acceptedCount,
      failedCount: results.length - acceptedCount,
      results,
    };

    db.idempotency[idempotencyKey] = response;
    saveDb();
    return response;
  },

  async retry(messageId, idempotencyKey) {
    await simulateNetwork();
    const db = getDb();
    const previous = db.idempotency[idempotencyKey];
    if (previous) return previous as Message;

    syncMessageStatuses();
    const original = db.messages.find((message) => message.id === messageId);
    if (!original) throw new ApiError('This message no longer exists.', 404);
    if (!canRetry(original)) {
      const reason = original.retriedById
        ? 'This message has already been retried.'
        : "This message can't be retried.";
      throw new ApiError(reason, 409);
    }
    const candidate = findCandidate(original.candidateId);
    if (!candidate) throw new ApiError('This candidate does not exist or was removed.', 404);

    const response = toMessage(
      createAttempt(candidate, original.body, {
        bulkRequestId: original.bulkRequestId,
        retryOf: original,
      }),
    );
    db.idempotency[idempotencyKey] = response;
    saveDb();
    return response;
  },
};