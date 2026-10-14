export type ApiMode = 'mock' | 'http';

export const API_MODE: ApiMode = process.env.NEXT_PUBLIC_API_MODE === 'http' ? 'http' : 'mock';

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');