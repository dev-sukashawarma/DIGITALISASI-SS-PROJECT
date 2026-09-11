// Periode tagihan tetap kalender untuk vendor drop-ship (spec §4.4).
// CERMIN fungsi SQL public.periode_tagihan() di migration 20260911120000 —
// ubah keduanya bersamaan. Task 2 memuat uji kesetaraan kasus-kasus di bawah.
export type PeriodeTagihan = { mulai: string; akhir: string; tanggalTagihan: string }

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function hariTerakhir(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate() // m 1-based: hari 0 bulan berikut
}

export function periodeTagihan(tanggalISO: string): PeriodeTagihan {
  const [y, m, d] = tanggalISO.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d || m > 12 || d > 31) throw new Error(`Tanggal tidak valid: ${tanggalISO}`)
  if (d <= 10) return { mulai: iso(y, m, 1), akhir: iso(y, m, 10), tanggalTagihan: iso(y, m, 10) }
  if (d <= 20) return { mulai: iso(y, m, 11), akhir: iso(y, m, 20), tanggalTagihan: iso(y, m, 20) }
  const last = hariTerakhir(y, m)
  return { mulai: iso(y, m, 21), akhir: iso(y, m, last), tanggalTagihan: iso(y, m, last) }
}

export function daftarTanggalTagihan(hariIniISO: string, jumlah: number): string[] {
  const hasil: string[] = []
  let cursor = periodeTagihan(hariIniISO)
  while (hasil.length < jumlah) {
    hasil.push(cursor.tanggalTagihan)
    const [y, m, d] = cursor.mulai.split('-').map(Number)
    const sebelum = new Date(Date.UTC(y, m - 1, d - 1)) // sehari sebelum periode ini mulai
    cursor = periodeTagihan(sebelum.toISOString())
  }
  return hasil
}
