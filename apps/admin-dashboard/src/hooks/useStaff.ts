import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { StaffRow } from '@/lib/types'

export function useStaff() {
  const supabase = createClient()
  return useQuery<StaffRow[]>({
    queryKey: ['staff'],
    queryFn: async () => {
      const { data, error } = await supabase
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
      if (error) throw error
      return (data ?? []).map((r: any) => ({
        ...r,
        outlet_ids: (r.staff_outlets ?? []).map((s: any) => s.outlet_id),
        financials: Array.isArray(r.staff_financials)
          ? r.staff_financials[0]
          : (r.staff_financials || null),
      })) as StaffRow[]
    },
  })
}
