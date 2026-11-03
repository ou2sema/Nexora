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
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

function apiUrl(path: string): string {
  return `${env.VITE_API_BASE_URL.replace(/\/$/, '')}${path}`;
}

async function throwApiError(response: Response): Promise<never> {
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

export async function apiRequest<T>(
  path: string,
  { token, method = 'GET', body, headers, signal }: RequestOptions,
): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method,
    signal,
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    await throwApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export interface DownloadedFile {
  blob: Blob;
  filename: string;
}

export async function apiDownload(path: string, token: string): Promise<DownloadedFile> {
  const response = await fetch(apiUrl(path), {
    headers: { authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    await throwApiError(response);
  }

  const disposition = response.headers.get('content-disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(disposition);

  return {
    blob: await response.blob(),
    filename: match?.[1] ?? 'export.csv',
  };
}

/**
 * Sends the file as the entire request body. The logo endpoint reads raw bytes, so the
 * upload must not be wrapped in JSON or multipart.
 */
export async function apiUpload<T>(
  path: string,
  { token, contentType, body }: { token: string; contentType: string; body: ArrayBuffer },
): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}`, 'content-type': contentType },
    body,
  });

  if (!response.ok) {
    await throwApiError(response);
  }

  return (await response.json()) as T;
}
