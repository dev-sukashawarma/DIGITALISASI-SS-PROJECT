import type { CashKind, LocationWithBalance } from '../types'

/**
 * Tiga rekening kas pusat (masing-masing sisi Bank & Cash). Sumber kebenaran: `cash_location.grup`.
 *   utama       — omzet transfer outlet; ditransfer ke Bahan Baku Bank
 *   bahan_baku  — omzet tunai; bayar bahan baku & payroll
 *   petty_cash  — receh setoran & income lainnya; pencairan petty cash outlet
 */
export type GrupKas = 'utama' | 'bahan_baku' | 'petty_cash'

export const URUTAN_GRUP: GrupKas[] = ['utama', 'bahan_baku', 'petty_cash']

export const GRUP_LABEL: Record<GrupKas, string> = {
  utama: 'Rekening Utama',
  bahan_baku: 'Rekening Bahan Baku',
  petty_cash: 'Rekening Petty Cash',
}

export interface RingkasanGrup {
  bank: number
  tunai: number
  total: number
}

type LokasiMin = Pick<LocationWithBalance, 'grup' | 'kind' | 'is_active'>

/** Lokasi aktif dalam satu grup, opsional disaring per jenis (bank/cash). */
export function lokasiGrup<T extends LokasiMin>(locs: T[], grup: GrupKas, kind?: CashKind): T[] {
  return locs.filter((l) => l.is_active !== false && l.grup === grup && (!kind || l.kind === kind))
}

/** Tujuan setoran outlet: transfer → Rekening Utama (bank), tunai → Rekening Bahan Baku (cash). Sama dengan DB. */
export function lokasiTujuanSetoran<T extends LokasiMin>(locs: T[], kind: CashKind): T[] {
  return lokasiGrup(locs, kind === 'bank' ? 'utama' : 'bahan_baku', kind)
}

export function ringkasGrup(locs: LocationWithBalance[]): Record<GrupKas, RingkasanGrup> {
  const hasil = Object.fromEntries(
    URUTAN_GRUP.map((g) => [g, { bank: 0, tunai: 0, total: 0 }]),
  ) as Record<GrupKas, RingkasanGrup>
  for (const l of locs) {
    if (l.is_active === false || !l.grup || !(l.grup in hasil)) continue
    const r = hasil[l.grup]
    const saldo = Number(l.saldo) || 0
    if (l.kind === 'bank') r.bank += saldo
    else r.tunai += saldo
    r.total += saldo
  }
  return hasil
}
