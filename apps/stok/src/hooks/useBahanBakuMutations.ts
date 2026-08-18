import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createBahanBakuAction } from '@/app/actions/bahanBakuActions'

export function useBahanBakuMutations() {
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
      const res = await createBahanBakuAction(vars)
      if (!res.success) {
        throw new Error(res.error || 'Gagal menyimpan bahan baku')
      }
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fluktuasi-harga'] })
      qc.invalidateQueries({ queryKey: ['bahan_baku'] })
    },
  })

  return { addBahanBaku }
}

