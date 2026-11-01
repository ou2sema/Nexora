const FORMULA_PREFIX = /^[\p{White_Space}\p{Cc}]*[=+\-@]/u;

export function csvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  const safeText = typeof value === 'string' && FORMULA_PREFIX.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safeText) ? `"${safeText.replace(/"/g, '""')}"` : safeText;
}

export function csvDocument(header: readonly string[], rows: readonly unknown[][]): Buffer {
  const lines = [header.map(csvField).join(',')];
  for (const row of rows) lines.push(row.map(csvField).join(','));
  return Buffer.from(`${lines.join('\r\n')}\r\n`, 'utf8');
}
