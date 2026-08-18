import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@suka/auth'
import { syncMasterPriceAction, type SyncMasterItemInput } from '@/app/actions/hargaBahan'

const supabase = createSupabaseBrowserClient()

export type FluktuasiHargaItem = {
  bahan_baku_id: string
  kode: string
  nama: string
  satuan: string
  kategori_id: string | null
  kategori_nama: string
  harga_master: number | null
  harga_terakhir: number | null
  tgl_po_terakhir: string | null
  nomor_po_terakhir: string | null
  supplier_terakhir: string | null
  po_id_terakhir: string | null
  harga_sebelumnya: number | null
  tgl_po_sebelumnya: string | null
  nomor_po_sebelumnya: string | null
  supplier_sebelumnya: string | null
  po_id_sebelumnya: string | null
  selisih_nominal_prev: number | null
  selisih_pct_prev: number | null
  selisih_nominal_master: number | null
  selisih_pct_master: number | null
  total_transaksi_po: number
  trend_prices: number[]
}

/**
 * Fallback aggregator jika RPC PostgreSQL get_fluktuasi_harga_bahan_baku belum diaplikasikan
 */
async function fetchFluktuasiFallback(days: number | null): Promise<FluktuasiHargaItem[]> {
  const sinceDate = days ? new Date(Date.now() - days * 86400000).toISOString().split('T')[0] : null

  // 1. Ambil seluruh bahan baku & kategori
  const { data: bahanRows, error: bbErr } = await supabase
    .from('bahan_baku')
    .select('id, nama, satuan, kategori, kategori_core')
    .eq('is_active', true)
    .order('nama', { ascending: true })

  if (bbErr) throw bbErr
  if (!bahanRows || bahanRows.length === 0) return []

  const bbIds = bahanRows.map((b: any) => b.id)

  // 2. Ambil harga master
  const { data: hargaRows } = await supabase
    .from('bahan_baku_harga')
    .select('bahan_baku_id, harga_beli')
    .in('bahan_baku_id', bbIds)

  const hargaMasterMap = new Map<string, number | null>(
    (hargaRows ?? []).map((h: any) => [h.bahan_baku_id, h.harga_beli])
  )

  // 3. Ambil PO yang valid (diterima)
  let poQuery = supabase
    .from('purchase_order')
    .select('id, nomor_po, supplier_nama, tanggal_po, status, created_at')
    .in('status', ['diterima_lengkap', 'sebagian_diterima'])
    .order('tanggal_po', { ascending: false })

  if (sinceDate) {
    poQuery = poQuery.gte('tanggal_po', sinceDate)
  }

  const { data: poRows, error: poErr } = await poQuery
  if (poErr) throw poErr

  const validPoIds = (poRows ?? []).map((p: any) => p.id)
  const poMap = new Map((poRows ?? []).map((p: any) => [p.id, p]))

  // 4. Ambil item PO
  let items: any[] = []
  if (validPoIds.length > 0) {
    const { data: itemRows } = await supabase
      .from('purchase_order_item')
      .select('purchase_order_id, bahan_baku_id, harga_terima')
      .in('purchase_order_id', validPoIds)
      .not('harga_terima', 'is', null)
      .gt('harga_terima', 0)

    items = itemRows ?? []
  }

  // Kelompokkan item per bahan_baku_id terurut kronologis tanggal PO descending
  const itemsByBahan = new Map<string, Array<{ harga: number; po: any }>>()

  for (const item of items) {
    const po = poMap.get(item.purchase_order_id)
    if (!po) continue
    if (!itemsByBahan.has(item.bahan_baku_id)) {
      itemsByBahan.set(item.bahan_baku_id, [])
    }
    itemsByBahan.get(item.bahan_baku_id)!.push({
      harga: item.harga_terima,
      po
    })
  }

  // 5. Susun hasil FluktuasiHargaItem
  const results: FluktuasiHargaItem[] = []

  for (const bb of bahanRows as any[]) {
    const txList = itemsByBahan.get(bb.id) ?? []
    // Sort berdasarkan tanggal_po DESC
    txList.sort((a, b) => new Date(b.po.tanggal_po).getTime() - new Date(a.po.tanggal_po).getTime())

    const latest = txList[0] || null
    const prev = txList[1] || null
    const hargaMaster = hargaMasterMap.get(bb.id) ?? null

    const hargaTerakhir = latest?.harga ?? null
    const hargaSebelumnya = prev?.harga ?? null

    // Hitung selisih vs prev
    let selisihNominalPrev: number | null = null
    let selisihPctPrev: number | null = null
    if (hargaTerakhir !== null && hargaSebelumnya !== null) {
      selisihNominalPrev = hargaTerakhir - hargaSebelumnya
      selisihPctPrev = hargaSebelumnya > 0 ? (hargaTerakhir - hargaSebelumnya) / hargaSebelumnya : null
    }

    // Hitung selisih vs master
    let selisihNominalMaster: number | null = null
    let selisihPctMaster: number | null = null
    if (hargaTerakhir !== null && hargaMaster !== null) {
      selisihNominalMaster = hargaTerakhir - hargaMaster
      selisihPctMaster = hargaMaster > 0 ? (hargaTerakhir - hargaMaster) / hargaMaster : null
    }

    // Trend points (ambil hingga 8 titik kronologis ASC)
    const recentTx = txList.slice(0, 8).reverse()
    const trendPrices = recentTx.map(t => t.harga)

    results.push({
      bahan_baku_id: bb.id,
      kode: bb.kode || '',
      nama: bb.nama,
      satuan: bb.satuan || '',
      kategori_id: null,
      kategori_nama: bb.kategori || bb.kategori_core || 'Lainnya',
      harga_master: hargaMaster,
      harga_terakhir: hargaTerakhir,
      tgl_po_terakhir: latest?.po.tanggal_po || null,
      nomor_po_terakhir: latest?.po.nomor_po || null,
      supplier_terakhir: latest?.po.supplier_nama || null,
      po_id_terakhir: latest?.po.id || null,
      harga_sebelumnya: hargaSebelumnya,
      tgl_po_sebelumnya: prev?.po.tanggal_po || null,
      nomor_po_sebelumnya: prev?.po.nomor_po || null,
      supplier_sebelumnya: prev?.po.supplier_nama || null,
      po_id_sebelumnya: prev?.po.id || null,
      selisih_nominal_prev: selisihNominalPrev,
      selisih_pct_prev: selisihPctPrev,
      selisih_nominal_master: selisihNominalMaster,
      selisih_pct_master: selisihPctMaster,
      total_transaksi_po: txList.length,
      trend_prices: trendPrices
    })
  }

  return results
}

