import { useQuery } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@suka/auth'

const supabase = createSupabaseBrowserClient()

export type POItemHistoryRow = {
  id: string
  purchase_order_id: string
  nomor_po: string
  tanggal_po: string
  supplier_nama: string
  qty_terima: number
  satuan: string
  harga_terima: number
  subtotal: number
  catatan: string | null
  selisih_nominal: number | null
  selisih_pct: number | null
}

export type MasterPriceHistoryRow = {
  id: string
  harga_lama: number | null
  harga_baru: number
  ref_po_id: string | null
  catatan: string | null
  changed_at: string
  changed_by?: string
}

export function useBahanBakuPriceHistory(bahanBakuId: string | null) {
  const query = useQuery({
    queryKey: ['bahan-baku-price-history', bahanBakuId],
    enabled: !!bahanBakuId,
    staleTime: 3 * 60_000,
    queryFn: async () => {
      if (!bahanBakuId) return { poHistory: [], masterHistory: [] }

      // 1. Ambil riwayat PO untuk item ini
      const { data: itemRows, error: itemErr } = await supabase
        .from('purchase_order_item')
        .select(`
          id,
          purchase_order_id,
          qty_terima,
          harga_terima,
          subtotal,
          catatan,
          purchase_order:purchase_order(
            id,
            nomor_po,
            tanggal_po,
            supplier_nama,
            status
          )
        `)
        .eq('bahan_baku_id', bahanBakuId)
        .not('harga_terima', 'is', null)
        .gt('harga_terima', 0)

      if (itemErr) throw itemErr

      // Filter hanya PO yang valid diterima
      const validItems = (itemRows ?? []).filter((it: any) => 
        it.purchase_order && 
        ['diterima_lengkap', 'sebagian_diterima'].includes(it.purchase_order.status)
      )

      // Sort kronologis DESC (terbaru ke terlama)
      validItems.sort((a: any, b: any) => 
        new Date(b.purchase_order.tanggal_po).getTime() - new Date(a.purchase_order.tanggal_po).getTime()
      )

      const poHistory: POItemHistoryRow[] = []
      for (let i = 0; i < validItems.length; i++) {
        const it = validItems[i]
        const currentPrice = Number(it.harga_terima || 0)
        const nextOlderItem = validItems[i + 1]
        const prevPrice = nextOlderItem ? Number(nextOlderItem.harga_terima || 0) : null

        let selisihNominal: number | null = null
        let selisihPct: number | null = null
        if (prevPrice !== null && prevPrice > 0) {
          selisihNominal = currentPrice - prevPrice
          selisihPct = (currentPrice - prevPrice) / prevPrice
        }

        poHistory.push({
          id: it.id,
          purchase_order_id: it.purchase_order.id,
          nomor_po: it.purchase_order.nomor_po,
          tanggal_po: it.purchase_order.tanggal_po,
          supplier_nama: it.purchase_order.supplier_nama,
          qty_terima: Number(it.qty_terima || 0),
          satuan: '',
          harga_terima: currentPrice,
          subtotal: Number(it.subtotal || (currentPrice * (it.qty_terima || 0))),
          catatan: it.catatan || null,
          selisih_nominal: selisihNominal,
          selisih_pct: selisihPct
        })
      }

      // 2. Ambil riwayat audit perubahan harga master
      const { data: histRows } = await supabase
        .from('bahan_baku_harga_history')
        .select('id, harga_lama, harga_baru, ref_po_id, catatan, changed_at, changed_by')
        .eq('bahan_baku_id', bahanBakuId)
        .order('changed_at', { ascending: false })

      const masterHistory: MasterPriceHistoryRow[] = (histRows ?? []).map((h: any) => ({
        id: h.id,
        harga_lama: h.harga_lama != null ? Number(h.harga_lama) : null,
        harga_baru: Number(h.harga_baru),
        ref_po_id: h.ref_po_id,
        catatan: h.catatan,
        changed_at: h.changed_at,
        changed_by: h.changed_by
      }))

      return { poHistory, masterHistory }
    }
  })

  return {
    poHistory: query.data?.poHistory ?? [],
    masterHistory: query.data?.masterHistory ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch
  }
}
