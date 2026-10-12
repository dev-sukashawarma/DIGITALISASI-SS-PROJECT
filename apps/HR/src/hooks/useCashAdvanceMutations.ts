import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { CashAdvanceStatus } from '@/lib/types'

export interface ApproveCashAdvancePayload {
  id: string
  amount?: number
  originalAmount?: number
  approvalNote?: string | null
}

export function useCashAdvanceMutations() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async ({
      staff_id,
      amount,
      reason,
      installment_months,
    }: {
      staff_id: string
      amount: number
      reason: string
      installment_months?: number
    }) => {
      const { error } = await supabase.from('cash_advances').insert({
        staff_id,
        amount,
        amount_requested: amount,
        remaining: amount,
        reason,
        status: 'active' as CashAdvanceStatus,
        status_hr: 'approved',
        installment_months: installment_months || 1,
        approved_at: new Date().toISOString(),
      })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-advances'] })
      queryClient.invalidateQueries({ queryKey: ['perizinan-summary'] })
      queryClient.invalidateQueries({ queryKey: ['hr-activity'] })
    },
  })

  const addPayment = useMutation({
    mutationFn: async ({
      cash_advance_id,
      amount,
      note,
      currentRemaining,
    }: {
      cash_advance_id: string
      amount: number
      note: string | null
      currentRemaining: number
    }) => {
      const { error: payErr } = await supabase
        .from('cash_advance_payments')
        .insert({
          cash_advance_id,
          amount,
          payment_date: new Date().toISOString().split('T')[0],
          note,
        })

      if (payErr) throw payErr

      const newRemaining = currentRemaining - amount
      const updatePayload: { remaining: number; status?: CashAdvanceStatus } = {
        remaining: newRemaining,
      }

      if (newRemaining <= 0) {
        updatePayload.status = 'paid_off'
        updatePayload.remaining = 0
      }

      const { error: updErr } = await supabase
        .from('cash_advances')
        .update(updatePayload)
        .eq('id', cash_advance_id)

      if (updErr) throw updErr
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-advances'] })
      queryClient.invalidateQueries({ queryKey: ['perizinan-summary'] })
    },
  })

  const approve = useMutation({
    mutationFn: async (payload: string | ApproveCashAdvancePayload) => {
      const id = typeof payload === 'string' ? payload : payload.id
      const amount = typeof payload === 'string' ? undefined : payload.amount
      const originalAmount = typeof payload === 'string' ? undefined : payload.originalAmount
      const approvalNote = typeof payload === 'string' ? undefined : payload.approvalNote

      const updateData: Record<string, any> = {
        status_hr: 'approved',
        status: 'active',
        approved_at: new Date().toISOString(),
      }

      if (amount !== undefined) {
        updateData.amount = amount
        updateData.remaining = amount
      }
      if (originalAmount !== undefined) {
        updateData.amount_requested = originalAmount
      }
      if (approvalNote !== undefined) {
        updateData.approval_note = approvalNote
      }

      const { error } = await supabase
        .from('cash_advances')
        .update(updateData)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-advances'] })
      queryClient.invalidateQueries({ queryKey: ['perizinan-summary'] })
      queryClient.invalidateQueries({ queryKey: ['hr-activity'] })
    },
  })

  const reject = useMutation({
    mutationFn: async (payload: string | { id: string; note?: string }) => {
      const id = typeof payload === 'string' ? payload : payload.id
      const note = typeof payload === 'string' ? null : (payload.note ?? null)
      const { error } = await supabase
        .from('cash_advances')
        .update({
          status_hr: 'rejected',
          rejection_note: note,
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-advances'] })
      queryClient.invalidateQueries({ queryKey: ['perizinan-summary'] })
      queryClient.invalidateQueries({ queryKey: ['hr-activity'] })
    },
  })

  return { create, addPayment, approve, reject }
}
