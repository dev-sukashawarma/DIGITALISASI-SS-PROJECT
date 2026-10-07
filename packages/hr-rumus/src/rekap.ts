import { daftarTanggal, tanggalWib } from './waktu'

export type BarisHadir = { outlet_staff_id: string; ts_server: string; status: string }

/** Aturan "alpha virtual" layar Rekap absensi — satu-satunya sumber. */
export function alpaVirtual(
  staff: { id: string; name: string }[],
  baris: BarisHadir[],
  dari: string,
  sampai: string,
  hariIni: string,
  dikecualikan?: (staffId: string, tanggal: string) => boolean,
): { staffId: string; nama: string; tanggal: string }[] {
  const hadir = new Set<string>()
  for (const r of baris) {
    if (r.status === 'alpha') continue
    hadir.add(`${r.outlet_staff_id}|${tanggalWib(new Date(r.ts_server))}`)
  }
  const hasil: { staffId: string; nama: string; tanggal: string }[] = []
  for (const t of daftarTanggal(dari, sampai)) {
    if (t > hariIni) continue
    for (const s of staff) if (!hadir.has(`${s.id}|${t}`) && !dikecualikan?.(s.id, t)) hasil.push({ staffId: s.id, nama: s.name, tanggal: t })
  }
  return hasil
}

/** Jumlah hari yang dinilai Rekap: dari..sampai, dipotong di hari ini. */
export function jumlahHariRekap(dari: string, sampai: string, hariIni: string): number {
  return daftarTanggal(dari, sampai < hariIni ? sampai : hariIni).length
}

/** Alpa satu staf bila jumlah hari hadirnya (hari WIB berbeda dengan absen non-alpha) sudah diketahui. */
export function alpaDariHariHadir(dari: string, sampai: string, hariIni: string, hariHadir: number, hariDikecualikan = 0): number {
  return Math.max(0, jumlahHariRekap(dari, sampai, hariIni) - hariHadir - hariDikecualikan)
}