export function useFluktuasiHarga(daysFilter: number | null = 30) {
  const queryClient = useQueryClient()

  const query = useQuery<FluktuasiHargaItem[]>({
    queryKey: ['fluktuasi-harga-bahan-baku', daysFilter],
    staleTime: 3 * 60_000,
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc('get_fluktuasi_harga_bahan_baku', {
          p_days: daysFilter,
          p_kategori_id: null
        })

        if (!error && Array.isArray(data)) {
          return data.map((d: any) => ({
            ...d,
            harga_master: d.harga_master != null ? Number(d.harga_master) : null,
            harga_terakhir: d.harga_terakhir != null ? Number(d.harga_terakhir) : null,
            harga_sebelumnya: d.harga_sebelumnya != null ? Number(d.harga_sebelumnya) : null,
            selisih_nominal_prev: d.selisih_nominal_prev != null ? Number(d.selisih_nominal_prev) : null,
            selisih_pct_prev: d.selisih_pct_prev != null ? Number(d.selisih_pct_prev) : null,
            selisih_nominal_master: d.selisih_nominal_master != null ? Number(d.selisih_nominal_master) : null,
            selisih_pct_master: d.selisih_pct_master != null ? Number(d.selisih_pct_master) : null,
            total_transaksi_po: Number(d.total_transaksi_po || 0),
            trend_prices: Array.isArray(d.trend_prices) ? d.trend_prices.map(Number) : []
          }))
        }
      } catch (rpcErr) {
        console.warn('Supabase RPC get_fluktuasi_harga_bahan_baku unavailable, using client fallback:', rpcErr)
      }

      // Gunakan fallback client-side query
      return fetchFluktuasiFallback(daysFilter)
    }
  })

  const syncMutation = useMutation({
    mutationFn: async (items: SyncMasterItemInput[]) => {
      return await syncMasterPriceAction(items)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fluktuasi-harga-bahan-baku'] })
      queryClient.invalidateQueries({ queryKey: ['stok-monitoring'] })
      queryClient.invalidateQueries({ queryKey: ['po-price-alerts'] })
    }
  })

  return {
    ...query,
    items: query.data ?? [],
    syncMasterPrice: syncMutation.mutateAsync,
    isSyncing: syncMutation.isPending
  }
}
