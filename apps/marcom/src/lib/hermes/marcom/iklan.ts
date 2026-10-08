import type { KonteksMarcom } from './tipe'
import { tentukanRentangTanggal } from './konten'
import { batasi, cocok, kelompokkan, metaDasar } from './bantu'

export interface ParameterIklan {
  periode?: string
  dari?: string
  sampai?: string
  outlet?: string
  platform?: string
  kategori?: string
  status?: string
  limit?: number
}

function sama(a: string | null, b?: string): boolean {
  return !b || (a || '').toUpperCase() === b.toUpperCase()
}

export async function hitungIklan(konteks: KonteksMarcom, params: ParameterIklan = {}) {
  const r = tentukanRentangTanggal(konteks.hariIni, params.periode || 'bulan_ini', params.dari, params.sampai)
  const semua = await konteks.daftarIklan(r.dari, r.sampai)
  const daftar = semua
    .filter((a) => !params.outlet || cocok(a.outlet_nama, params.outlet) || cocok(a.akun, params.outlet))
    .filter((a) => sama(a.platform, params.platform) && sama(a.kategori, params.kategori) && sama(a.status, params.status))
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal))
  const totalViews = daftar.reduce((s, a) => s + (a.views_akhir ?? a.views_awal ?? 0), 0)
  const totalSpent = daftar.reduce((s, a) => s + a.spent, 0)
  return {
    ringkasan: {
      jumlah_iklan: daftar.length,
      sedang_on: daftar.filter((a) => a.status === 'ON').length,
      total_budget: daftar.reduce((s, a) => s + a.budget, 0),
      total_spent: totalSpent,
      total_views: totalViews,
      biaya_per_1000_views: totalViews > 0 ? Math.round((totalSpent / totalViews) * 1000) : null,
      per_platform: kelompokkan(daftar, (a) => a.platform, (a) => a.spent),
      per_akun: kelompokkan(daftar, (a) => a.akun || a.outlet_nama, (a) => a.spent),
      per_kategori: kelompokkan(daftar, (a) => a.kategori, (a) => a.spent),
    },
    daftar: daftar.slice(0, batasi(params.limit, 30)),
    meta: metaDasar(konteks.sekarang, { periode: r.namaPeriode, dari: r.dari, sampai: r.sampai }),
  }
}
