import { ApiError } from '@/services/apiError';
import { API_BASE_URL } from '@/services/config';
import { IDEMPOTENCY_HEADER } from '@/services/http/endpoints';
import { toApiError } from '@/services/http/mappers';

const TIMEOUT_MS = 15_000;
const NETWORK_ERROR = 'We could not reach the server. Check your connection and try again.';
const TIMEOUT_ERROR = 'The server took too long to respond. Please try again.';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  idempotencyKey?: string;
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function apiRequest<T>(
  path: string,
  { method = 'GET', body, idempotencyKey }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (idempotencyKey) headers[IDEMPOTENCY_HEADER] = idempotencyKey;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError';
    throw new ApiError(timedOut ? TIMEOUT_ERROR : NETWORK_ERROR, 503);
  }

  const data = await readBody(response);
  if (!response.ok) throw toApiError(response.status, data);
  return data as T;
}