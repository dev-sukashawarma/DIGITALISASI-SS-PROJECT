'use client'

import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'

export interface OutletOption {
  id: string
  name: string
}

/** Daftar outlet untuk atribusi setoran. */
export function useOutlets() {
  const supabase = useMemo(() => createClient(), [])
  return useQuery<OutletOption[]>({
    queryKey: ['outlets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outlets')
        .select('id, name')
        .order('name', { ascending: true })
      if (error) throw error
      return (data as OutletOption[]) ?? []
    },
    staleTime: 5 * 60_000,
  })
}

export function useCashDeposit() {
  const supabase = useMemo(() => createClient(), [])
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (v: {
      location: string
      amount: number
      outletId?: string | null
      note?: string | null
      proofFile?: File | null
    }) => {
      let proofUrl: string | null = null
      if (v.proofFile) {
        const path = `deposit/${Date.now()}-${v.proofFile.name.replace(/[^\w.\-]/g, '_')}`
        const { error: upErr } = await supabase.storage.from('finance-proofs').upload(path, v.proofFile)
        if (upErr) throw upErr
        proofUrl = path
      }
      const { data, error } = await supabase.rpc('record_cash_deposit', {
        p_location: v.location,
        p_amount: v.amount,
        p_outlet: v.outletId ?? null,
        p_note: v.note ?? null,
        p_proof_url: proofUrl,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cash_transaction'] })
      qc.invalidateQueries({ queryKey: ['cash_balance'] })
    },
  })
}

export function useCashDepositHistory(filters?: { startDate?: string; endDate?: string; outletId?: string }) {
  const supabase = useMemo(() => createClient(), [])
  return useQuery({
    queryKey: ['cash_deposit_history', filters],
    queryFn: async () => {
      let q = supabase
        .from('cash_transaction')
        .select('*, cash_location:cash_location_id(label, kind), outlet:outlet_id(name)')
        .eq('source_type', 'cash_deposit')
        .order('occurred_at', { ascending: false })

      if (filters?.startDate) {
        q = q.gte('occurred_at', filters.startDate)
      }
      if (filters?.endDate) {
        q = q.lte('occurred_at', filters.endDate + 'T23:59:59.999Z')
      }
      if (filters?.outletId) {
        q = q.eq('outlet_id', filters.outletId)
      }

      const { data, error } = await q
      if (error) throw error
      return data || []
    }
  })
}

export function useShiftDepositHistory(filters?: { startDate?: string; endDate?: string; outletId?: string }) {
  const supabase = useMemo(() => createClient(), [])
  return useQuery({
    queryKey: ['shift_deposit_history', filters],
    queryFn: async () => {
      let q = supabase
        .from('shifts')
        .select('id, start_time, end_time, actual_ending_cash, expected_ending_cash, variance, starting_cash, notes, status, outlet:outlet_id(name), staff:staff_id(name)')
        .eq('status', 'closed')
        .order('end_time', { ascending: false })

      if (filters?.startDate) {
        q = q.gte('end_time', filters.startDate)
      }
      if (filters?.endDate) {
        q = q.lte('end_time', filters.endDate + 'T23:59:59.999Z')
      }
      if (filters?.outletId) {
        q = q.eq('outlet_id', filters.outletId)
      }

      const { data, error } = await q
      if (error) throw error
      return data || []
    }
  })
}

