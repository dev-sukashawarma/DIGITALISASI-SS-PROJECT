import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@suka/auth'
import { toast } from 'sonner'

const supabase = createSupabaseBrowserClient()

// ─── Types ────────────────────────────────────────────────────────────────────

export type POStatus =
  | 'draft'
  | 'menunggu_approval_finance'
  | 'dikirim_ke_supplier'
  | 'sebagian_diterima'
  | 'diterima_lengkap'
  | 'dibatalkan'

export type POItem = {
  id: string
  bahan_baku_id: string | null
  item_description: string | null
  satuan_ad_hoc: string | null
  bahan_baku?: { nama: string; satuan: string }
  qty_pesan: number
  harga_pesan: number
  qty_terima: number | null
  harga_terima: number | null
  kondisi: 'baik' | 'rusak' | 'kurang' | null
  catatan: string | null
  subtotal: number
}

export type PurchaseOrder = {
  id: string
  nomor_po: string
  supplier_id: string | null
  supplier_nama: string
  tanggal_po: string
  tanggal_estimasi_tiba: string | null
  status: POStatus
  catatan: string | null
  invoice_urls: string[]
  dibuat_oleh: string | null
  diverifikasi_oleh: string | null
  diverifikasi_at: string | null
  created_at: string
  updated_at: string
  jatuh_tempo?: string | null
  termin_hari?: number | null
}

export type POWithItems = PurchaseOrder & { items: POItem[] }

export type POSummary = {
  id: string
  nomor_po: string
  supplier_nama: string
  tanggal_po: string
  status: POStatus
  total_nilai: number
  jumlah_item: number
  nama_dibuat_oleh: string | null
  created_at: string
  total_nilai_terima?: number
  jumlah_item_terima?: number
  jumlah_invoice?: number
  has_discrepancy?: boolean
  jatuh_tempo?: string | null
  termin_hari?: number | null
  diverifikasi_at?: string | null
  paid_at?: string | null
  payment_status?: string | null
  tanggal_estimasi_tiba?: string | null
}

export type Supplier = {
  id: string
  nama: string
  kontak: string | null
  alamat: string | null
  kategori: string | null
  catatan: string | null
  is_active: boolean
  created_at: string
  bahan_baku_ids?: string[] | null
  termin_hari: number | null
}

export type BahanBakuOption = {
  id: string
  nama: string
  satuan: string
  harga_beli: number | null
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function usePurchaseOrders(filters?: { from?: string; to?: string; status?: string }, initialData?: POSummary[]) {
  return useQuery({
    queryKey: ['purchase-orders', filters],
    initialData,
    queryFn: async (): Promise<POSummary[]> => {
      const { data, error } = await supabase.rpc('get_purchase_orders', {
        p_from: filters?.from ?? new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
        p_to: filters?.to ?? new Date().toISOString().split('T')[0],
        p_status: filters?.status ?? null,
      })
      if (error) throw error
      if (!data || data.length === 0) return []

      const poIds = data.map((p: any) => p.id)
      const { data: extras } = await supabase
        .from('purchase_order')
        .select('id, diverifikasi_at, paid_at, payment_status, tanggal_estimasi_tiba')
        .in('id', poIds)

      const extrasMap = new Map((extras ?? []).map(x => [x.id, x]))
      return data.map((p: any) => {
        const extra = extrasMap.get(p.id)
        return {
          ...p,
          diverifikasi_at: p.diverifikasi_at ?? extra?.diverifikasi_at ?? null,
          paid_at: p.paid_at ?? extra?.paid_at ?? null,
          payment_status: p.payment_status ?? extra?.payment_status ?? 'unpaid',
          tanggal_estimasi_tiba: p.tanggal_estimasi_tiba ?? extra?.tanggal_estimasi_tiba ?? null,
        }
      })
    },
  })
}

export function usePODetail(id: string | null, initialData?: POWithItems) {
  return useQuery({
    queryKey: ['purchase-order', id],
    enabled: !!id,
    initialData,
    queryFn: async (): Promise<POWithItems> => {
      const { data: po, error } = await supabase
        .from('purchase_order')
        .select('*')
        .eq('id', id!)
        .single()
      if (error) throw error

      const { data: items, error: iErr } = await supabase
        .from('purchase_order_item')
        .select('*, bahan_baku(nama, satuan)')
        .eq('purchase_order_id', id!)
        .order('bahan_baku(nama)')
      if (iErr) throw iErr

      return { ...po, items: items ?? [] }
    },
  })
}

export function useSuppliers() {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: async (): Promise<Supplier[]> => {
      const { data, error } = await supabase
        .from('supplier')
        .select('*')
        .eq('is_active', true)
        .order('nama')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useBahanBakuOptions() {
  return useQuery({
    queryKey: ['bahan-baku-options'],
    queryFn: async (): Promise<BahanBakuOption[]> => {
      const { data, error } = await supabase
        .from('bahan_baku')
        .select('id, nama, satuan, bahan_baku_harga(harga_beli)')
        .order('nama')
      if (error) throw error
      return (data ?? []).map((b: any) => ({
        id: b.id,
        nama: b.nama,
        satuan: b.satuan,
        harga_beli: b.bahan_baku_harga?.[0]?.harga_beli ?? null,
      }))
    },
  })
}

export function useCreatePO() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      supplier_id: string | null
      supplier_nama: string
      tanggal_po: string
      status?: POStatus
      catatan: string | null
      items: { bahan_baku_id?: string | null; item_description?: string | null; satuan_ad_hoc?: string | null; qty_pesan: number; harga_pesan: number }[]
    }) => {
      const { data, error } = await supabase.rpc('create_purchase_order', {
        p_supplier_id: payload.supplier_id,
        p_supplier_nama: payload.supplier_nama,
        p_tanggal_po: payload.tanggal_po,
        p_status: payload.status ?? 'draft',
        p_catatan: payload.catatan,
        p_items: payload.items,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      toast.success('Purchase Order berhasil dibuat')
    },
    onError: (e: any) => toast.error(e.message),
  })
}

