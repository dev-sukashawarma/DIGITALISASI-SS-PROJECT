'use client'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { normalizeBahanBaku, type BahanBakuRaw, type BahanBakuWithHarga } from '@/lib/bahanBaku'

export const KUNCI_DAFTAR_BAHAN = ['master_bahan', 'daftar'] as const

const KOLOM =
  'id, nama, merek, image_url, image_url_tengah, image_url_kecil, image_urls, satuan, satuan_tengah, faktor_tengah, ' +
  'satuan_kecil, faktor_tampilan, kategori, is_active, default_reorder_point, peruntukan, is_opname, satuan_po, ' +
  'satuan_distribusi, bahan_baku_harga(harga_beli, harga_updated_at), ' +
  'bahan_baku_sku(id, bahan_baku_id, nama_kemasan, qty_isi, harga_beli, is_default, is_active, tingkatan_satuan, image_url, created_at)'

/** Semua bahan (aktif & nonaktif); layar yang menyaring. */
export function useDaftarBahan() {
  const supabase = useMemo(() => createClient(), [])
  return useQuery<BahanBakuWithHarga[]>({
    queryKey: KUNCI_DAFTAR_BAHAN,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('bahan_baku').select(KOLOM).order('nama')
      if (error) throw error
      return ((data ?? []) as unknown as BahanBakuRaw[]).map(normalizeBahanBaku)
    },
  })
}
