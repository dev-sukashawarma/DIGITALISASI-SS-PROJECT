'use client'

import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'

export type PayrollPaymentStatus = 'unpaid' | 'pending' | 'paid'

export interface PayrollSlip {
  id: string
  staff_id: string
  period_month: number
  period_year: number
  total_salary: number
  status: string
  payment_status: PayrollPaymentStatus
  paid_at: string | null
  cash_transaction_id: string | null
  outlet_staff: {
    name: string
    role: string
    staff_financials?: {
      bank_name: string | null
      bank_account_number: string | null
      bank_account_name: string | null
    } | null
  } | null
}

/** Slip gaji FINAL untuk satu periode (dengan nama & rekening staff). */
export function usePayrollSlips(month: number, year: number, initialData?: PayrollSlip[]) {
  const supabase = useMemo(() => createClient(), [])
  return useQuery<PayrollSlip[]>({
    queryKey: ['payroll_slips', month, year],
    initialData,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_records')
        .select(
          `id, staff_id, period_month, period_year, total_salary, status,
           payment_status, paid_at, cash_transaction_id,
           outlet_staff:staff_id(
             name, role,
             staff_financials(bank_name, bank_account_number, bank_account_name)
           )`
        )
        .eq('period_month', month)
        .eq('period_year', year)
        .eq('status', 'finalized')
        .order('payment_status', { ascending: true })
      if (error) throw error
      return (data as unknown as PayrollSlip[]) ?? []
    },
    enabled: !!month && !!year,
  })
}

export function usePayrollDisburse() {
  const supabase = useMemo(() => createClient(), [])
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { month: number; year: number; location: string }) => {
      const { data, error } = await supabase.rpc('disburse_payroll', {
        p_month: v.month,
        p_year: v.year,
        p_location: v.location,
      })
      if (error) throw error
      return data as number
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll_slips'] })
      qc.invalidateQueries({ queryKey: ['cash_transaction'] })
    },
  })
}