export function useUpdatePOStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: POStatus }) => {
      const { error } = await supabase
        .from('purchase_order')
        .update({ status })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      qc.invalidateQueries({ queryKey: ['purchase-order', vars.id] })
      toast.success('Status PO diperbarui')
    },
    onError: (e: any) => toast.error(e.message),
  })
}

export function useUploadInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ poId, file }: { poId: string; file: File }) => {
      const ext = file.name.split('.').pop()
      const path = `${poId}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('po-invoices')
        .upload(path, file, { cacheControl: '3600', upsert: false })
      if (upErr) throw upErr

      // Append path ke array invoice_urls
      const { data: po } = await supabase
        .from('purchase_order')
        .select('invoice_urls')
        .eq('id', poId)
        .single()

      const newUrls = [...(po?.invoice_urls ?? []), path]
      const { error: upd } = await supabase
        .from('purchase_order')
        .update({ invoice_urls: newUrls })
        .eq('id', poId)
      if (upd) throw upd
      return path
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['purchase-order', vars.poId] })
      toast.success('Foto invoice berhasil diupload')
    },
    onError: (e: any) => toast.error(e.message),
  })
}

export function useCreateSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Omit<Supplier, 'id' | 'created_at' | 'is_active'> & { is_active?: boolean }) => {
      const { data, error } = await supabase
        .from('supplier')
        .insert({ ...payload, is_active: payload.is_active ?? true })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Supplier berhasil ditambahkan')
    },
    onError: (e: any) => toast.error(e.message),
  })
}

export function useUpdateSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<Supplier> & { id: string }) => {
      const { error } = await supabase.from('supplier').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Supplier diperbarui')
    },
    onError: (e: any) => toast.error(e.message),
  })
}

export async function getSignedInvoiceUrl(path: string): Promise<string> {
  const supabase = createSupabaseBrowserClient()
  const { data, error } = await supabase.storage
    .from('po-invoices')
    .createSignedUrl(path, 3600)
  if (error) throw error
  return data.signedUrl
}

export function useVerifikasiTerimaPO() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ poId, items }: { poId: string, items: any[] }) => {
      const { data, error } = await supabase.rpc('verifikasi_terima_po', {
        p_po_id: poId,
        p_items: items
      })
      if (error) throw error
      return data
    },
    onSuccess: (_, { poId }) => {
      toast.success('Penerimaan barang berhasil dicatat')
      qc.invalidateQueries({ queryKey: ['purchase_orders'] })
      qc.invalidateQueries({ queryKey: ['purchase_order', poId] })
    },
    onError: (err: any) => {
      toast.error('Gagal memverifikasi penerimaan: ' + err.message)
    }
  })
}
