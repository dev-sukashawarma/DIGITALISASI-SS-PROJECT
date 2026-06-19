export type Preset = 'today' | '7d' | '30d'

function iso(d: Date): string { return d.toISOString().slice(0, 10) }
function addDays(ymd: string, n: number): string {
  const d = new Date(ymd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d)
}

export function presetRange(preset: Preset, now = new Date()): { from: string; to: string } {
  // gunakan tanggal lokal Asia/Jakarta (UTC+7)
  const jkt = new Date(now.getTime() + 7 * 3600 * 1000)
  const to = jkt.toISOString().slice(0, 10)
  const span = preset === 'today' ? 0 : preset === '7d' ? 6 : 29
  return { from: addDays(to, -span), to }
}

export function previousRange(range: { from: string; to: string }): { from: string; to: string } {
  const days = Math.round((Date.parse(range.to) - Date.parse(range.from)) / 86400000) + 1
  return { from: addDays(range.from, -days), to: addDays(range.from, -1) }
}
