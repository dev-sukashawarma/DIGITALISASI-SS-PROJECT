import { useMutation, useQueryClient } from '@tanstack/react-query'
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

  return { setHarga, setSatuan, setImage }
}
