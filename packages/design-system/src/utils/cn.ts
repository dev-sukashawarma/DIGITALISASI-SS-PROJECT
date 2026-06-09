// Classname merger utility (simple version without external deps)
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes
    .filter((cls): cls is string => typeof cls === 'string')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}
