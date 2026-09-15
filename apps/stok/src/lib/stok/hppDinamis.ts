// Fungsi murni untuk panel HPP Dinamis (spec 2026-09-15 §4). Tanpa I/O.

export type SumberHarga = 'kiriman' | 'drop_ship' | 'master_historis' | 'master_sekarang' | 'tidak_ada'

export const SUMBER_URUT: SumberHarga[] = ['kiriman', 'drop_ship', 'master_historis', 'master_sekarang', 'tidak_ada']

export const LABEL_SUMBER: Record<SumberHarga, string> = {
  kiriman: 'Kiriman gudang',
  drop_ship: 'Drop-ship vendor',
  master_historis: 'Harga master (riwayat)',
  master_sekarang: 'Harga master (sekarang)',
  tidak_ada: 'Tanpa harga',
}

/** Batas jujur data snapshot kiriman — sebelum ini HPP praktis memakai harga master. */
export const TANGGAL_MULAI_SNAPSHOT = '2026-09-01'

export interface HppDinamisBahanRow {
  bahan_baku_id: string
  nama_bahan: string
  satuan: string
  satuan_kecil: string | null
  is_gram: boolean
  qty_pemakaian: number
  nilai: number
  sumber_harga_terakhir: SumberHarga
  ref_id_terakhir: string | null
  ref_tanggal_terakhir: string | null
  nilai_kiriman: number | null
  nilai_drop_ship: number | null
  nilai_master_historis: number | null
  nilai_master_sekarang: number | null
  nilai_tidak_ada: number | null
}

export interface HppDinamisMenuRow {
  menu_item_id: string
  menu_nama: string
  harga_jual: number
  qty_terjual: number
  punya_resep: boolean
  hpp_override_unit: number
  hpp_override_total: number
  hpp_teoritis_total: number | null
  hpp_teoritis_unit: number | null
}

export interface RingkasanHppDinamis {
  totalOverride: number
  totalTeoritis: number
  totalAktual: number
  porsi: Record<SumberHarga, number>
  menuTanpaResep: number
  selisihTeoritisVsOverridePct: number | null
  selisihAktualVsTeoritisPct: number | null
}

export function selisihPct(nilai: number, acuan: number): number | null {
  if (!(acuan > 0)) return null
  return ((nilai - acuan) / acuan) * 100
}

export function periodeSebelumSnapshot(from: string): boolean {
  return from < TANGGAL_MULAI_SNAPSHOT
}

const n = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

export function ringkasHppDinamis(menu: HppDinamisMenuRow[], bahan: HppDinamisBahanRow[]): RingkasanHppDinamis {
  const totalOverride = menu.reduce((s, m) => s + n(m.hpp_override_total), 0)
  const berResep = menu.filter((m) => m.punya_resep)
  const totalTeoritis = berResep.reduce((s, m) => s + n(m.hpp_teoritis_total), 0)
  const overrideBerResep = berResep.reduce((s, m) => s + n(m.hpp_override_total), 0)
  const totalAktual = bahan.reduce((s, b) => s + n(b.nilai), 0)

  const perSumber: Record<SumberHarga, number> = { kiriman: 0, drop_ship: 0, master_historis: 0, master_sekarang: 0, tidak_ada: 0 }
  for (const b of bahan) {
    perSumber.kiriman += n(b.nilai_kiriman)
    perSumber.drop_ship += n(b.nilai_drop_ship)
    perSumber.master_historis += n(b.nilai_master_historis)
    perSumber.master_sekarang += n(b.nilai_master_sekarang)
    perSumber.tidak_ada += n(b.nilai_tidak_ada)
  }
  const porsi = { ...perSumber }
  for (const k of SUMBER_URUT) porsi[k] = totalAktual > 0 ? (perSumber[k] / totalAktual) * 100 : 0

  return {
    totalOverride,
    totalTeoritis,
    totalAktual,
    porsi,
    menuTanpaResep: menu.length - berResep.length,
    selisihTeoritisVsOverridePct: selisihPct(totalTeoritis, overrideBerResep),
    selisihAktualVsTeoritisPct: selisihPct(totalAktual, totalTeoritis),
  }
}
