'use client'

import { useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { CashDirection, CashKind } from '@/lib/types'

export function useCashMutations() {
  const supabase = useMemo(() => createClient(), [])
  const qc = useQueryClient()

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['cash_transaction'] })
    qc.invalidateQueries({ queryKey: ['cash_balance'] })
    qc.invalidateQueries({ queryKey: ['cash_location'] })
  }

  // Maker: buat transaksi manual (pending_approval).
  const submit = useMutation({
    mutationFn: async (v: {
      location: string
      direction: CashDirection
      amount: number
      category?: string | null
      note?: string | null
    }) => {
      const { data, error } = await supabase.rpc('submit_cash_transaction', {
        p_location: v.location,
        p_direction: v.direction,
        p_amount: v.amount,
        p_category: v.category ?? 'manual',
        p_source_type: 'manual',
        p_note: v.note ?? null,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: invalidate,
  })

  // Checker: approve.
  const approve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('approve_cash_transaction', { p_id: id })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  // Checker: reject.
  const reject = useMutation({
    mutationFn: async (v: { id: string; reason?: string | null }) => {
      const { error } = await supabase.rpc('reject_cash_transaction', {
        p_id: v.id,
        p_reason: v.reason ?? null,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  // Finance: tandai approved → reconciled (menggerakkan saldo).
  const markPaid = useMutation({
    mutationFn: async (v: { id: string; proofUrl?: string | null }) => {
      const { error } = await supabase.rpc('mark_cash_transaction_paid', {
        p_id: v.id,
        p_proof_url: v.proofUrl ?? null,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  // Checker: transfer dua-kaki (Kas Pusat → bank), langsung reconciled.
  const transfer = useMutation({
    mutationFn: async (v: { from: string; to: string; amount: number; note?: string | null }) => {
      const { data, error } = await supabase.rpc('record_cash_transfer', {
        p_from: v.from,
        p_to: v.to,
        p_amount: v.amount,
        p_note: v.note ?? null,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: invalidate,
  })

  // Checker: buat lokasi kas (rekening / Kas Pusat).
  const createLocation = useMutation({
    mutationFn: async (v: {
      label: string
      kind: CashKind
      bank_name?: string | null
      account_no?: string | null
      holder_name?: string | null
    }) => {
      const { error } = await supabase.from('cash_location').insert({
        label: v.label,
        kind: v.kind,
        bank_name: v.bank_name ?? null,
        account_no: v.account_no ?? null,
        holder_name: v.holder_name ?? null,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  // Checker: edit lokasi kas (rekening / Kas Pusat).
  const updateLocation = useMutation({
    mutationFn: async (v: {
      id: string
      label: string
      kind: CashKind
      bank_name?: string | null
      account_no?: string | null
      holder_name?: string | null
    }) => {
      const { error } = await supabase.from('cash_location').update({
        label: v.label,
        kind: v.kind,
        bank_name: v.bank_name ?? null,
        account_no: v.account_no ?? null,
        holder_name: v.holder_name ?? null,
      }).eq('id', v.id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { submit, approve, reject, markPaid, transfer, createLocation, updateLocation }
}
