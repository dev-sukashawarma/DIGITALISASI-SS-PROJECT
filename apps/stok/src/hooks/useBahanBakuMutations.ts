import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@suka/auth'

export function useBahanBakuMutations() {
  const supabase = createSupabaseBrowserClient()
  const qc = useQueryClient()

  const addBahanBaku = useMutation({
    mutationFn: async (vars: { 
      nama: string; 
      kategori: string; 
      satuan: string;
      satuan_tengah?: string;
      faktor_tengah?: number;
      satuan_kecil?: string;
      faktor_tampilan?: number;
      harga_beli?: number;
    }) => {
      // 1. Insert ke tabel bahan_baku
      const { data: bahanBaku, error: bbError } = await supabase.from('bahan_baku').insert({
        nama: vars.nama,
        kategori: vars.kategori,
        satuan: vars.satuan,
        satuan_tengah: vars.satuan_tengah,
        faktor_tengah: vars.faktor_tengah,
        satuan_kecil: vars.satuan_kecil,
        faktor_tampilan: vars.faktor_tampilan,
        is_active: true,
        is_fisik_checked: false
      }).select('id').single()

      if (bbError) throw new Error(`Gagal menyimpan bahan baku: ${bbError.message}`)

      // 2. Insert ke tabel bahan_baku_sku sebagai default SKU (Kemasan Dasar)
      const { error: skuError } = await supabase.from('bahan_baku_sku').insert({
        bahan_baku_id: bahanBaku.id,
        nama_kemasan: vars.satuan,
        qty_isi: 1,
        harga_beli: vars.harga_beli || 0,
        is_default: true,
        is_active: true
      })

      if (skuError) throw new Error(`Gagal menyimpan SKU: ${skuError.message}`)
      
      return bahanBaku
    },
    onSuccess: () => {
      // Fluktuasi harga table uses 'fluktuasi-harga' or 'bahan_baku_harga' query key.
      // We will just invalidate 'fluktuasi-harga' which is used by Stok app.
      qc.invalidateQueries({ queryKey: ['fluktuasi-harga'] })
      qc.invalidateQueries({ queryKey: ['bahan_baku'] })
    },
  })

  return { addBahanBaku }
}

