import type { CandidateService } from '@/services/candidateService';
import { apiRequest } from '@/services/http/apiClient';
import type {
  CandidateBulkDeleteDto,
  CandidateBulkDeleteResultDto,
  CandidateDto,
  PaginatedDto,
} from '@/services/http/apiTypes';
import { endpoints } from '@/services/http/endpoints';
import {
  toCandidate,
  toCandidateInputDto,
  toCandidateListQuery,
  toPaginated,
} from '@/services/http/mappers';

export const httpCandidateService: CandidateService = {
  async list(params) {
    const dto = await apiRequest<PaginatedDto<CandidateDto>>(
      `${endpoints.candidates()}?${toCandidateListQuery(params)}`,
    );
    return toPaginated(dto, toCandidate);
  },

  async get(id) {
    return toCandidate(await apiRequest<CandidateDto>(endpoints.candidate(id)));
  },

  async create(input) {
    const dto = await apiRequest<CandidateDto>(endpoints.candidates(), {
      method: 'POST',
      body: toCandidateInputDto(input),
    });
    return toCandidate(dto);
  },

  async remove(ids) {
    const payload: CandidateBulkDeleteDto = { candidate_ids: ids };
    const dto = await apiRequest<CandidateBulkDeleteResultDto>(endpoints.candidatesBulkDelete(), {
      method: 'POST',
      body: payload,
    });
    return { deletedIds: dto.deleted_ids, notFoundIds: dto.not_found_ids };
  },
};