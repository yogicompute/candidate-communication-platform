import { MESSAGE_STATUS_LABELS, MESSAGE_STATUSES, type MessageStatus } from '@/types/message';

/**
 * The candidate's most recent status: "scheduled" while a scheduled message is waiting, "cancelled"
 * when a cancellation is newer than the last sent message, otherwise that message's status.
 */
export type CandidateStatus = MessageStatus | 'scheduled' | 'cancelled';

export const CANDIDATE_STATUSES: CandidateStatus[] = [...MESSAGE_STATUSES, 'scheduled', 'cancelled'];

export const CANDIDATE_STATUS_LABELS: Record<CandidateStatus, string> = {
  ...MESSAGE_STATUS_LABELS,
  scheduled: 'Scheduled',
  cancelled: 'Cancelled',
};

export interface Candidate {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  createdAt: string;
  lastMessageAt: string | null;
  lastMessageStatus: CandidateStatus | null;
}

export interface CandidateInput {
  fullName: string;
  phone: string;
  email: string;
}

export type CandidateStatusFilter = CandidateStatus | 'none';

export interface CandidateListParams {
  search?: string;
  name?: string;
  phone?: string;
  candidateId?: string;
  status?: CandidateStatusFilter;
  lastMessageAfter?: string;
  lastMessageBefore?: string;
  page: number;
  pageSize: number;
}

export interface DeleteCandidatesResult {
  deletedIds: string[];
  notFoundIds: string[];
}
