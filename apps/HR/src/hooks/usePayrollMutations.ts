import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { PayrollStatus } from '@/lib/types'

export function usePayrollMutations() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const generate = useMutation({
    mutationFn: async ({ month, year }: { month: number; year: number }) => {
      /* 1. Fetch all active staff with their financials */
      const { data: staff, error: staffErr } = await supabase
        .from('outlet_staff')
        .select(`
          id,
          name,
          role,
          status,
          staff_financials(
            basic_salary,
            allowance_position,
            allowance_presence
          )
        `)
        .eq('status', 'active')
        .neq('role', 'kiosk')

      if (staffErr) throw staffErr
      if (!staff || staff.length === 0) throw new Error('Tidak ada staf aktif ditemukan.')

      /* 2. Build payroll rows */
      const rows = staff.map((s: any) => {
        const fin = Array.isArray(s.staff_financials)
          ? s.staff_financials[0]
          : s.staff_financials

        const basicSalary = fin?.basic_salary ?? 0
        const allowancePosition = fin?.allowance_position ?? 0
        const allowancePresence = fin?.allowance_presence ?? 0
        const totalSalary = basicSalary + allowancePosition + allowancePresence

        return {
          staff_id: s.id,
          period_month: month,
          period_year: year,
          basic_salary: basicSalary,
          allowance_position: allowancePosition,
          allowance_presence: allowancePresence,
          bonus: 0,
          bonus_note: null,
          deductions: 0,
          deduction_note: null,
          total_salary: totalSalary,
          status: 'draft' as PayrollStatus,
        }
      })

      /* 3. Bulk upsert */
      const { error: upsertErr } = await supabase
        .from('payroll_records')
        .upsert(rows, { onConflict: 'staff_id,period_month,period_year' })

      if (upsertErr) throw upsertErr

      return rows.length
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] })
    },
  })

  const updateSlip = useMutation({
    mutationFn: async ({
      id,
      basic_salary,
      allowance_position,
      allowance_presence,
      bonus,
      bonus_note,
      deductions,
      deduction_note,
    }: {
      id: string
      basic_salary: number
      allowance_position: number
      allowance_presence: number
      bonus: number
      bonus_note: string | null
      deductions: number
      deduction_note: string | null
    }) => {
      const totalSalary =
        basic_salary + allowance_position + allowance_presence + bonus - deductions

      const { error } = await supabase
        .from('payroll_records')
        .update({
          basic_salary,
          allowance_position,
          allowance_presence,
          bonus,
          bonus_note,
          deductions,
          deduction_note,
          total_salary: totalSalary,
        })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] })
    },
  })

  const finalizeAll = useMutation({
    mutationFn: async ({ month, year }: { month: number; year: number }) => {
      const { error } = await supabase
        .from('payroll_records')
        .update({ status: 'finalized' as PayrollStatus })
        .eq('period_month', month)
        .eq('period_year', year)
        .eq('status', 'draft')

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] })
    },
  })

  return { generate, updateSlip, finalizeAll }
}
