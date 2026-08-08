export type Preset = 'today' | 'yesterday' | '7d' | '30d' | 'this_month'

function iso(d: Date): string { return d.toISOString().slice(0, 10) }
function addDays(ymd: string, n: number): string {
  const d = new Date(ymd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d)
}

export function presetRange(preset: Preset, now = new Date()): { from: string; to: string } {
  // gunakan tanggal lokal Asia/Jakarta (UTC+7)
  const jkt = new Date(now.getTime() + 7 * 3600 * 1000)
  const todayStr = jkt.toISOString().slice(0, 10)
  
  if (preset === 'yesterday') {
    const yesterday = addDays(todayStr, -1)
    return { from: yesterday, to: yesterday }
  }
  
  if (preset === 'this_month') {
    const mm = String(jkt.getUTCMonth() + 1).padStart(2, '0')
    const yyyy = jkt.getUTCFullYear()
    return { from: `${yyyy}-${mm}-01`, to: todayStr }
  }
  
  const span = preset === 'today' ? 0 : preset === '7d' ? 6 : 29
  return { from: addDays(todayStr, -span), to: todayStr }
}

export function previousRange(range: { from: string; to: string }): { from: string; to: string } {
  const days = Math.round((Date.parse(range.to) - Date.parse(range.from)) / 86400000) + 1
  return { from: addDays(range.from, -days), to: addDays(range.from, -1) }
}

/** Rentang tanggal 1 bulan kalender penuh. `month` 1-indexed (1=Januari). */
export function monthRange(year: number, month: number): { from: string; to: string } {
  const mm = String(month).padStart(2, '0')
  const lastDay = new Date(year, month, 0).getDate()
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(lastDay).padStart(2, '0')}` }
}
