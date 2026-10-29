import { describe, expect, it } from 'vitest';

import { slugify } from '../src/slug';

describe('slugify', () => {
  it('lowercases and joins words with single hyphens', () => {
    expect(slugify('SBS VISION')).toBe('sbs-vision');
    expect(slugify('  Cameras &  Lenses  ')).toBe('cameras-lenses');
  });

  it('strips diacritics and punctuation', () => {
    expect(slugify('Écrans — Réseau (2026)')).toBe('ecrans-reseau-2026');
  });

  it('truncates without leaving a trailing hyphen', () => {
    expect(slugify('a'.repeat(58) + ' word', 60)).toBe('a'.repeat(58));
  });

  it('rejects input with no usable characters', () => {
    expect(() => slugify('***')).toThrow(/Cannot build a slug/);
  });
});
