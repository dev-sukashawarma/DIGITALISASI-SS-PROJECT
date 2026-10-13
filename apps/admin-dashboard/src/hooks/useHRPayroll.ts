import { useQuery } from '@tanstack/react-query'
import { getHRPayrollSummaryAction } from '@/app/actions/hrPayroll'
import type { HRPayrollSummary } from '@/lib/server/ringkasanPayrollHr'

export type { HRPayrollSummary }

export function useHRPayroll(filter: { from: string; to: string; outletId: string }, enabled = true) {
  return useQuery<HRPayrollSummary>({
    queryKey: ['hr_payroll_summary', filter.from, filter.to, filter.outletId],
    queryFn: () => getHRPayrollSummaryAction(filter),
    staleTime: 60_000,
    enabled,
  })
}
