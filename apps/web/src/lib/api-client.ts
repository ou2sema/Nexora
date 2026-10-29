import type { ErrorEnvelope } from '@mystock/contracts';

import { env } from './env';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  token: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

export async function apiRequest<T>(
  path: string,
  { token, method = 'GET', body, signal }: RequestOptions,
): Promise<T> {
  const response = await fetch(`${env.VITE_API_BASE_URL.replace(/\/$/, '')}${path}`, {
    method,
    signal,
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    let envelope: ErrorEnvelope | undefined;
    try {
      envelope = (await response.json()) as ErrorEnvelope;
    } catch {
      envelope = undefined;
    }

    throw new ApiError(
      response.status,
      envelope?.error.code ?? 'http_error',
      envelope?.error.message ?? `Request failed with status ${response.status}`,
      envelope?.error.details,
      envelope?.error.requestId,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
