export function statusPantau(statuses: readonly string[]): 'below' | 'warning' | 'unknown' | 'ok' {
  if (statuses.includes('below')) return 'below'
  if (statuses.includes('warning')) return 'warning'
  if (statuses.some(status => status !== 'ok')) return 'unknown'
  return 'ok'
}
