import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { normalizeBahanBaku } from '@/lib/bahanBaku'
import type { BahanBakuRaw, BahanBakuWithHarga } from '@/lib/bahanBaku'

export function useBahanBakuHarga() {
  const supabase = createClient()
  return useQuery<BahanBakuWithHarga[]>({
    queryKey: ['bahan_baku_harga'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bahan_baku')
        .select('id, nama, merek, image_url, image_url_tengah, image_url_kecil, image_urls, satuan, satuan_tengah, faktor_tengah, satuan_kecil, faktor_tampilan, kategori, bahan_baku_harga(harga_beli, harga_updated_at), bahan_baku_sku(id, nama_kemasan, qty_isi, harga_beli, is_default, is_active, tingkatan_satuan, image_url, created_at)')
        .eq('is_active', true)
        .order('nama')
      if (error) throw error
      return ((data ?? []) as unknown as BahanBakuRaw[]).map(normalizeBahanBaku)
    },
  })
}
