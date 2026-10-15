import { API_MODE } from '@/services/config';
import { httpTemplateService } from '@/services/http/httpTemplateService';
import { mockTemplateService } from '@/services/mock/mockTemplateService';
import type { MessageTemplate, TemplateInput } from '@/types/template';

export interface TemplateService {
  list(): Promise<MessageTemplate[]>;
  create(input: TemplateInput): Promise<MessageTemplate>;
  update(id: string, input: TemplateInput): Promise<MessageTemplate>;
  remove(id: string): Promise<void>;
}

export const templateService: TemplateService = API_MODE === 'http' ? httpTemplateService : mockTemplateService;
