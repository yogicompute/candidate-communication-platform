import type { FailureCode, MessageStatus } from '@/types/message';

export interface CandidateDto {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  created_at: string;
  last_message_at: string | null;
  last_message_status: MessageStatus | null;
}

export interface CandidateInputDto {
  full_name: string;
  phone: string;
  email: string;
}

export interface PaginatedDto<T> {
  count: number;
  page: number;
  page_size: number;
  results: T[];
}

export interface MessageFailureDto {
  code: FailureCode;
  message: string;
  retryable: boolean;
}

export interface MessageDto {
  id: string;
  candidate_id: string;
  body: string;
  status: MessageStatus;
  provider_reference: string | null;
  bulk_request_id: string | null;
  attempt_number: number;
  retry_of_id: string | null;
  retried_by_id: string | null;
  failure: MessageFailureDto | null;
  can_retry: boolean;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  failed_at: string | null;
}

export interface MessageListDto {
  results: MessageDto[];
}

export interface SendMessageDto {
  candidate_id: string;
  body: string;
}

export interface BulkSendDto {
  candidate_ids: string[];
  body: string;
}

export interface BulkRecipientResultDto {
  candidate_id: string;
  candidate_name: string | null;
  accepted: boolean;
  message: MessageDto | null;
  error: string | null;
}

export interface BulkSendResultDto {
  bulk_request_id: string;
  total: number;
  accepted_count: number;
  failed_count: number;
  results: BulkRecipientResultDto[];
}

export interface ApiErrorDto {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}