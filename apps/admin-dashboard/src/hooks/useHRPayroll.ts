import { useQuery } from '@tanstack/react-query'
import { getHRPayrollSummaryAction, type HRPayrollSummary } from '@/app/actions/hrPayroll'

export type { HRPayrollSummary }

export function useHRPayroll(filter: { from: string; to: string; outletId: string }) {
  return useQuery<HRPayrollSummary>({
    queryKey: ['hr_payroll_summary', filter.from, filter.to, filter.outletId],
    queryFn: () => getHRPayrollSummaryAction(filter),
    staleTime: 60_000,
  })
}
