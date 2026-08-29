'use client'

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { PayrollRecord } from '@/lib/types'

export function usePayroll(month: number, year: number) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Realtime subscription to payroll, attendance, and cash advance changes
  useEffect(() => {
    const channel = supabase
      .channel(`payroll-realtime-${month}-${year}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payroll_records' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['payroll', month, year] })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['payroll', month, year] })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_logs' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['payroll', month, year] })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cash_advances' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['payroll', month, year] })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'staff_financials' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['payroll', month, year] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient, month, year])

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
    refetchInterval: 10_000, // 10s fallback polling
  })
}
