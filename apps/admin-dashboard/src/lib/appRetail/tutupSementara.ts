import { statusOutlet } from './jamBuka'

export type PilihanSampai = 'tutup_hari_ini' | 'besok_buka' | 'kustom'

const WIB_MS = 7 * 60 * 60 * 1000
const HARI_MS = 24 * 60 * 60 * 1000

function jamPadaTanggalWib(dasar: Date, jam: string, tambahHari: number): Date {
  const awal = Math.floor((dasar.getTime() + WIB_MS) / HARI_MS) * HARI_MS - WIB_MS
  const [h, m] = jam.split(':').map(Number)
  return new Date(awal + tambahHari * HARI_MS + (h * 60 + m) * 60 * 1000)
}

export function hitungSampai(
  p: PilihanSampai, sekarang: Date, closeHour: string | null, openHour: string | null, kustom: Date | null,
): Date {
  let hasil: Date
  if (p === 'kustom') {
    if (!kustom) throw new Error('Pilih tanggal & jam.')
    hasil = kustom
  } else if (p === 'tutup_hari_ini') {
    if (!closeHour) throw new Error('Outlet ini belum punya jam tutup.')
    hasil = jamPadaTanggalWib(sekarang, closeHour, 0)
  } else {
    if (!openHour) throw new Error('Outlet ini belum punya jam buka.')
    // "Besok buka" = pembukaan berikutnya menurut aturan yang sama dengan gateway.
    const s = statusOutlet({
      sekarang, openHour, closeHour, isActive: true, tutupSementara: [], menitPesanTerakhir: 0,
    })
    hasil = s.bukaLagi ?? jamPadaTanggalWib(sekarang, openHour, 1)
  }
  if (hasil.getTime() <= sekarang.getTime()) throw new Error('Waktu "sampai" sudah lewat.')
  return hasil
}
