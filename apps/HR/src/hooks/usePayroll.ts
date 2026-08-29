import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { PayrollRecord } from '@/lib/types'

export function usePayroll(month: number, year: number) {
  const supabase = createClient()

  return useQuery<PayrollRecord[]>({
    queryKey: ['payroll', month, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_records')
        .select(`
          *,
          outlet_staff!payroll_records_staff_id_fkey(
            name,
            role,
            outlet_id,
            phone,
            outlets!outlet_staff_outlet_id_fkey(name),
            financials:staff_financials(
              bank_name,
              bank_account_number,
              bank_account_name
            )
          )
        `)
        .eq('period_month', month)
        .eq('period_year', year)
        .order('created_at', { ascending: false })

      if (error) throw error
      const rawData = (data as unknown as any[]) ?? []
      return rawData
        .filter((r) => r.outlet_staff?.role !== 'kiosk')
        .map((r) => ({
          ...r,
          outlet_staff: {
            ...r.outlet_staff,
            financials: Array.isArray(r.outlet_staff?.financials)
              ? r.outlet_staff?.financials[0]
              : (r.outlet_staff?.financials || null),
          },
        })) as PayrollRecord[]
    },
    enabled: !!month && !!year,
  })
}
