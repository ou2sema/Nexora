export function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}

export function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export function fileDate(): string {
  return new Date().toISOString().slice(0, 10);
}
