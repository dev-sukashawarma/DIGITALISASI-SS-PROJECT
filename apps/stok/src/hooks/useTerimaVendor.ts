'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'

// Semua otorisasi ada di RPC (SECURITY DEFINER + auth.uid()). Jangan panggil
// lewat service-role: auth.uid() jadi NULL dan pemeriksaan outlet sendiri gagal.
// createClient() di sini delegasi ke @suka/auth (lihat src/lib/supabase.ts) --
// pakai cookieOptions yang benar, bukan createBrowserClient polos (semua
// tulisan jadi anon kalau tidak -- lihat memori two-factory-browser-client-gotcha).

export type InfoVendor = {
  supplier_id: string
  supplier_nama: string
  harga_snapshot: number
  rata_pakai_harian: number | null
}

export type TerimaVendorBaris = {
  id: string
  tanggal_terima: string
  bahan_nama: string
  satuan: string
  supplier_nama: string
  qty: number
  harga_snapshot: number
  status: 'dicatat' | 'disahkan' | 'ditolak'
  dicatat_at: string
}

export function useInfoTerimaVendor(bahanBakuId: string | null) {
  return useQuery<InfoVendor[]>({
    queryKey: ['terima-vendor', 'info', bahanBakuId],
    enabled: !!bahanBakuId,
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('info_terima_vendor', { p_bahan_baku_id: bahanBakuId })
      if (error) throw new Error(error.message)
      return (data ?? []) as InfoVendor[]
    },
  })
}

export function useDaftarTerimaVendorSaya(dari: string, sampai: string) {
  return useQuery<TerimaVendorBaris[]>({
    queryKey: ['terima-vendor', 'saya', dari, sampai],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('daftar_terima_vendor_saya', { p_dari: dari, p_sampai: sampai })
      if (error) throw new Error(error.message)
      return (data ?? []) as TerimaVendorBaris[]
    },
  })
}

export function useCatatTerimaVendor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (a: {
      bahanBakuId: string
      supplierId: string
      qty: number
      tanggal: string
      catatan?: string
      fotoUrl?: string
    }) => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('catat_terima_vendor', {
        p_bahan_baku_id: a.bahanBakuId,
        p_supplier_id: a.supplierId,
        p_qty: a.qty,
        p_tanggal: a.tanggal,
        p_catatan: a.catatan ?? null,
        p_foto_url: a.fotoUrl ?? null,
      })
      if (error) throw new Error(error.message)
      return data as string
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['terima-vendor'] }),
  })
}

export function useKoreksiTerimaVendor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (a: { id: string; qty: number }) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('koreksi_terima_vendor', { p_id: a.id, p_qty: a.qty })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['terima-vendor'] }),
  })
}
