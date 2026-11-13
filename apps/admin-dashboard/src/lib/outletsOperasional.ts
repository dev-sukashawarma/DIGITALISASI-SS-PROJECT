import type { SupabaseClient } from '@supabase/supabase-js'
import type { Outlet } from '@/lib/types'
import { isTestOutlet, TEST_OUTLET_ID } from '@/lib/outletFilters'

export interface OpsiOutletsOperasional {
  /**
   * Sertakan outlet berstatus Persiapan (`status = 'pending'`). Hanya untuk layar
   * tempat persiapan dikerjakan (input pengeluaran/RAB, HR, target). Laporan
   * memakai bawaan (false). Penyaringnya `status <> 'pending'`, BUKAN
   * `status = 'active'`: laporan bulan lalu tetap butuh outlet yang sudah tutup.
   */
  termasukPersiapan?: boolean
}

export async function fetchOutletsOperasional(
  supabase: SupabaseClient,
  opsi: OpsiOutletsOperasional = {},
): Promise<Outlet[]> {
  let q = supabase
    .from('outlets')
    .select('id, slug, name, address, lat, lng, type, is_active, status, marquee_warning_threshold, open_hour, close_hour, deleted_at')
    .neq('type', 'marketplace')
    .neq('id', TEST_OUTLET_ID)
  if (!opsi.termasukPersiapan) q = q.neq('status', 'pending')
  const { data, error } = await q.order('name')
  if (error) throw error
  return ((data ?? []) as Outlet[]).filter(o => !isTestOutlet(o))
}
