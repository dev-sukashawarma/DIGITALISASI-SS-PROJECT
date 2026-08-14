import { useQuery } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@suka/auth'

const supabase = createSupabaseBrowserClient()

// Threshold: alert hanya muncul kalau selisih > 5%
const THRESHOLD_PCT = 0.05

export type PriceAlert = {
  bahan_baku_id: string
  nama: string
  satuan: string
  harga_master: number | null
  harga_terima: number
  po_id: string
  nomor_po: string
  tanggal_po: string
  /** Positif = naik, negatif = turun */
  selisih_pct: number
}

/**
 * Fetch PO yang sudah diterima dalam 30 hari terakhir, lalu bandingkan
 * harga_terima item-nya dengan harga master saat ini.
 * Hanya return item yang selisihnya > THRESHOLD_PCT.
 */
export function usePOPriceAlerts() {
  return useQuery<PriceAlert[]>({
    queryKey: ['po-price-alerts'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PriceAlert[]> => {
      const since = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

      // Ambil PO yang sudah diterima (sebagian atau lengkap) dalam 30 hari
      const { data: orders, error: poErr } = await supabase
        .from('purchase_order')
        .select('id, nomor_po, tanggal_po')
        .in('status', ['diterima_lengkap', 'sebagian_diterima'])
        .gte('tanggal_po', since)
        .order('tanggal_po', { ascending: false })

      if (poErr) throw poErr
      if (!orders || orders.length === 0) return []

      const poIds = orders.map((o: any) => o.id)

      // Ambil semua item dari PO tersebut yang punya harga_terima
      const { data: items, error: itemErr } = await supabase
        .from('purchase_order_item')
        .select('purchase_order_id, bahan_baku_id, harga_terima, bahan_baku(nama, satuan)')
        .in('purchase_order_id', poIds)
        .not('harga_terima', 'is', null)

      if (itemErr) throw itemErr
      if (!items || items.length === 0) return []

      // Ambil semua bahan_baku_id unik
      const bbIds = [...new Set(items.map((i: any) => i.bahan_baku_id))]

      // Ambil harga master saat ini
      const { data: hargaRows, error: hErr } = await supabase
        .from('bahan_baku_harga')
        .select('bahan_baku_id, harga_beli')
        .in('bahan_baku_id', bbIds)

      if (hErr) throw hErr

      const hargaMap = new Map<string, number | null>(
        (hargaRows ?? []).map((h: any) => [h.bahan_baku_id, h.harga_beli])
      )

      // Map PO id → nomor_po, tanggal_po
      const poMap = new Map(
        orders.map((o: any) => [o.id, { nomor_po: o.nomor_po, tanggal_po: o.tanggal_po }])
      )

      // Untuk setiap bahan baku, ambil harga_terima dari PO TERBARU
      // (karena kita sudah sort descending, item pertama yang ketemu = PO terbaru)
      const seen = new Set<string>()
      const alerts: PriceAlert[] = []

      for (const item of items as any[]) {
        const bbId: string = item.bahan_baku_id
        if (seen.has(bbId)) continue // sudah ada entry dari PO yang lebih baru
        seen.add(bbId)

        const hargaMaster = hargaMap.get(bbId) ?? null
        const hargaTerima: number = item.harga_terima

        // Hitung selisih
        let selisihPct = 0
        if (hargaMaster !== null && hargaMaster > 0) {
          selisihPct = (hargaTerima - hargaMaster) / hargaMaster
        } else if (hargaMaster === null) {
          // Tidak ada harga master → selalu alert
          selisihPct = 1
        }

        if (Math.abs(selisihPct) <= THRESHOLD_PCT) continue

        const po = poMap.get(item.purchase_order_id)
        if (!po) continue

        alerts.push({
          bahan_baku_id: bbId,
          nama: item.bahan_baku?.nama ?? bbId,
          satuan: item.bahan_baku?.satuan ?? '',
          harga_master: hargaMaster,
          harga_terima: hargaTerima,
          po_id: item.purchase_order_id,
          nomor_po: po.nomor_po,
          tanggal_po: po.tanggal_po,
          selisih_pct: selisihPct,
        })
      }

      return alerts
    },
  })
}
