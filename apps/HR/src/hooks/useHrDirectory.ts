'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { isTestOrDevStaff } from '@/lib/staffFilters'
import { isTestOutlet } from '@/lib/outletFilters'

export interface DirectoryStaff {
  id: string
  name: string | null
  username: string | null
  role: string | null
  outlet_id: string | null
}

export interface HrDirectory {
  staff: DirectoryStaff[]
  /** Akun test/dev/bot/kiosk/mitra — disembunyikan dari seluruh dashboard HR. */
  excludedStaffIds: string[]
  /** Outlet tes & marketplace. */
  excludedOutletIds: string[]
}

/**
 * Direktori staf ringan (±170 baris, di-cache 5 menit, dipakai bersama semua halaman).
 *
 * Daftar akun yang disembunyikan dikirim ke RPC (POST body) supaya penyaringan
 * terjadi di DATABASE sebelum pagination. Aturannya tetap satu sumber: isTestOrDevStaff.
 */
export function useHrDirectory() {
  return useQuery<HrDirectory>({
    queryKey: ['hr-directory'],
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async () => {
      const supabase = createClient()
      const [staffRes, outletRes] = await Promise.all([
        supabase.from('outlet_staff').select('id, name, role, username, account_category, outlet_id, email'),
        supabase.from('outlets').select('id, name, slug, type'),
      ])
      if (staffRes.error) throw staffRes.error
      if (outletRes.error) throw outletRes.error
      const all = staffRes.data ?? []
      return {
        staff: all.map(({ id, name, username, role, outlet_id }) => ({ id, name, username, role, outlet_id })),
        excludedStaffIds: all.filter((s) => isTestOrDevStaff(s)).map((s) => s.id),
        excludedOutletIds: (outletRes.data ?? [])
          .filter((o) => o.type === 'marketplace' || isTestOutlet(o))
          .map((o) => o.id),
      }
    },
  })
}
