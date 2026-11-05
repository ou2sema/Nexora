/**
 * The wire contract for a document download (ADR-0019 decision 3). A printed document is
 * not stored anywhere — it is rendered from rows when the operator asks for it — so the
 * language is a property of the request, not of the record, and it travels as `?locale=`.
 */

import { z } from 'zod';

export const DOCUMENT_LOCALES = ['en', 'fr', 'ar'] as const;

export type DocumentLocale = (typeof DOCUMENT_LOCALES)[number];

export const documentLocaleSchema = z.enum(DOCUMENT_LOCALES);

/** Anything the download routes take today: the language to print in. */
export const documentQuerySchema = z.object({
  locale: documentLocaleSchema.default('en'),
});

export type DocumentQuery = z.infer<typeof documentQuerySchema>;
