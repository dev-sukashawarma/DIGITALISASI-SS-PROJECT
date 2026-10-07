// Indonesia (WIB) tetap UTC+7 tanpa DST — aritmetika offset tetap aman & tanpa dependency.
const WIB_MS = 7 * 60 * 60 * 1000
const HARI_MS = 24 * 60 * 60 * 1000

/** Tanggal kalender WIB (YYYY-MM-DD) dari sebuah instan. */
export function tanggalWib(d: Date): string {
  return new Date(d.getTime() + WIB_MS).toISOString().slice(0, 10)
}

/** Menit sejak 00:00 WIB dari sebuah timestamp. */
export function menitWib(ts: string | Date): number {
  const d = new Date(new Date(ts).getTime() + WIB_MS)
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

/** Instan pada `tanggal` WIB jam `jamHHMM` (HH:MM atau HH:MM:SS) ditambah `tambahMenit`. */
export function batasWib(tanggal: string, jamHHMM: string, tambahMenit: number): Date {
  const [h, m] = jamHHMM.split(':').map(Number)
  return new Date(Date.parse(`${tanggal}T00:00:00+07:00`) + (h * 60 + m + tambahMenit) * 60_000)
}

export function tambahHari(tanggal: string, n: number): string {
  return new Date(Date.parse(`${tanggal}T00:00:00Z`) + n * HARI_MS).toISOString().slice(0, 10)
}

/** Semua tanggal dari `dari` s/d `sampai` (inklusif); kosong bila dari > sampai. */
export function daftarTanggal(dari: string, sampai: string): string[] {
  const hasil: string[] = []
  for (let t = dari; t <= sampai; t = tambahHari(t, 1)) hasil.push(t)
  return hasil
}
