/**
 * Biaya Ditanggung RAB (Rencana Anggaran Biaya pembukaan outlet baru).
 *
 * Keputusan owner 2026-11-05: HANYA INFORMASI. Angka di sini TIDAK BOLEH
 * dijumlahkan ke OPEX, laba outlet, laba perusahaan, maupun laporan mitra.
 * Sumbernya tabel `biaya_rab_outlet` (disinkron dari app Marcom), terpisah
 * total dari `expenses`. RLS hanya mengizinkan owner/admin/admin_finance/developer.
 *
 * File ini WAJIB identik di apps/admin-dashboard dan apps/finance (test paritas).
 */

export interface BiayaRabRow {
  marcom_expense_id: number
  outlet_id: string | null
  outlet_nama: string
  kategori: string
  kategori_label: string
  jumlah: number
  keterangan: string
  tanggal: string
  receipt_url: string | null
}

export interface RingkasanBiayaRab {
  total: number
  jumlahTransaksi: number
  perOutlet: Array<{ outletId: string | null; nama: string; total: number; jumlah: number }>
}

/**
 * Cocokkan baris RAB dengan target filter Buku Kas / Profit.
 * target: 'all' | 'PUSAT' | 'ALL_OUTLETS' | 'INTERNAL_OUTLETS' | 'MITRA_OUTLETS'
 *         | 'INTERNAL_PUSAT' | <uuid outlet>
 */
export function cocokTargetRab(
  outletId: string | null,
  target: string,
  mitraIds: ReadonlySet<string>
): boolean {
  if (!target || target === 'all' || target === 'ALL') return true
  if (target === 'PUSAT') return outletId === null
  if (target === 'ALL_OUTLETS') return outletId !== null
  if (target === 'MITRA_OUTLETS') return outletId !== null && mitraIds.has(outletId)
  if (target === 'INTERNAL_OUTLETS') return outletId !== null && !mitraIds.has(outletId)
  if (target === 'INTERNAL_PUSAT') return outletId === null || !mitraIds.has(outletId)
  return outletId === target
}

export function ringkasBiayaRab(rows: BiayaRabRow[]): RingkasanBiayaRab {
  const map = new Map<string, { outletId: string | null; nama: string; total: number; jumlah: number }>()
  let total = 0
  for (const r of rows) {
    const jumlah = Number(r.jumlah) || 0
    total += jumlah
    const key = r.outlet_id ?? '__pusat__'
    const cur = map.get(key) ?? { outletId: r.outlet_id, nama: r.outlet_nama, total: 0, jumlah: 0 }
    cur.total += jumlah
    cur.jumlah += 1
    map.set(key, cur)
  }
  return {
    total,
    jumlahTransaksi: rows.length,
    perOutlet: [...map.values()].sort((a, b) => b.total - a.total),
  }
}
