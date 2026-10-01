import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { CashAdvanceStatus } from '@/lib/types'

export function useCashAdvanceMutations() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async ({
      staff_id,
      amount,
      reason,
    }: {
      staff_id: string
      amount: number
      reason: string
    }) => {
      const { error } = await supabase.from('cash_advances').insert({
        staff_id,
        amount,
        remaining: amount,
        reason,
        status: 'active' as CashAdvanceStatus,
        status_hr: 'approved',
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
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('cash_advances')
        .update({
          status_hr: 'approved',
          status: 'active',
          approved_at: new Date().toISOString(),
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
