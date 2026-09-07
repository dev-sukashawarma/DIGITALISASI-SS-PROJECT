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
