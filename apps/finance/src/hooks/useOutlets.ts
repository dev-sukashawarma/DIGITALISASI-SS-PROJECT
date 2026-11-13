import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { Outlet } from '@/lib/types'
import { TEST_OUTLET_ID } from '@/lib/outletFilters'

/**
 * `termasukPersiapan`: sertakan outlet berstatus Persiapan (`status = 'pending'`).
 * Hanya untuk form pencatatan (biaya RAB pembukaan dicatat sebelum Go-Live).
 * Laporan memakai bawaan (false) — penyaringnya `status <> 'pending'`, bukan
 * `status = 'active'`, supaya outlet yang sudah tutup tetap ada di laporan lama.
 */
export function useOutlets(initialData?: Outlet[], opsi: { termasukPersiapan?: boolean } = {}) {
  const supabase = createClient()
  const termasukPersiapan = opsi.termasukPersiapan ?? false
  return useQuery<Outlet[]>({
    queryKey: ['outlets', termasukPersiapan],
    initialData,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      let q = supabase
        .from('outlets')
        .select('id, slug, name, address, lat, lng, type, is_active')
        // Outlet uji developer jangan masuk perhitungan (lihat @/lib/outletFilters).
        // Daftar ini memberi makan buku kas, rekap bulanan, waste, target
        // harian, bonus crew, dan pengeluaran — semuanya laporan uang.
        .neq('id', TEST_OUTLET_ID)
      if (!termasukPersiapan) q = q.neq('status', 'pending')
      const { data, error } = await q.order('name')
      if (error) throw error
      return data ?? []
    },
  })
}
