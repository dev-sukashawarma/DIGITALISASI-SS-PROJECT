'use client'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createSupabaseBrowserClient as createClient } from '@suka/auth'

export type VendorBahan = {
  id: string
  supplier_id: string
  supplier_nama: string
  satuan_beli: string
  isi_satuan_kecil: number
  harga: number
  perlu_ditinjau: boolean
  is_active: boolean
  harga_updated_at: string | null
}

type Mentah = Omit<VendorBahan, 'supplier_nama'> & { supplier: { nama: string } | { nama: string }[] | null }

/**
 * Semua harga vendor satu bahan (aktif maupun nonaktif) untuk seksi Vendor di panel detail.
 * Kunci diawali 'katalog_vendor' supaya ikut disegarkan useMutasiMasterBahan setelah tulis.
 */
export function useVendorBahan(bahanId: string) {
  const supabase = useMemo(() => createClient(), [])
  return useQuery({
    queryKey: ['katalog_vendor', 'bahan', bahanId],
    queryFn: async (): Promise<VendorBahan[]> => {
      const { data, error } = await supabase
        .from('bahan_baku_supplier')
        .select('id, supplier_id, satuan_beli, isi_satuan_kecil, harga, perlu_ditinjau, is_active, harga_updated_at, supplier(nama)')
        .eq('bahan_baku_id', bahanId)
        .order('is_active', { ascending: false })
        .order('harga_updated_at', { ascending: false, nullsFirst: false })
      if (error) throw error
      return ((data ?? []) as unknown as Mentah[]).map(({ supplier, ...r }) => ({
        ...r,
        isi_satuan_kecil: Number(r.isi_satuan_kecil),
        harga: Number(r.harga),
        supplier_nama: (Array.isArray(supplier) ? supplier[0]?.nama : supplier?.nama) ?? '—',
      }))
    },
    staleTime: 30000,
  })
}
