import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import StaffView from './StaffView'

export const dynamic = 'force-dynamic'

export default async function StaffPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {}
  })
  
  const queryClient = new QueryClient()
  
  // 1. Fetch Outlets
  const { data: outlets } = await supabase
    .from('outlets')
    .select('id, slug, name, address, lat, lng, type, is_active')
    .order('name')
  
  if (outlets) {
    queryClient.setQueryData(['outlets'], outlets)
  }

  // 2. Fetch Staff
  const { data: staffData } = await supabase
    .from('outlet_staff')
    .select(`
      id, name, role, status, username, outlet_id,
      nik, email, phone, address_ktp, address_domicile,
      birth_place, birth_date, gender, religion,
      emergency_name, emergency_relationship, emergency_phone,
      nip, contract_type, join_date, resign_date, leave_quota,
      outlets!outlet_staff_outlet_id_fkey(name),
      staff_outlets(outlet_id),
      staff_financials(
        basic_salary, allowance_position, allowance_presence,
        bank_name, bank_account_number, bank_account_name,
        npwp, bpjs_ketenagakerjaan, bpjs_kesehatan
      )
    `)
    .order('created_at', { ascending: false })

  if (staffData) {
    const parsed = staffData.map((r: any) => ({
      ...r,
      outlet_ids: (r.staff_outlets ?? []).map((s: any) => s.outlet_id),
      financials: Array.isArray(r.staff_financials)
        ? r.staff_financials[0]
        : (r.staff_financials || null),
    }))
    queryClient.setQueryData(['staff'], parsed)
  }
  
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <StaffView />
    </HydrationBoundary>
  )
}
