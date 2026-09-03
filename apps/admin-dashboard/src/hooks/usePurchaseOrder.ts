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
  bahan_baku_id: string
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
  kategori?: string | null
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
      return data ?? []
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
        .select('id, nama, satuan, kategori, bahan_baku_harga(harga_beli)')
        .order('nama')
      if (error) throw error
      return (data ?? []).map((b: any) => ({
        id: b.id,
        nama: b.nama,
        satuan: b.satuan,
        kategori: b.kategori,
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
      catatan: string | null
      items: { bahan_baku_id: string; qty_pesan: number; harga_pesan: number }[]
    }) => {
      const { data, error } = await supabase.rpc('create_purchase_order', {
        p_supplier_id: payload.supplier_id,
        p_supplier_nama: payload.supplier_nama,
        p_tanggal_po: payload.tanggal_po,
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

export function useDeleteSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('supplier').update({ is_active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Supplier berhasil dinonaktifkan')
    },
    onError: (e: any) => toast.error(e.message),
  })
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

export async function getSignedInvoiceUrl(path: string): Promise<string> {
  return getInvoiceUrl(path)
}
