import type { KonteksMarcom } from './tipe'
import { cocok, metaDasar } from './bantu'

export interface ParameterTargetOutlet {
  bulan?: number
  tahun?: number
  outlet?: string
}

export async function hitungTargetOutlet(konteks: KonteksMarcom, params: ParameterTargetOutlet = {}) {
  const [thn, bln] = konteks.hariIni.split('-').map(Number)
  const bulan = params.bulan || bln
  const tahun = params.tahun || thn
  const daftar = (await konteks.daftarTargetOutlet(bulan, tahun)).filter((t) => cocok(t.outlet_nama, params.outlet))
  return {
    ringkasan: {
      jumlah_outlet: daftar.length,
      total_target_budget: daftar.reduce((s, t) => s + t.target_budget, 0),
      total_target_kol: daftar.reduce((s, t) => s + t.target_kol, 0),
    },
    daftar,
    meta: metaDasar(konteks.sekarang, {
      bulan,
      tahun,
      catatan: 'Realisasi vs target ada di alat marcom_ads_budget.',
    }),
  }
}
