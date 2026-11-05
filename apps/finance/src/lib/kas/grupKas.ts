import type { CashKind, LocationWithBalance } from '../types'

/** Dua kelompok besar kas pusat. Sumber kebenaran: kolom `cash_location.grup`. */
export type GrupKas = 'setoran_outlet' | 'office'

export const GRUP_LABEL: Record<GrupKas, string> = {
  setoran_outlet: 'Kas Setoran Outlet',
  office: 'Kas Office',
}

export interface RingkasanGrup {
  bank: number
  tunai: number
  total: number
}

/** Lokasi aktif dalam satu grup, opsional disaring per jenis (bank/cash). */
export function lokasiGrup<T extends Pick<LocationWithBalance, 'grup' | 'kind' | 'is_active'>>(
  locs: T[],
  grup: GrupKas,
  kind?: CashKind,
): T[] {
  return locs.filter((l) => l.is_active !== false && l.grup === grup && (!kind || l.kind === kind))
}

export function ringkasGrup(locs: LocationWithBalance[]): Record<GrupKas, RingkasanGrup> {
  const hasil: Record<GrupKas, RingkasanGrup> = {
    setoran_outlet: { bank: 0, tunai: 0, total: 0 },
    office: { bank: 0, tunai: 0, total: 0 },
  }
  for (const l of locs) {
    if (l.is_active === false || !l.grup) continue
    const r = hasil[l.grup]
    const saldo = Number(l.saldo) || 0
    if (l.kind === 'bank') r.bank += saldo
    else r.tunai += saldo
    r.total += saldo
  }
  return hasil
}
