export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: Partial<Record<string, string>>;

  constructor(message: string, status: number, fieldErrors: Partial<Record<string, string>> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Something went wrong. Please try again.';
}