'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@suka/auth'
import { toast } from 'sonner'

const supabase = createSupabaseBrowserClient()

export type POPendingItem = {
  id: string
  nomor_po: string
  supplier_nama: string
  tanggal_po: string
  status: string
  jumlah_item: number
  total_nilai: number
  created_at: string
}

export type POItemVerif = {
  id: string
  bahan_baku_id: string
  bahan_baku: { nama: string; satuan: string }
  qty_pesan: number
  harga_pesan: number
  qty_terima: number | null
  harga_terima: number | null
  kondisi: string | null
  catatan: string | null
}

export type PODetail = {
  id: string
  nomor_po: string
  supplier_nama: string
  tanggal_po: string
  status: string
  catatan: string | null
  invoice_urls: string[]
  items: POItemVerif[]
}

export function usePOPending() {
  return useQuery({
    queryKey: ['po-pending-kitchen'],
    queryFn: async (): Promise<POPendingItem[]> => {
      const { data, error } = await supabase.rpc('get_purchase_orders', {
        p_from: new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0],
        p_to: new Date().toISOString().split('T')[0],
        p_status: 'dikirim_ke_supplier',
      })
      if (error) throw error
      return data ?? []
    },
  })
}

export function usePODetailKitchen(id: string | null) {
  return useQuery({
    queryKey: ['po-detail-kitchen', id],
    enabled: !!id,
    queryFn: async (): Promise<PODetail> => {
      const { data: po, error } = await supabase
        .from('purchase_order')
        .select('id, nomor_po, supplier_nama, tanggal_po, status, catatan, invoice_urls')
        .eq('id', id!)
        .single()
      if (error) throw error

      const { data: items, error: iErr } = await supabase
        .from('purchase_order_item')
        .select('id, bahan_baku_id, bahan_baku(nama, satuan), qty_pesan, harga_pesan, qty_terima, harga_terima, kondisi, catatan')
        .eq('purchase_order_id', id!)
      if (iErr) throw iErr

      return { ...po, items: items ?? [] }
    },
  })
}

// GUDANG PUSAT (HQ) -- tujuan stok setiap penerimaan PO; verifikasi_terima_po
// menulis ledger ke id ini (di-hardcode juga di dalam fungsinya).
export const GUDANG_PUSAT_ID = 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90'

/**
 * Stok berjalan Gudang Pusat per bahan, dalam SATUAN BESAR.
 * Dipakai form terima untuk menampilkan akibat penerimaan ke stok.
 * Bahan yang tidak punya baris saldo sengaja TIDAK dipetakan jadi 0 --
 * pemanggil membedakan "belum diketahui" dari "memang nol".
 */
export function useStokGudang(bahanIds: string[]) {
  return useQuery({
    queryKey: ['stok-gudang-po-kitchen', [...bahanIds].sort()],
    enabled: bahanIds.length > 0,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from('stok_balance')
        .select('bahan_baku_id, saldo, saldo_is_gram, bahan_baku(faktor_tampilan, satuan_kecil)')
        .eq('outlet_id', GUDANG_PUSAT_ID)
        .in('bahan_baku_id', bahanIds)
      if (error) throw error
      const map: Record<string, number> = {}
      for (const row of (data ?? []) as any[]) {
        const b = row.bahan_baku ?? {}
        const saldo = Number(row.saldo || 0)
        map[row.bahan_baku_id] = row.saldo_is_gram && b.satuan_kecil && b.faktor_tampilan
          ? saldo / Number(b.faktor_tampilan)
          : saldo
      }
      return map
    },
  })
}

export function useVerifikasiPO() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      poId,
      items,
    }: {
      poId: string
      items: { bahan_baku_id: string; qty_terima: number; harga_terima: number | null; kondisi: string; catatan?: string }[]
    }) => {
      // ⚠️ LAYAR INI TIDAK PERNAH MENULIS APA PUN (diverifikasi ke DB live,
      // 16 Sep 2026, dengan kontrol positif). verifikasi_terima_po mencari
      // baris item lewat `poi.id = (v_item->>'id')::uuid`; payload di bawah
      // tidak pernah mengirim `id`, jadi setiap item kena `CONTINUE` dan
      // fungsinya tetap mengembalikan success:true -- toast hijau, nol efek.
      //
      // Satu-satunya yang kurang untuk mengaktifkannya: kirim `id` baris PO
      // (lihat TerimaBahanList.handleSubmit). SENGAJA belum diaktifkan --
      // menghidupkan jalur tulis ke stok produksi adalah keputusan owner,
      // dan ada risiko nyata: staf yang selama ini memasukkan ulang lewat
      // app stok/finance akan membuat penerimaan DOBEL begitu layar ini
      // benar-benar bekerja.
      const { data, error } = await supabase.rpc('verifikasi_terima_po', {
        p_po_id: poId,
        p_items: items,
      })
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['po-pending-kitchen'] })
      qc.invalidateQueries({ queryKey: ['po-detail-kitchen'] })
      if (data?.success) {
        toast.success(data.message ?? 'Verifikasi berhasil. Stok kitchen diperbarui.')
      } else {
        toast.error(data?.message ?? 'Verifikasi gagal')
      }
    },
    onError: (e: any) => toast.error(e.message),
  })
}

export async function uploadInvoiceKitchen(poId: string, file: File): Promise<void> {
  const ext = file.name.split('.').pop()
  const path = `${poId}/${Date.now()}.${ext}`

  const { error: upErr } = await supabase.storage
    .from('po-invoices')
    .upload(path, file, { cacheControl: '3600', upsert: false })
  if (upErr) throw upErr

  const { data: po } = await supabase
    .from('purchase_order')
    .select('invoice_urls')
    .eq('id', poId)
    .single()

  const newUrls = [...(po?.invoice_urls ?? []), path]
  const { error } = await supabase
    .from('purchase_order')
    .update({ invoice_urls: newUrls })
    .eq('id', poId)
  if (error) throw error
}

export function getInvoiceUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return ''
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://khpkoreaaucvyqfhynfq.supabase.co'
    if (pathOrUrl.includes('/storage/v1/object/public/po-invoices/')) {
      const parts = pathOrUrl.split('/storage/v1/object/public/po-invoices/')
      return `${supabaseUrl}/storage/v1/object/public/po-invoices/${parts[1]}`
    }
    return pathOrUrl
  }
  const supabase = createSupabaseBrowserClient()
  const { data } = supabase.storage.from('po-invoices').getPublicUrl(pathOrUrl)
  return data?.publicUrl || ''
}
