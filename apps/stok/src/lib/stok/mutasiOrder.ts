/**
 * Mutasi ledger yang lahir dari order POS: potongan BOM (`pemakaian`) dan
 * pembaliknya saat order dibatalkan (`adjustment` positif ber-`ref_order_id`).
 *
 * Aturan "Pemakaian POS" sebuah periode opname (sama dengan RPC
 * `pemakaian_resep_harian`): setiap order DIATRIBUSIKAN KE PERIODE TEMPAT
 * POTONGAN PERTAMANYA terjadi, dan nilainya = neto SELURUH mutasinya — di
 * periode mana pun pembaliknya tertulis.
 *
 * Kenapa tidak cukup menetokan baris yang kebetulan jatuh di periode:
 * - Pembatalan sering datang terlambat (MITRA CIBUBUR #29: dipotong 20 Okt
 *   21:55, dibatalkan 22 Okt 11:14 karena salah input ulang). Potongannya
 *   tidak pernah terjadi secara fisik, jadi periode 20 Okt-lah yang salah.
 * - Pembalik order lama yang jatuh di periode baru BUKAN barang masuk dan
 *   bukan koreksi periode baru: Saldo Awal periode baru diambil dari hitungan
 *   fisik opname sebelumnya, yang sudah mencerminkan kenyataan. Menetokannya
 *   per bahan memakan pemakaian order baru (Cibubur 21 Okt: 9 order 6–19 Okt
 *   dibatalkan pagi hari → Pemakaian POS hampir semua bahan jadi 0);
 *   menambahkannya ke stok sistem membuat selisih tampak lebih minus.
 */
export function isMutasiOrder(row: { tipe: string; ref_order_id?: string | null }): boolean {
  return !!row.ref_order_id && (row.tipe === 'pemakaian' || row.tipe === 'adjustment')
}

export type BarisMutasi = {
  tipe: string
  qty: number | string | null
  created_at: string
  ref_order_id?: string | null
  bahan_baku_id?: string | null
}

/**
 * Pemakaian POS per bahan dalam periode [startIso, endIso].
 *
 * `rows` = baris ledger periode itu DITAMBAH semua baris pemakaian/adjustment
 * milik order yang dipotong di periode itu, di luar periode sekalipun
 * (pembalik yang datang belakangan). Baris order yang potongan pertamanya di
 * luar periode diabaikan. Pemakaian tanpa order dihitung bila di dalam periode.
 */
export function pemakaianPosPerBahan(
  rows: BarisMutasi[],
  startIso: string,
  endIso: string
): Map<string, number> {
  const start = Date.parse(startIso)
  const end = Date.parse(endIso)
  const diPeriode = (iso: string) => {
    const t = Date.parse(iso)
    return t >= start && t <= end
  }

  const out = new Map<string, number>()
  const tambah = (bahan: string, qty: number) => out.set(bahan, (out.get(bahan) || 0) + qty)

  const potonganPertama = new Map<string, number>()
  const netoOrder = new Map<string, Map<string, number>>()
  for (const row of rows) {
    const bahan = row.bahan_baku_id || ''
    const qty = Number(row.qty || 0)
    if (isMutasiOrder(row)) {
      const id = row.ref_order_id as string
      if (row.tipe === 'pemakaian') {
        const t = Date.parse(row.created_at)
        const cur = potonganPertama.get(id)
        if (cur === undefined || t < cur) potonganPertama.set(id, t)
      }
      const m = netoOrder.get(id) || new Map<string, number>()
      m.set(bahan, (m.get(bahan) || 0) + qty)
      netoOrder.set(id, m)
    } else if (row.tipe === 'pemakaian' && diPeriode(row.created_at)) {
      tambah(bahan, Math.abs(qty))
    }
  }

  for (const [id, perBahan] of netoOrder) {
    const t = potonganPertama.get(id)
    if (t === undefined || t < start || t > end) continue
    for (const [bahan, neto] of perBahan) if (neto < 0) tambah(bahan, -neto)
  }
  return out
}

/** pemakaianPosPerBahan untuk satu bahan (baris tanpa bahan_baku_id). */
export function pemakaianPosPeriode(rows: BarisMutasi[], startIso: string, endIso: string): number {
  let total = 0
  for (const v of pemakaianPosPerBahan(rows, startIso, endIso).values()) total += v
  return total
}
