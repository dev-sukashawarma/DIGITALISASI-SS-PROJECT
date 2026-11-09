// Hook & tipe supplier bersama (dipindah dari admin-dashboard hooks/usePurchaseOrder).
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@suka/auth'
import { toast } from 'sonner'
import { saringDataSupplier } from '../lib/masterBahan/supplier'

// Dibuat saat pertama dipakai (bukan saat modul dimuat): barrel paket ikut dimuat halaman
// server saat build, dan client browser butuh env yang belum tentu ada di sana.
let klien: ReturnType<typeof createSupabaseBrowserClient> | null = null
const db = () => (klien ??= createSupabaseBrowserClient())

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

export function useSuppliers() {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: async (): Promise<Supplier[]> => {
      const { data, error } = await db()
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
      const { data, error } = await db()
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

export function useCreateSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Omit<Supplier, 'id' | 'created_at' | 'is_active'> & { is_active?: boolean }) => {
      const { data, error } = await db().rpc('simpan_supplier', {
        p_id: null,
        p_data: saringDataSupplier(payload as Record<string, unknown>),
        p_alasan: 'Dibuat dari halaman Master Supplier',
      })
      if (error) throw error
      return { id: data as string }
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
      const { error } = await db().rpc('simpan_supplier', {
        p_id: id,
        p_data: saringDataSupplier(payload as Record<string, unknown>),
        p_alasan: 'Diubah dari halaman Master Supplier',
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      // Menonaktifkan/mengubah supplier bisa menggeser harga master turunan
      // (harga_vendor_terpercaya) — segarkan permukaan yang membaca harga master.
      qc.invalidateQueries({ queryKey: ['master_bahan'] })
      qc.invalidateQueries({ queryKey: ['katalog_vendor'] })
      toast.success('Supplier diperbarui')
    },
    onError: (e: any) => toast.error(e.message),
  })
}

export function useDeleteSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().rpc('nonaktifkan_supplier', {
        p_id: id,
        p_alasan: 'Dinonaktifkan dari halaman Master Supplier',
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      // Sama seperti update: vendor dinonaktifkan bisa menggeser harga master turunan.
      qc.invalidateQueries({ queryKey: ['master_bahan'] })
      qc.invalidateQueries({ queryKey: ['katalog_vendor'] })
      toast.success('Supplier berhasil dinonaktifkan')
    },
    onError: (e: any) => toast.error(e.message),
  })
}
