import type { MessageStatus } from '@/types/message';

export interface Candidate {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  createdAt: string;
  lastMessageAt: string | null;
  lastMessageStatus: MessageStatus | null;
}

export interface CandidateInput {
  fullName: string;
  phone: string;
  email: string;
}

export type CandidateStatusFilter = MessageStatus | 'none';

export interface CandidateListParams {
  search?: string;
  status?: CandidateStatusFilter;
  page: number;
  pageSize: number;
}