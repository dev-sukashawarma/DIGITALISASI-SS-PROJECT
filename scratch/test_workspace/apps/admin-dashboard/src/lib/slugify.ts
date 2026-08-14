export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents (combining diacritics)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // non-alphanumeric → dash
    .replace(/^-+|-+$/g, '') // trim dashes
}
