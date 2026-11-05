import { describe, expect, it } from 'vitest';

import { expectArabicPhrase, withoutSpaces } from './pdf';

// Fragments of the same printed invoice and purchase order read by two readers. Xpdf 4.00 on this
// machine keeps each Arabic word whole; poppler on CI reports some adjacent letters transposed, and
// in every pair it moves the letter whose box drops below the baseline (final ـي، ـئ، ـر، the hamza
// under an alif). See `expectArabicPhrase`.
const POPPLER =
  'المعرفالجبايئA/T/000/1180000: أمررشاء المنصةنكسوراإلدارةالمخزون المجموعمعالرضيبة طريقةالدفعتحويلبنيك';
const XPDF =
  'المعرف الجبائي A/T/000/1180000: أمر شراء منصة نكسورا لإدارة المخزون المجموع مع الضريبة طريقة الدفع تحويل بنكي';

describe('printed Arabic phrase matching', () => {
  it.each([XPDF, POPPLER])('finds every phrase a reader reconstructs', (text) => {
    for (const phrase of [
      'أمر شراء',
      'المعرف الجبائي',
      'المجموع مع الضريبة',
      'تحويل بنكي',
      'لإدارة المخزون',
    ]) {
      expect(() => expectArabicPhrase(text, phrase)).not.toThrow();
    }
  });

  it('rejects a word that is missing a letter', () => {
    expect(() => expectArabicPhrase('أمر شرا', 'أمر شراء')).toThrow(/missing the phrase/);
  });

  it('rejects a word with a substituted letter', () => {
    expect(() => expectArabicPhrase('المعرف الجبايئ', 'المورد')).toThrow(/missing the phrase/);
  });

  it('refuses a phrase with no Arabic letters to match against', () => {
    expect(() => expectArabicPhrase(XPDF, 'Total excl. tax')).toThrow(/needs an Arabic phrase/);
  });

  it('compares an English label the reader glued together against the catalog phrase', () => {
    expect(withoutSpaces('Totalexcl.tax')).toContain(withoutSpaces('Total excl. tax'));
  });
});
