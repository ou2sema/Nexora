/**
 * Produces the identifier shape the database enforces:
 * lowercase ascii words joined by single hyphens.
 */
export function slugify(input: string, maxLength = 80): string {
  const normalized = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  let slug = normalized;
  if (slug.length > maxLength) {
    const cut = slug.slice(0, maxLength);
    const cutMidWord = normalized[maxLength] !== '-' && !cut.endsWith('-');
    slug =
      cutMidWord && cut.includes('-') ? cut.slice(0, cut.lastIndexOf('-')) : cut.replace(/-+$/, '');
  }

  if (slug.length === 0) {
    throw new Error(`Cannot build a slug from "${input}"`);
  }

  return slug;
}
