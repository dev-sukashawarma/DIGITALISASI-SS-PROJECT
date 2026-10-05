import { addDaysStr, isDateStr } from '@/lib/ownerDashboardCache'

export type KodePeriode = 'hari_ini' | 'kemarin' | 'minggu_ini' | 'minggu_lalu' | 'bulan_ini' | 'bulan_lalu' | 'rentang'
export interface Periode { dari: string; sampai: string; label: string; berjalan: boolean }

const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const NAMA: Record<KodePeriode, string> = {
  hari_ini: 'Hari ini', kemarin: 'Kemarin', minggu_ini: 'Minggu ini', minggu_lalu: 'Minggu lalu',
  bulan_ini: 'Bulan ini', bulan_lalu: 'Bulan lalu', rentang: 'Rentang',
}
const MAKS_HARI_RENTANG = 366

const hariKe = (ymd: string) => new Date(`${ymd}T00:00:00Z`).getUTCDay()
const senin = (ymd: string) => addDaysStr(ymd, -((hariKe(ymd) + 6) % 7))
const awalBulan = (ymd: string) => `${ymd.slice(0, 8)}01`
const selisihHari = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)

export function labelTanggal(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return `${HARI[hariKe(ymd)]} ${d} ${BULAN[m - 1]} ${y}`
}

function buat(kode: KodePeriode, dari: string, sampai: string, berjalan: boolean): Periode {
  const rentang = dari === sampai ? labelTanggal(dari) : `${labelTanggal(dari)} – ${labelTanggal(sampai)}`
  return { dari, sampai, berjalan, label: `${NAMA[kode]} (${rentang})` }
}

export function resolvePeriode(kode: KodePeriode, hariIni: string, rentang?: { dari?: string; sampai?: string }): Periode {
  switch (kode) {
    case 'hari_ini': return buat(kode, hariIni, hariIni, true)
    case 'kemarin': { const k = addDaysStr(hariIni, -1); return buat(kode, k, k, false) }
    case 'minggu_ini': return buat(kode, senin(hariIni), hariIni, true)
    case 'minggu_lalu': { const s = addDaysStr(senin(hariIni), -7); return buat(kode, s, addDaysStr(s, 6), false) }
    case 'bulan_ini': return buat(kode, awalBulan(hariIni), hariIni, true)
    case 'bulan_lalu': { const akhir = addDaysStr(awalBulan(hariIni), -1); return buat(kode, awalBulan(akhir), akhir, false) }
    case 'rentang': {
      const dari = rentang?.dari
      const sampaiMinta = rentang?.sampai ?? rentang?.dari
      if (!isDateStr(dari) || !isDateStr(sampaiMinta)) throw new Error('Tanggal rentang tidak valid (format YYYY-MM-DD)')
      const sampai = sampaiMinta > hariIni ? hariIni : sampaiMinta
      if (dari > sampai) throw new Error('Tanggal awal setelah tanggal akhir')
      if (selisihHari(dari, sampai) + 1 > MAKS_HARI_RENTANG) throw new Error('Rentang maksimal 366 hari')
      return buat(kode, dari, sampai, sampai === hariIni)
    }
  }
}

export function periodePembanding(kode: KodePeriode, p: Periode): Periode {
  if (kode === 'bulan_ini') {
    const akhirLalu = addDaysStr(p.dari, -1)
    const dari = awalBulan(akhirLalu)
    const target = addDaysStr(dari, selisihHari(p.dari, p.sampai))
    return buat('rentang', dari, target > akhirLalu ? akhirLalu : target, false)
  }
  if (kode === 'bulan_lalu') {
    const akhir = addDaysStr(p.dari, -1)
    return buat('bulan_lalu', awalBulan(akhir), akhir, false)
  }
  if (kode === 'rentang') {
    const panjang = selisihHari(p.dari, p.sampai) + 1
    return buat('rentang', addDaysStr(p.dari, -panjang), addDaysStr(p.dari, -1), false)
  }
  return buat('rentang', addDaysStr(p.dari, -7), addDaysStr(p.sampai, -7), false)
}
