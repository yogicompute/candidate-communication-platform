export const API_PREFIX = '/api/v1';

const encode = encodeURIComponent;

export const endpoints = {
  health: () => `${API_PREFIX}/health/`,
  candidates: () => `${API_PREFIX}/candidates/`,
  candidatesBulkDelete: () => `${API_PREFIX}/candidates/bulk-delete/`,
  candidate: (id: string) => `${API_PREFIX}/candidates/${encode(id)}/`,
  candidateMessages: (id: string) => `${API_PREFIX}/candidates/${encode(id)}/messages/`,
  messages: () => `${API_PREFIX}/messages/`,
  bulkMessages: () => `${API_PREFIX}/messages/bulk/`,
  retryMessage: (id: string) => `${API_PREFIX}/messages/${encode(id)}/retry/`,
  scheduleMessages: () => `${API_PREFIX}/messages/schedule/`,
  candidateScheduled: (id: string) => `${API_PREFIX}/candidates/${encode(id)}/scheduled-messages/`,
  cancelScheduled: (id: string) => `${API_PREFIX}/scheduled-messages/${encode(id)}/cancel/`,
  templates: () => `${API_PREFIX}/templates/`,
  template: (id: string) => `${API_PREFIX}/templates/${encode(id)}/`,
} as const;

export const IDEMPOTENCY_HEADER = 'Idempotency-Key';