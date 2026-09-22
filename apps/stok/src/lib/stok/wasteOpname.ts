/**
 * Ringkasan waste per bahan untuk satu opname: mana yang SUDAH mengurangi
 * angka Sistem saat opname, mana yang BELUM.
 *
 * - Sistem = stok_balance saat opname disimpan (`cutoff`).
 * - Waste baru mengurangi saldo saat DISETUJUI (trigger sync_waste_ledger
 *   menulis ledger tipe 'waste'); `approvedAt` = waktu baris ledger itu.
 * - `start` = opname finalized sebelumnya di outlet yang sama. Barang yang
 *   dibuang sebelum itu sudah terserap hitungan fisik opname lalu.
 *
 * masuk : disetujui dalam (start, cutoff]  -> sudah ikut memotong Sistem.
 * belum : dilaporkan dalam (start, cutoff] tapi belum disetujui saat cutoff
 *         -> fisiknya sudah hilang, Sistem belum turun -> tampil sebagai loss.
 *
 * Qty laporan waste selalu satuan besar; dikali faktor_tampilan agar satuan
 * kecil, sama dengan qty_system/selisih di opname_item.
 */
export type WasteReportRow = {
  id: string
  bahan_baku_id: string
  qty: number
  status: string
  created_at: string
}

export type WasteOpnameRingkas = { masuk: number; belum: number; jmlBelum: number }

export function ringkasWasteOpname(args: {
  reports: WasteReportRow[]
  approvedAt: Record<string, string>
  start: string
  cutoff: string
  faktor: Record<string, number | null | undefined>
}): Record<string, WasteOpnameRingkas> {
  const start = Date.parse(args.start)
  const cutoff = Date.parse(args.cutoff)
  const out: Record<string, WasteOpnameRingkas> = {}
  const add = (bahanId: string) =>
    (out[bahanId] ??= { masuk: 0, belum: 0, jmlBelum: 0 })

  for (const r of args.reports) {
    if (r.status?.toUpperCase() === 'REJECTED') continue
    const faktor = Number(args.faktor[r.bahan_baku_id]) || 1
    const qtyKecil = Math.abs(Number(r.qty) || 0) * faktor
    const lapor = Date.parse(r.created_at)
    const setuju = args.approvedAt[r.id] ? Date.parse(args.approvedAt[r.id]) : null

    if (setuju !== null && setuju > start && setuju <= cutoff) {
      add(r.bahan_baku_id).masuk += qtyKecil
    } else if (lapor > start && lapor <= cutoff && (setuju === null || setuju > cutoff)) {
      const w = add(r.bahan_baku_id)
      w.belum += qtyKecil
      w.jmlBelum += 1
    }
  }
  return out
}
