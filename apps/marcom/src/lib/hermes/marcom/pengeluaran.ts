import type { KonteksMarcom } from './tipe'
import { tentukanRentangTanggal } from './konten'
import { batasi, cocok, kelompokkan, metaDasar } from './bantu'

export interface ParameterPengeluaran {
  periode?: string
  dari?: string
  sampai?: string
  outlet?: string
  kategori?: string
  limit?: number
}

export async function hitungPengeluaran(konteks: KonteksMarcom, params: ParameterPengeluaran = {}) {
  const r = tentukanRentangTanggal(konteks.hariIni, params.periode || 'bulan_ini', params.dari, params.sampai)
  const semua = await konteks.daftarPengeluaran(r.dari, r.sampai)
  const daftar = semua
    .filter((p) => cocok(p.outlet_nama, params.outlet))
    .filter((p) => !params.kategori || p.kategori.toUpperCase() === params.kategori.toUpperCase())
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal))
  return {
    ringkasan: {
      total: daftar.reduce((s, p) => s + p.jumlah, 0),
      jumlah_transaksi: daftar.length,
      per_kategori: kelompokkan(daftar, (p) => p.kategori, (p) => p.jumlah),
      per_outlet: kelompokkan(daftar, (p) => p.outlet_nama, (p) => p.jumlah),
      per_sumber_dana: kelompokkan(daftar, (p) => p.sumber_dana, (p) => p.jumlah),
    },
    daftar: daftar.slice(0, batasi(params.limit, 50)),
    meta: metaDasar(konteks.sekarang, { periode: r.namaPeriode, dari: r.dari, sampai: r.sampai }),
  }
}
