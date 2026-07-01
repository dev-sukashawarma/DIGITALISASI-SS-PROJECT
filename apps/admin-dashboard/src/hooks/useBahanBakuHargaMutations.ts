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

  return { setHarga }
}
