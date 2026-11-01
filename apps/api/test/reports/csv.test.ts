import { describe, expect, it } from 'vitest';

import { csvDocument, csvField } from '../../src/reports/csv';

describe('CSV field serialization', () => {
  it.each(['=', '+', '-', '@'])('prefixes a formula starting with %s', (operator) => {
    expect(csvField(`${operator}1+1`)).toBe(`'${operator}1+1`);
  });

  it.each([
    ['space', ' =1+1'],
    ['tab', '\t+1+1'],
    ['line feed', '\n-1+1'],
    ['carriage return', '\r@SUM(A1:A2)'],
    ['NUL control', '\u0000=1+1'],
    ['C1 control', '\u0085+1+1'],
  ])('protects a formula following %s', (_prefix, value) => {
    const safeValue = `'${value}`;
    const expected = /[",\r\n]/.test(safeValue) ? `"${safeValue.replace(/"/g, '""')}"` : safeValue;
    expect(csvField(value)).toBe(expected);
  });

  it('preserves numeric values, including legitimate negative numbers', () => {
    expect(csvField(-42)).toBe('-42');
    expect(csvField(-0.25)).toBe('-0.25');
    expect(csvField(42)).toBe('42');
  });

  it('retains existing null handling and CSV quoting/escaping', () => {
    expect(csvField(null)).toBe('');
    expect(csvField(undefined)).toBe('');
    expect(csvField('USB-C cable, 2m')).toBe('"USB-C cable, 2m"');
    expect(csvField('say "hello"')).toBe('"say ""hello"""');
    expect(csvField('line 1\nline 2')).toBe('"line 1\nline 2"');
    expect(csvDocument(['name'], [['USB-C cable, 2m']]).toString('utf8')).toBe(
      'name\r\n"USB-C cable, 2m"\r\n',
    );
  });
});
