import { apiRequest } from '@/services/http/apiClient';
import type { MessageTemplateDto, MessageTemplateListDto, TemplateInputDto } from '@/services/http/apiTypes';
import { endpoints } from '@/services/http/endpoints';
import { toTemplate } from '@/services/http/mappers';
import type { TemplateService } from '@/services/templateService';

export const httpTemplateService: TemplateService = {
  async list() {
    const dto = await apiRequest<MessageTemplateListDto>(endpoints.templates());
    return dto.results.map(toTemplate);
  },

  async create({ name, body }) {
    const payload: TemplateInputDto = { name, body };
    return toTemplate(await apiRequest<MessageTemplateDto>(endpoints.templates(), { method: 'POST', body: payload }));
  },

  async update(id, { name, body }) {
    const payload: TemplateInputDto = { name, body };
    return toTemplate(await apiRequest<MessageTemplateDto>(endpoints.template(id), { method: 'PATCH', body: payload }));
  },

  async remove(id) {
    await apiRequest<null>(endpoints.template(id), { method: 'DELETE' });
  },
};
