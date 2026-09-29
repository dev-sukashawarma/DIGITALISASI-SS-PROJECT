/**
 * Kalender resmi Google "Hari Libur di Indonesia" (feed ICS publik, tanpa API key).
 * API komunitas (api-harilibur, dayoffapi) sudah mati per 2026-09 — jangan dipakai.
 */
export const HARI_LIBUR_ICS_URL =
  'https://calendar.google.com/calendar/ical/id.indonesian%23holiday%40group.v.calendar.google.com/public/basic.ics'

export type JenisHariLibur = 'libur_nasional' | 'cuti_bersama' | 'manual'

export interface HariLiburFeed {
  tanggal: string // YYYY-MM-DD
  nama: string
  jenis: Exclude<JenisHariLibur, 'manual'>
  tentatif: boolean
}

function unescapeIcs(v: string): string {
  return v.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\').trim()
}

/**
 * Ambil hanya "Hari libur nasional" (termasuk cuti bersama); entri "Perayaan"
 * (1 Ramadan, Malam Tahun Baru, dll.) bukan tanggal merah → dibuang.
 * Dua entri di tanggal yang sama digabung namanya.
 */
export function parseHariLiburIcs(ics: string): HariLiburFeed[] {
  // RFC 5545: baris lanjutan diawali spasi/tab → gabungkan
  const text = ics.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '')
  const byDate = new Map<string, HariLiburFeed>()

  for (const block of text.split('BEGIN:VEVENT').slice(1)) {
    const field = (name: string) => {
      const m = new RegExp(`^${name}(?:;[^:\\n]*)?:(.*)$`, 'm').exec(block)
      return m ? unescapeIcs(m[1]) : ''
    }
    const desc = field('DESCRIPTION').toLowerCase()
    if (!desc.startsWith('hari libur nasional')) continue

    const raw = field('DTSTART').replace(/[^0-9]/g, '').slice(0, 8)
    if (raw.length !== 8) continue
    const tanggal = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`

    let nama = field('SUMMARY')
    const tentatif = desc.includes('tentatif') || /belum pasti/i.test(nama)
    nama = nama.replace(/\s*\(belum pasti\)\s*/i, '').trim()
    const lower = nama.toLowerCase()
    const cutiBersama = lower.startsWith('cuti bersama') || lower.startsWith('joint holiday')

    const prev = byDate.get(tanggal)
    if (prev) {
      if (!prev.nama.includes(nama)) prev.nama = `${prev.nama} / ${nama}`
      // satu saja yang libur nasional → tanggal itu libur nasional
      if (!cutiBersama) prev.jenis = 'libur_nasional'
      prev.tentatif = prev.tentatif || tentatif
    } else {
      byDate.set(tanggal, { tanggal, nama, jenis: cutiBersama ? 'cuti_bersama' : 'libur_nasional', tentatif })
    }
  }
  return Array.from(byDate.values()).sort((a, b) => a.tanggal.localeCompare(b.tanggal))
}
