import { ApiError } from '@/services/apiError';
import type {
  ApiErrorDto,
  BulkSendResultDto,
  CandidateDto,
  CandidateInputDto,
  MessageDto,
  PaginatedDto,
} from '@/services/http/apiTypes';
import type { Paginated } from '@/types/api';
import type { Candidate, CandidateInput, CandidateListParams } from '@/types/candidate';
import type { BulkSendResult, Message } from '@/types/message';

const FIELD_NAMES: Record<string, string> = {
  full_name: 'fullName',
  candidate_id: 'candidateId',
  candidate_ids: 'candidateIds',
};

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
  const search = params.search?.trim();
  if (search) query.set('search', search);
  if (params.status) query.set('status', params.status);
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