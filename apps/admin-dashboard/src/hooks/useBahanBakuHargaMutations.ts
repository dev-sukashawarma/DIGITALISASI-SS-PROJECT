import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createBahanBakuAction } from '@/app/actions/bahanBakuActions'
import { createClient } from '@/lib/supabase'

export function useBahanBakuHargaMutations() {
  const supabase = createClient()
  const qc = useQueryClient()

  const setHarga = useMutation({
    mutationFn: async (vars: { bahan_baku_id: string; harga_beli: number }) => {
      const { data: auth } = await supabase.auth.getUser()
      const { error } = await supabase.from('bahan_baku_harga').upsert({
        bahan_baku_id: vars.bahan_baku_id,
        harga_beli: vars.harga_beli,
        harga_updated_at: new Date().toISOString(),
        updated_by: auth.user?.id ?? null,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bahan_baku_harga'] }),
  })

  const setMerek = useMutation({
    mutationFn: async (vars: { bahan_baku_id: string; merek: string | null }) => {
      const { error } = await supabase.from('bahan_baku').update({
        merek: vars.merek
      }).eq('id', vars.bahan_baku_id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bahan_baku_harga'] }),
  })

  const setNama = useMutation({
    mutationFn: async (vars: { bahan_baku_id: string; nama: string }) => {
      const { error } = await supabase.from('bahan_baku').update({
        nama: vars.nama
      }).eq('id', vars.bahan_baku_id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bahan_baku_harga'] }),
  })

  const setSatuan = useMutation({
    mutationFn: async (vars: { 
      bahan_baku_id: string; 
      satuan: string; 
      satuan_tengah: string | null; 
      faktor_tengah: number | null; 
      satuan_kecil: string | null; 
      faktor_tampilan: number | null; 
    }) => {
      const { error } = await supabase.from('bahan_baku').update({
        satuan: vars.satuan,
        satuan_tengah: vars.satuan_tengah,
        faktor_tengah: vars.faktor_tengah,
        satuan_kecil: vars.satuan_kecil,
        faktor_tampilan: vars.faktor_tampilan
      }).eq('id', vars.bahan_baku_id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bahan_baku_harga'] }),
  })

  const setImage = useMutation({
    mutationFn: async (vars: { bahan_baku_id: string; file: File; level: 'besar' | 'tengah' | 'kecil' }) => {
      const ext = vars.file.name.split('.').pop()
      const path = `${vars.bahan_baku_id}_${vars.level}_${Date.now()}.${ext}`
      
      const { error: uploadError } = await supabase.storage.from('bahan-baku').upload(path, vars.file)
      if (uploadError) throw new Error(uploadError.message)
      
      const { data: { publicUrl } } = supabase.storage.from('bahan-baku').getPublicUrl(path)
      
      let updateData: Record<string, string> = {}
      if (vars.level === 'besar') updateData = { image_url: publicUrl }
      if (vars.level === 'tengah') updateData = { image_url_tengah: publicUrl }
      if (vars.level === 'kecil') updateData = { image_url_kecil: publicUrl }
      
      const { error: dbError } = await supabase.from('bahan_baku').update(updateData).eq('id', vars.bahan_baku_id)
      if (dbError) throw new Error(dbError.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bahan_baku_harga'] }),
  })

  const addSku = useMutation({
    mutationFn: async (vars: { bahan_baku_id: string; nama_kemasan: string; qty_isi: number; harga_beli: number; is_default?: boolean; satuan_tengah?: string | null; faktor_tengah?: number | null }) => {
      // Jika ini sku default, set semua sku lain untuk bahan baku ini menjadi non-default
      if (vars.is_default) {
        await supabase.from('bahan_baku_sku').update({ is_default: false }).eq('bahan_baku_id', vars.bahan_baku_id)
      }
      
      const { error } = await supabase.from('bahan_baku_sku').insert({
        bahan_baku_id: vars.bahan_baku_id,
        nama_kemasan: vars.nama_kemasan,
        qty_isi: vars.qty_isi,
        harga_beli: vars.harga_beli,
        is_default: vars.is_default || false,
        satuan_tengah: vars.satuan_tengah || null,
        faktor_tengah: vars.faktor_tengah || null
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bahan_baku_harga'] }),
  })

  const updateSku = useMutation({
    mutationFn: async (vars: { sku_id: string; nama_kemasan: string; qty_isi: number; harga_beli: number; satuan_tengah?: string | null; faktor_tengah?: number | null }) => {
      const { error } = await supabase.from('bahan_baku_sku').update({
        nama_kemasan: vars.nama_kemasan,
        qty_isi: vars.qty_isi,
        harga_beli: vars.harga_beli,
        satuan_tengah: vars.satuan_tengah || null,
        faktor_tengah: vars.faktor_tengah || null
      }).eq('id', vars.sku_id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bahan_baku_harga'] }),
  })

  const deleteSku = useMutation({
    mutationFn: async (sku_id: string) => {
      const { error } = await supabase.from('bahan_baku_sku').delete().eq('id', sku_id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bahan_baku_harga'] }),
  })

  const setDefaultSku = useMutation({
    mutationFn: async (vars: { bahan_baku_id: string; sku_id: string }) => {
      // Set all to false first
      await supabase.from('bahan_baku_sku').update({ is_default: false }).eq('bahan_baku_id', vars.bahan_baku_id)
      // Set the selected one to true
      const { error } = await supabase.from('bahan_baku_sku').update({ is_default: true }).eq('id', vars.sku_id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bahan_baku_harga'] }),
  })

  const setSkuImage = useMutation({
    mutationFn: async (vars: { sku_id: string; file: File }) => {
      const ext = vars.file.name.split('.').pop()
      const path = `sku_${vars.sku_id}_${Date.now()}.${ext}`
      
      const { error: uploadError } = await supabase.storage.from('bahan-baku').upload(path, vars.file)
      if (uploadError) throw new Error(uploadError.message)
      
      const { data: { publicUrl } } = supabase.storage.from('bahan-baku').getPublicUrl(path)
      
      const { error: dbError } = await supabase.from('bahan_baku_sku').update({ image_url: publicUrl }).eq('id', vars.sku_id)
      if (dbError) throw new Error(dbError.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bahan_baku_harga'] }),
  })

  const setThreshold = useMutation({
    mutationFn: async (vars: { bahan_baku_id: string; threshold_type: 'angka' | 'persentase'; threshold_persentase: number | null; stok_ideal: number | null }) => {
      const { error } = await supabase.from('bahan_baku').update({
        threshold_type: vars.threshold_type,
        threshold_persentase: vars.threshold_persentase,
        stok_ideal: vars.stok_ideal
      }).eq('id', vars.bahan_baku_id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bahan_baku_harga'] }),
  })

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
      const res = await createBahanBakuAction(vars)
      if (!res.success) {
        throw new Error(res.error || 'Gagal menyimpan bahan baku')
      }
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bahan_baku_harga'] }),
  })

  return { setHarga, setMerek, setNama, setSatuan, setImage, addSku, updateSku, deleteSku, setDefaultSku, setSkuImage, setThreshold, addBahanBaku }
}
