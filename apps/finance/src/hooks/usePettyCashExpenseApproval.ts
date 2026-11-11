'use client'

import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'

export interface PendingPettyCashExpense {
  id: string
  outlet_id: string
  category: string
  amount: number
  description: string | null
  expense_date: string
  receipt_url: string | null
  created_at: string
  created_by: string | null
  status: 'pending' | 'approved' | 'rejected'
  outlet_nama: string
  pengaju_nama: string | null
}

const LABEL_KATEGORI: Record<string, string> = {
  pengeluaran_outlet: 'Operasional Outlet',
  bahan_baku: 'Bahan Baku',
  gas: 'Gas',
  transport: 'Transport',
  pln: 'PLN / Listrik',
  pdam: 'PDAM / Air',
  internet: 'Internet',
  lembur: 'Lembur',
  endorsement: 'Endorsement',
}

export function labelKategoriPettyCash(category: string | null | undefined): string {
  if (!category) return 'Pengeluaran'
  return LABEL_KATEGORI[category] ?? category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Daftar pengeluaran petty cash dari POS yang menunggu approval admin finance.
 * Kolom dipilih spesifik & difilter pada indeks parsial (status = 'pending' AND deleted_at IS NULL).
 */
export function usePettyCashExpensesMenunggu(enabled = true) {
  const supabase = useMemo(() => createClient(), [])

  return useQuery<PendingPettyCashExpense[]>({
    queryKey: ['petty_cash_expenses_pending', 'hub'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('petty_cash_expenses')
        .select(`
          id,
          outlet_id,
          category,
          amount,
          description,
          expense_date,
          receipt_url,
          created_at,
          created_by,
          status,
          outlet_staff!petty_cash_expenses_created_by_fkey(name),
          outlets!petty_cash_expenses_outlet_id_fkey!inner(name)
        `)
        .eq('status', 'pending')
        .is('deleted_at', null)
        .order('created_at', { ascending: true })

      if (error) throw error

      return ((data ?? []) as any[]).map((row) => {
        const outletObj = Array.isArray(row.outlets) ? row.outlets[0] : row.outlets
        const staffObj = Array.isArray(row.outlet_staff) ? row.outlet_staff[0] : row.outlet_staff
        return {
          id: row.id,
          outlet_id: row.outlet_id,
          category: row.category,
          amount: Number(row.amount) || 0,
          description: row.description ?? null,
          expense_date: row.expense_date,
          receipt_url: row.receipt_url ?? null,
          created_at: row.created_at,
          created_by: row.created_by ?? null,
          status: row.status,
          outlet_nama: outletObj?.name ?? '-',
          pengaju_nama: staffObj?.name ?? null,
        }
      })
    },
  })
}

/**
 * Hitungan cepat (HEAD count) untuk badge sidebar Hub Approval.
 */
export function usePettyCashExpensesPendingCount(enabled = true) {
  const supabase = useMemo(() => createClient(), [])

  return useQuery<number>({
    queryKey: ['petty_cash_expenses_pending', 'count'],
    enabled,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('petty_cash_expenses')
        .select('id, outlets!petty_cash_expenses_outlet_id_fkey!inner(id)', { count: 'exact', head: true })
        .eq('status', 'pending')
        .is('deleted_at', null)

      if (error) throw error
      return count ?? 0
    },
  })
}

export function useReviewPettyCashExpense() {
  const supabase = useMemo(() => createClient(), [])
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      expenseId: string
      action: 'approve' | 'reject'
      reason?: string
    }) => {
      const { data, error } = await supabase.rpc('review_petty_cash_expense', {
        p_expense_id: params.expenseId,
        p_action: params.action,
        p_reason: params.reason ?? null,
      })
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['petty_cash_expenses_pending'] })
      queryClient.invalidateQueries({ queryKey: ['petty_cash_expenses_detail'] })
      queryClient.invalidateQueries({ queryKey: ['petty_cash_real_balances'] })
      queryClient.invalidateQueries({ queryKey: ['approval_log'] })
    },
  })
}
