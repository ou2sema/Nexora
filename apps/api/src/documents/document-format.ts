/**
 * Pure text preparation shared by every server-rendered document. Nothing here
 * knows about PDF geometry or a specific document family: amounts are integer
 * minor units (TND millimes), quantities mirror numeric(18,4), and the text is
 * reduced to what the standard PDF fonts can draw.
 */

export interface DocumentParty {
  name: string;
  details: string[];
}

export interface DocumentMeta {
  label: string;
  value: string;
}

export interface DocumentNote {
  title: string;
  body: string;
}

/** What every page header and footer needs to identify the document. */
export interface DocumentHeading {
  organizationName: string;
  title: string;
  number: string;
}

/**
 * The meta row, with the entries that have nothing to print left out. A document that
 * prints `Référence  -` advertises a gap in its own data; a document that prints nothing
 * for a field nobody filled in reads as intentional, and the row simply holds fewer columns.
 */
export function compactMeta(
  entries: { label: string; value: string | null | undefined }[],
): DocumentMeta[] {
  return entries
    .filter((entry): entry is { label: string; value: string } => Boolean(entry.value))
    .map((entry) => ({ label: entry.label, value: entry.value }));
}

/** One right-aligned row in the totals box, already formatted for print. */
export interface DocumentTotalRow {
  label: string;
  value: string;
  strong?: boolean;
}

export function formatMillimesAscii(minor: number): string {
  const sign = minor < 0 ? '-' : '';
  const absolute = Math.abs(Math.trunc(minor));
  const dinars = Math.floor(absolute / 1000)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const millimes = (absolute % 1000).toString().padStart(3, '0');
  return `${sign}${dinars}.${millimes}`;
}

export function formatQuantityAscii(quantity: number): string {
  if (Number.isInteger(quantity)) return String(quantity);
  return quantity.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

/** Standard PDF fonts use WinAnsi, so non-Latin text is transliterated or replaced. */
export function sanitizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/[^\x20-\x7e\n]/g, '?');
}

export function sanitizeFileName(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, '-');
}

export function dateOnly(value: string | null): string {
  return value ? value.slice(0, 10) : '-';
}

export function roundQuantity(quantity: number): number {
  return Math.round(quantity * 10_000) / 10_000;
}
