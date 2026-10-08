import type { KolData, KonteksMarcom } from './tipe'
import { batasi, cocok, metaDasar } from './bantu'

export interface ParameterKol {
  nama?: string
  outlet?: string
  limit?: number
}

export async function hitungKol(konteks: KonteksMarcom, params: ParameterKol = {}) {
  const semua = await konteks.daftarKol()
  const terfilter = semua.filter(
    (k: KolData) =>
      cocok(k.nama, params.nama) &&
      (!params.outlet || k.endorsement.outlet.some((o) => cocok(o, params.outlet)))
  )
  const urut = [...terfilter].sort(
    (a, b) => b.endorsement.total - a.endorsement.total || a.nama.localeCompare(b.nama)
  )
  return {
    ringkasan: {
      total_kol: terfilter.length,
      pernah_kerja_sama: terfilter.filter((k) => k.endorsement.total > 0).length,
      total_rate_card: terfilter.reduce((s, k) => s + k.endorsement.total_rate_card, 0),
      total_views: terfilter.reduce((s, k) => s + k.endorsement.total_views, 0),
    },
    daftar: urut.slice(0, batasi(params.limit, 20)),
    meta: metaDasar(konteks.sekarang, {
      catatan: 'Nomor HP & rekening KOL tidak dibagikan; hanya penanda punya_kontak/punya_rekening.',
    }),
  }
}
