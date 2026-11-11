/**
 * Ditanggung RAB (dana investasi / RAB pembukaan outlet).
 *
 * HANYA INFORMASI. Angka di sini TIDAK BOLEH dijumlahkan ke OPEX, laba outlet,
 * laba perusahaan, maupun laporan mitra. Sumbernya baris `expenses` ber-type
 * 'rab' (dari form Input Pengeluaran dan dari Marcom "Dana RAB") serta kas kecil
 * outlet `petty_cash_expenses` ber-type 'rab' (saldo kas kecil tetap berkurang); tabel lama
 * `biaya_rab_outlet` sudah pensiun (11 Nov 2026). Mitra boleh melihat RAB
 * outletnya sendiri (RLS `expenses_select_scoped`).
 *
 * File ini WAJIB identik di apps/admin-dashboard dan apps/finance (test paritas).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { TEST_OUTLET_ID } from '@/lib/outletFilters'
import { TIPE_RAB } from '@/lib/pengeluaran/rab'

export interface BiayaRabRow {
  id: string
  outlet_id: string | null
  outlet_nama: string
  kategori_label: string
  sumber: 'marcom' | 'input' | 'kas_kecil'
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

/** Satu baris mentah `petty_cash_expenses` (type 'rab') → BiayaRabRow. */
export function barisRabDariKasKecil(row: any): BiayaRabRow {
  return {
    id: String(row.id),
    outlet_id: row.outlet_id ?? null,
    outlet_nama: row.outlets?.name ?? 'Outlet Tidak Dikenal',
    kategori_label: 'Kas Kecil Outlet',
    sumber: 'kas_kecil',
    jumlah: Number(row.amount) || 0,
    keterangan: row.description ?? '',
    tanggal: row.expense_date,
    receipt_url: row.receipt_url ?? null,
  }
}

/** Satu baris mentah `expenses` (type 'rab') → BiayaRabRow. */
export function barisRabDariExpense(row: any): BiayaRabRow {
  const desc: string = row?.description ?? ''
  const marcom = desc.match(/^\[MARCOM:\s*([^\]]+)\]\s*(.*)$/)
  const keterangan = marcom ? marcom[2].replace(/\s*\(Alokasi:[^)]*\)\s*$/, '') : desc
  return {
    id: String(row.id),
    outlet_id: row.outlet_id ?? null,
    outlet_nama: row.outlets?.name ?? 'Outlet Tidak Dikenal',
    kategori_label: marcom ? `Marcom · ${marcom[1]}` : 'Input Pengeluaran',
    sumber: marcom ? 'marcom' : 'input',
    jumlah: Number(row.amount) || 0,
    keterangan,
    tanggal: row.expense_date,
    receipt_url: row.receipt_url ?? null,
  }
}

/**
 * Ambil baris RAB pada rentang tanggal (berhalaman sampai habis). Hak baca
 * mengikuti klien yang dipakai: klien pengguna tunduk RLS (mitra = outletnya).
 */
export async function ambilBiayaRab(
  supabase: SupabaseClient,
  rentang: { from: string; to: string; outletIds?: string[] }
): Promise<BiayaRabRow[]> {
  const PAGE = 1000
  const ambilSemua = async (tabel: 'expenses' | 'petty_cash_expenses', ubah: (row: any) => BiayaRabRow) => {
    const hasil: BiayaRabRow[] = []
    for (let mulai = 0; ; mulai += PAGE) {
      let q = supabase
        .from(tabel)
        .select('id, outlet_id, amount, description, expense_date, receipt_url, outlets(name)')
        .eq('type', TIPE_RAB)
        .neq('outlet_id', TEST_OUTLET_ID)
        .gte('expense_date', rentang.from)
        .lte('expense_date', rentang.to)
        .order('expense_date', { ascending: false })
        .order('id', { ascending: false })
      if (tabel === 'petty_cash_expenses') q = q.is('deleted_at', null)
      if (rentang.outletIds && rentang.outletIds.length > 0) q = q.in('outlet_id', rentang.outletIds)
      const { data, error } = await q.range(mulai, mulai + PAGE - 1)
      if (error) throw new Error(error.message)
      hasil.push(...(data ?? []).map(ubah))
      if (!data || data.length < PAGE) break
    }
    return hasil
  }
  const [dariExpenses, dariKasKecil] = await Promise.all([
    ambilSemua('expenses', barisRabDariExpense),
    ambilSemua('petty_cash_expenses', barisRabDariKasKecil),
  ])
  return [...dariExpenses, ...dariKasKecil].sort((a, b) => b.tanggal.localeCompare(a.tanggal))
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
