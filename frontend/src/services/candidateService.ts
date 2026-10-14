import { API_MODE } from '@/services/config';
import { httpCandidateService } from '@/services/http/httpCandidateService';
import { mockCandidateService } from '@/services/mock/mockCandidateService';
import type { Paginated } from '@/types/api';
import type {
  Candidate,
  CandidateInput,
  CandidateListParams,
  DeleteCandidatesResult,
} from '@/types/candidate';

export interface CandidateService {
  list(params: CandidateListParams): Promise<Paginated<Candidate>>;
  get(id: string): Promise<Candidate>;
  create(input: CandidateInput): Promise<Candidate>;
  remove(ids: string[]): Promise<DeleteCandidatesResult>;
}

export const candidateService: CandidateService =
  API_MODE === 'http' ? httpCandidateService : mockCandidateService;