import { mockCandidateService } from '@/services/mock/mockCandidateService';
import type { Paginated } from '@/types/api';
import type { Candidate, CandidateInput, CandidateListParams } from '@/types/candidate';

export interface CandidateService {
  list(params: CandidateListParams): Promise<Paginated<Candidate>>;
  get(id: string): Promise<Candidate>;
  create(input: CandidateInput): Promise<Candidate>;
}

export const candidateService: CandidateService = mockCandidateService;