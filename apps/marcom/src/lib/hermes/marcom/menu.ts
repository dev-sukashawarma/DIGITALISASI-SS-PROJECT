import type { KonteksMarcom } from './tipe'
import { batasi, cocok, metaDasar } from './bantu'

export interface ParameterMenu {
  cari?: string
  kategori?: string
  hanya_tersedia?: boolean
  limit?: number
}

export async function hitungMenu(konteks: KonteksMarcom, params: ParameterMenu = {}) {
  const { menu, promo } = await konteks.daftarMenu()
  const hariIni = konteks.hariIni
  const daftar = menu
    .filter((m) => cocok(m.nama, params.cari) && cocok(m.kategori, params.kategori))
    .filter((m) => !params.hanya_tersedia || m.tersedia)
  const promoBerlaku = promo.filter(
    (p) =>
      (!p.mulai || p.mulai.slice(0, 10) <= hariIni) &&
      (!p.selesai || p.selesai.slice(0, 10) >= hariIni) &&
      (!params.cari || p.cakupan === 'global' || cocok(p.menu_nama, params.cari))
  )
  return {
    ringkasan: {
      total_menu: daftar.length,
      tersedia: daftar.filter((m) => m.tersedia).length,
      tampil_di_app: daftar.filter((m) => m.tampil_di_app).length,
      paket: daftar.filter((m) => m.paket).length,
      kampanye_aktif: daftar.filter((m) => m.kampanye_aktif).length,
      promo_berlaku_hari_ini: promoBerlaku.length,
    },
    daftar: daftar.slice(0, batasi(params.limit, 50, 200)),
    promo_berlaku: promoBerlaku.slice(0, 50),
    meta: metaDasar(konteks.sekarang, {
      sumber: 'Menu POS (Supabase), sama dengan layar Menu Marcom',
      tanggal: hariIni,
      catatan: 'HPP & data penjualan tidak termasuk.',
    }),
  }
}
