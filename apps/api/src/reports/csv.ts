export function csvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvDocument(header: readonly string[], rows: readonly unknown[][]): Buffer {
  const lines = [header.map(csvField).join(',')];
  for (const row of rows) lines.push(row.map(csvField).join(','));
  return Buffer.from(`${lines.join('\r\n')}\r\n`, 'utf8');
}
