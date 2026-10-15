import { ApiError } from '@/services/apiError';
import type {
  ApiErrorDto,
  BulkSendResultDto,
  CandidateDto,
  CandidateInputDto,
  MessageDto,
  MessageTemplateDto,
  PaginatedDto,
  ScheduledMessageDto,
  ScheduleResultDto,
} from '@/services/http/apiTypes';
import type { Paginated } from '@/types/api';
import type { Candidate, CandidateInput, CandidateListParams } from '@/types/candidate';
import type { BulkSendResult, Message, ScheduledMessage, ScheduleResult } from '@/types/message';
import type { MessageTemplate } from '@/types/template';

const FIELD_NAMES: Record<string, string> = {
  full_name: 'fullName',
  candidate_id: 'candidateId',
  candidate_ids: 'candidateIds',
  last_message_after: 'lastMessageAfter',
  last_message_before: 'lastMessageBefore',
  scheduled_for: 'scheduledFor',
};

const LIST_QUERY_FIELDS = [
  ['search', 'search'],
  ['name', 'name'],
  ['phone', 'phone'],
  ['candidateId', 'candidate_id'],
  ['status', 'status'],
  ['lastMessageAfter', 'last_message_after'],
  ['lastMessageBefore', 'last_message_before'],
] as const satisfies ReadonlyArray<readonly [keyof CandidateListParams, string]>;

export function toCandidate(dto: CandidateDto): Candidate {
  return {
    id: dto.id,
    fullName: dto.full_name,
    phone: dto.phone,
    email: dto.email,
    createdAt: dto.created_at,
    lastMessageAt: dto.last_message_at,
    lastMessageStatus: dto.last_message_status,
  };
}

export function toCandidateInputDto(input: CandidateInput): CandidateInputDto {
  return { full_name: input.fullName, phone: input.phone, email: input.email };
}

export function toPaginated<TDto, T>(dto: PaginatedDto<TDto>, mapItem: (item: TDto) => T): Paginated<T> {
  return {
    items: dto.results.map(mapItem),
    total: dto.count,
    page: dto.page,
    pageSize: dto.page_size,
  };
}

export function toCandidateListQuery(params: CandidateListParams): string {
  const query = new URLSearchParams();
  for (const [field, name] of LIST_QUERY_FIELDS) {
    const value = params[field]?.trim();
    if (value) query.set(name, value);
  }
  query.set('page', String(params.page));
  query.set('page_size', String(params.pageSize));
  return query.toString();
}

export function toMessage(dto: MessageDto): Message {
  return {
    id: dto.id,
    candidateId: dto.candidate_id,
    body: dto.body,
    status: dto.status,
    providerReference: dto.provider_reference,
    bulkRequestId: dto.bulk_request_id,
    attemptNumber: dto.attempt_number,
    retryOfId: dto.retry_of_id,
    retriedById: dto.retried_by_id,
    failure: dto.failure,
    canRetry: dto.can_retry,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    sentAt: dto.sent_at,
    deliveredAt: dto.delivered_at,
    readAt: dto.read_at,
    failedAt: dto.failed_at,
  };
}

export function toBulkSendResult(dto: BulkSendResultDto): BulkSendResult {
  return {
    bulkRequestId: dto.bulk_request_id,
    total: dto.total,
    acceptedCount: dto.accepted_count,
    failedCount: dto.failed_count,
    results: dto.results.map((item) => ({
      candidateId: item.candidate_id,
      candidateName: item.candidate_name,
      accepted: item.accepted,
      message: item.message ? toMessage(item.message) : null,
      error: item.error,
    })),
  };
}

export function toScheduledMessage(dto: ScheduledMessageDto): ScheduledMessage {
  return {
    id: dto.id,
    candidateId: dto.candidate_id,
    body: dto.body,
    scheduledFor: dto.scheduled_for,
    status: dto.status,
    groupId: dto.group_id,
    messageId: dto.message_id,
    canCancel: dto.can_cancel,
    createdAt: dto.created_at,
    cancelledAt: dto.cancelled_at,
  };
}

export function toScheduleResult(dto: ScheduleResultDto): ScheduleResult {
  return {
    groupId: dto.group_id,
    scheduledFor: dto.scheduled_for,
    total: dto.total,
    acceptedCount: dto.accepted_count,
    failedCount: dto.failed_count,
    results: dto.results.map((item) => ({
      candidateId: item.candidate_id,
      candidateName: item.candidate_name,
      accepted: item.accepted,
      scheduledMessage: item.scheduled_message ? toScheduledMessage(item.scheduled_message) : null,
      error: item.error,
    })),
  };
}

export function toTemplate(dto: MessageTemplateDto): MessageTemplate {
  return { id: dto.id, name: dto.name, body: dto.body, createdAt: dto.created_at, updatedAt: dto.updated_at };
}

function isApiErrorDto(body: unknown): body is ApiErrorDto {
  if (typeof body !== 'object' || body === null || !('error' in body)) return false;
  const { error } = body as { error: unknown };
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { message?: unknown }).message === 'string'
  );
}

export function toApiError(status: number, body: unknown): ApiError {
  if (!isApiErrorDto(body)) {
    const message =
      status >= 500
        ? 'The server ran into a problem. Please try again.'
        : 'Something went wrong. Please try again.';
    return new ApiError(message, status);
  }
  const fieldErrors = Object.fromEntries(
    Object.entries(body.error.fields ?? {}).map(([field, text]) => [FIELD_NAMES[field] ?? field, text]),
  );
  return new ApiError(body.error.message, status, fieldErrors);
}