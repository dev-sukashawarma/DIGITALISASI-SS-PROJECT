import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { Outlet } from '@/lib/types'
import { TEST_OUTLET_ID } from '@/lib/outletFilters'

export function useOutlets(initialData?: Outlet[]) {
  const supabase = createClient()
  return useQuery<Outlet[]>({
    queryKey: ['outlets'],
    initialData,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outlets')
        .select('id, slug, name, address, lat, lng, type, is_active')
        // Outlet uji developer jangan masuk perhitungan (lihat @/lib/outletFilters).
        // Daftar ini memberi makan buku kas, rekap bulanan, waste, target
        // harian, bonus crew, dan pengeluaran — semuanya laporan uang.
        .neq('id', TEST_OUTLET_ID)
        .order('name')
      if (error) throw error
      return data ?? []
    },
  })
}
