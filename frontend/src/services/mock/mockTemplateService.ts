import { ApiError } from '@/services/apiError';
import { getDb, saveDb, simulateNetwork } from '@/services/mock/mockDb';
import type { TemplateService } from '@/services/templateService';
import type { MessageTemplate, TemplateInput } from '@/types/template';
import { validateTemplateInput } from '@/utils/templates';

const DUPLICATE = 'A template with this name already exists.';

const byName = (a: MessageTemplate, b: MessageTemplate) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

function requireValid(input: TemplateInput, excludeId?: string): TemplateInput {
  const value = { name: input.name.trim(), body: input.body.trim() };
  const errors = validateTemplateInput(value);
  if (errors.name || errors.body) throw new ApiError('Please fix the highlighted fields.', 400, errors);
  const taken = getDb().templates.some(
    (template) => template.id !== excludeId && template.name.toLowerCase() === value.name.toLowerCase(),
  );
  if (taken) throw new ApiError(DUPLICATE, 409, { name: DUPLICATE });
  return value;
}

function findTemplate(id: string): MessageTemplate {
  const template = getDb().templates.find((item) => item.id === id);
  if (!template) throw new ApiError('This template no longer exists.', 404);
  return template;
}

export const mockTemplateService: TemplateService = {
  async list() {
    await simulateNetwork();
    return [...getDb().templates].sort(byName);
  },

  async create(input) {
    await simulateNetwork();
    const value = requireValid(input);
    const now = new Date().toISOString();
    const template: MessageTemplate = {
      id: `tpl_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`,
      ...value,
      createdAt: now,
      updatedAt: now,
    };
    getDb().templates.push(template);
    saveDb();
    return template;
  },

  async update(id, input) {
    await simulateNetwork();
    const template = findTemplate(id);
    Object.assign(template, requireValid(input, id), { updatedAt: new Date().toISOString() });
    saveDb();
    return { ...template };
  },

  async remove(id) {
    await simulateNetwork();
    findTemplate(id);
    const db = getDb();
    db.templates = db.templates.filter((template) => template.id !== id);
    saveDb();
  },
};
