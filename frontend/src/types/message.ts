export const MESSAGE_STATUSES = ['pending', 'sent', 'delivered', 'read', 'failed'] as const;

export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const MESSAGE_STATUS_LABELS: Record<MessageStatus, string> = {
  pending: 'Pending',
  sent: 'Sent',
  delivered: 'Delivered',
  read: 'Read',
  failed: 'Failed',
};

export type FailureCode =
  | 'invalid_number'
  | 'blocked_recipient'
  | 'rate_limited'
  | 'provider_unavailable'
  | 'delivery_timeout';

export interface MessageFailure {
  code: FailureCode;
  message: string;
  retryable: boolean;
}

export interface Message {
  id: string;
  candidateId: string;
  body: string;
  status: MessageStatus;
  providerReference: string | null;
  bulkRequestId: string | null;
  attemptNumber: number;
  retryOfId: string | null;
  retriedById: string | null;
  failure: MessageFailure | null;
  canRetry: boolean;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  failedAt: string | null;
}

export interface SendMessageInput {
  candidateId: string;
  body: string;
  idempotencyKey: string;
}

export interface BulkSendInput {
  candidateIds: string[];
  body: string;
  idempotencyKey: string;
}

export interface BulkRecipientResult {
  candidateId: string;
  candidateName: string | null;
  accepted: boolean;
  message: Message | null;
  error: string | null;
}

export interface BulkSendResult {
  bulkRequestId: string;
  total: number;
  acceptedCount: number;
  failedCount: number;
  results: BulkRecipientResult[];
}