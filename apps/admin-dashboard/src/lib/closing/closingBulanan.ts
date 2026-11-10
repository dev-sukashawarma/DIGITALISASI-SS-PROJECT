import { LABA_KOTOR_INTERNAL_CLOSING_SEPT_2026, type KomponenLabaKotor } from './labaKotorInternalClosingSeptember2026'
import { PENDAPATAN_MITRA_CLOSING_SEPT_2026, type PendapatanMitraClosing } from './pendapatanMitraClosingSeptember2026'
import { LABA_KOTOR_INTERNAL_CLOSING_OKT_2026, PENDAPATAN_MITRA_CLOSING_OKT_2026 } from './closingOktober2026'

/* Closing bulanan Laba Rugi Internal (semua outlet): daftar bulan yang angkanya
 * mengikuti laporan resmi. Hanya berlaku untuk rentang tepat satu bulan penuh. */

interface BulanLabaKotor {
  label: string
  from: string
  to: string
  total: KomponenLabaKotor
  /** null = pendapatan lain-lain tetap data apa adanya. */
  pendapatanLain: number | null
}

const BULAN_LABA_KOTOR: BulanLabaKotor[] = [
  { label: 'September 2026', ...pick(LABA_KOTOR_INTERNAL_CLOSING_SEPT_2026), pendapatanLain: null },
  { label: LABA_KOTOR_INTERNAL_CLOSING_OKT_2026.label, ...pick(LABA_KOTOR_INTERNAL_CLOSING_OKT_2026), pendapatanLain: LABA_KOTOR_INTERNAL_CLOSING_OKT_2026.pendapatanLain },
]

const BULAN_PENDAPATAN_MITRA: { from: string; to: string; outlets: Record<string, PendapatanMitraClosing> }[] = [
  PENDAPATAN_MITRA_CLOSING_SEPT_2026,
  PENDAPATAN_MITRA_CLOSING_OKT_2026,
]

function pick(d: { from: string; to: string; total: KomponenLabaKotor }) {
  return { from: d.from, to: d.to, total: d.total }
}

export interface PenyesuaianLabaKotor extends KomponenLabaKotor {
  /** Nama bulan closing, untuk label baris penyesuaian. */
  label: string
  /** Pendapatan lain-lain versi closing; null = pakai data apa adanya. */
  pendapatanLain: number | null
}

/** Penyesuaian (target − live) per komponen untuk bulan closing.
 *  komisiTiktokKedua tidak punya padanan live, jadi nilainya = target penuh. */
export function penyesuaianLabaKotorClosing(
  from: string,
  to: string,
  live: { omzet: number; potongan: number; hpp: number; waste: number },
): PenyesuaianLabaKotor | null {
  const b = BULAN_LABA_KOTOR.find(m => m.from === from && m.to === to)
  if (!b) return null
  return {
    label: b.label,
    pendapatanLain: b.pendapatanLain,
    omzet: b.total.omzet - live.omzet,
    potongan: b.total.potongan - live.potongan,
    komisiTiktokKedua: b.total.komisiTiktokKedua,
    hpp: b.total.hpp - live.hpp,
    waste: b.total.waste - live.waste,
  }
}

/** Total pendapatan pusat dari mitra versi closing untuk bulan closing. */
export function pendapatanMitraClosingUntuk(from: string, to: string): { feeManajemen: number; marginHpp: number } | null {
  const p = BULAN_PENDAPATAN_MITRA.find(m => m.from === from && m.to === to)
  if (!p) return null
  let feeManajemen = 0
  let marginHpp = 0
  for (const o of Object.values(p.outlets)) {
    feeManajemen += o.bagiHasilSs
    marginHpp += o.marginHpp
  }
  return { feeManajemen, marginHpp }
}
