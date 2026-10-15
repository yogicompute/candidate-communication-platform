// Mirrors backend/messaging/placeholders.py: only these two placeholders exist, and they are
// rendered per recipient when a message is sent.
export const PLACEHOLDERS = ['candidate_name', 'first_name'] as const;

export type Placeholder = (typeof PLACEHOLDERS)[number];

const HINT = 'Use {{candidate_name}} or {{first_name}}.';
const TOKEN = /\{\{\s*([A-Za-z0-9_]*)\s*\}\}/g;

const isPlaceholder = (name: string): name is Placeholder =>
  (PLACEHOLDERS as readonly string[]).includes(name);

export function placeholderError(text: string): string | null {
  for (const match of text.matchAll(TOKEN)) {
    if (!isPlaceholder(match[1])) return `${match[0]} isn't a supported placeholder. ${HINT}`;
  }
  const leftover = text.replace(TOKEN, '');
  if (leftover.includes('{{') || leftover.includes('}}')) {
    return `A placeholder is missing a brace or contains extra characters. ${HINT}`;
  }
  return null;
}

export function hasPlaceholders(text: string): boolean {
  return Array.from(text.matchAll(TOKEN)).some((match) => isPlaceholder(match[1]));
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

/** Fill in placeholders for one recipient. Unknown tokens are left as typed. */
export function renderPlaceholders(text: string, fullName: string): string {
  const values: Record<Placeholder, string> = { candidate_name: fullName, first_name: firstName(fullName) };
  return text.replace(TOKEN, (token, name: string) => (isPlaceholder(name) ? values[name] : token));
}
