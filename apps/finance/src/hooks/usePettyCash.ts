'use client'

import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { PettyCashTopup, DisbursementMethod } from '@/lib/types'
import { processPettyCashFinanceCustomAmount } from '@/app/actions/pettyCash'

export function usePettyCashRequests(status?: string, initialData?: PettyCashTopup[], regionFilter?: string) {
  const supabase = useMemo(() => createClient(), [])

  return useQuery<PettyCashTopup[]>({
    queryKey: ['petty_cash_topups', status, regionFilter],
    initialData,
    queryFn: async () => {
      let query = supabase
        .from('petty_cash_topups')
        .select(`
          *,
          outlet_staff!petty_cash_topups_created_by_fkey(name),
          outlets!petty_cash_topups_outlet_id_fkey!inner(name, region)
        `)
        .order('created_at', { ascending: false })
      
      if (status) {
        query = query.eq('status', status)
      }

      if (regionFilter) {
        query = query.ilike('outlets.region', regionFilter)
      }

      const { data, error } = await query
      if (error) throw error

      // Flatten the joined data
      return (data as any[]).map(row => ({
        ...row,
        reason: row.description,
        outlet_staff: row.outlet_staff ? { name: row.outlet_staff.name } : null,
        outlet: row.outlets ? { id: row.outlet_id, name: row.outlets.name } : null
      })) as PettyCashTopup[]
    },
  })
}

export function useCreatePettyCashTopup() {
  const supabase = useMemo(() => createClient(), [])
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: {
      outletId: string
      amount: number
      description: string
      bankName?: string
      bankAccountNumber?: string
      bankAccountName?: string
    }) => {
      const { data, error } = await supabase.rpc('create_petty_cash_topup', {
        p_outlet_id: payload.outletId,
        p_amount: payload.amount,
        p_description: payload.description,
        p_bank_name: payload.bankName || null,
        p_bank_account_number: payload.bankAccountNumber || null,
        p_bank_account_name: payload.bankAccountName || null,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['petty_cash_topups'] })
    }
  })
}

export function useProcessPettyCashLeader() {
  const supabase = useMemo(() => createClient(), [])
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'approve' | 'reject' }) => {
      const { error } = await supabase.rpc('review_petty_cash_topup', {
        p_topup_id: id,
        p_action: action
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['petty_cash_topups'] })
    }
  })
}

export function useProcessPettyCashAreaManager() {
  const supabase = useMemo(() => createClient(), [])
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'approve' | 'reject' }) => {
      const { error } = await supabase.rpc('area_manager_process_petty_cash', {
        p_topup_id: id,
        p_action: action
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['petty_cash_topups'] })
    }
  })
}

export function useProcessPettyCashFinance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ 
      id, 
      action, 
      method = 'transfer', 
      cashLocationId,
      proofOfTransferUrl,
      approvedAmount,
      approvalNote
    }: { 
      id: string; 
      action: 'approve' | 'reject';
      method?: DisbursementMethod;
      cashLocationId?: string;
      proofOfTransferUrl?: string;
      approvedAmount?: number;
      approvalNote?: string;
    }) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id || '00000000-0000-0000-0000-000000000000'

      const result = await processPettyCashFinanceCustomAmount({
        id,
        action,
        method,
        cashLocationId: cashLocationId || null,
        proofOfTransferUrl: proofOfTransferUrl || null,
        approvedAmount: approvedAmount ?? null,
        approvalNote: approvalNote || null,
        userId
      })
      
      if (!result.success) {
        throw new Error(result.error || 'Gagal memproses pencairan')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['petty_cash_topups'] })
    }
  })
}

export function useForwardPettyCashFinance() {
  const supabase = useMemo(() => createClient(), [])
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase.rpc('finance_forward_funds', {
        p_topup_id: id
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['petty_cash_topups'] })
    }
  })
}

export function useForwardPettyCashAreaManager() {
  const supabase = useMemo(() => createClient(), [])
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase.rpc('area_manager_forward_funds', {
        p_topup_id: id
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['petty_cash_topups'] })
    }
  })
}

export function useForwardPettyCashLeader() {
  const supabase = useMemo(() => createClient(), [])
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase.rpc('leader_forward_funds', {
        p_topup_id: id
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['petty_cash_topups'] })
    }
  })
}

export function useReceivePettyCashCrew() {
  const supabase = useMemo(() => createClient(), [])
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase.rpc('crew_receive_funds', {
        p_topup_id: id
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['petty_cash_topups'] })
    }
  })
}
