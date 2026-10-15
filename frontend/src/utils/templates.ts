import type { FieldErrors } from '@/types/api';
import type { TemplateInput } from '@/types/template';
import { validateMessageBody } from '@/utils/messages';

export const TEMPLATE_NAME_MAX_LENGTH = 100;

export function validateTemplateInput(input: TemplateInput): FieldErrors<TemplateInput> {
  const errors: FieldErrors<TemplateInput> = {};
  const name = input.name.trim();
  if (!name) errors.name = 'Give the template a name.';
  else if (name.length > TEMPLATE_NAME_MAX_LENGTH) {
    errors.name = `Names can be up to ${TEMPLATE_NAME_MAX_LENGTH} characters.`;
  }
  const bodyError = validateMessageBody(input.body);
  if (bodyError) errors.body = bodyError === 'Write a message before sending.' ? 'Write the template message.' : bodyError;
  return errors;
}
