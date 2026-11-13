'use client'

import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { KasbonMenunggu } from '@/lib/approval/kasbon'

const KUNCI_MENUNGGU = ['kasbon_menunggu'] as const

/** Antrean kasbon yang sudah disetujui HR dan menunggu pencairan (RPC: nama staf tertahan RLS). */
export function useKasbonMenunggu(enabled: boolean) {
  const supabase = useMemo(() => createClient(), [])
  return useQuery<KasbonMenunggu[]>({
    queryKey: KUNCI_MENUNGGU,
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('finance_kasbon_menunggu')
      if (error) throw error
      return ((data ?? []) as KasbonMenunggu[]).map((k) => ({ ...k, amount: Number(k.amount) || 0 }))
    },
  })
}

export function useKasbonMenungguCount(enabled: boolean) {
  const q = useKasbonMenunggu(enabled)
  return { data: q.data?.length, error: q.error, isLoading: q.isLoading }
}

function useSegarkanKasbon() {
  const qc = useQueryClient()
  return () => {
    for (const queryKey of [KUNCI_MENUNGGU, ['approval_log'], ['cash_balance'], ['cash_transaction'], ['mutasi_rekening'], ['kasbon_status']]) {
      qc.invalidateQueries({ queryKey })
    }
  }
}

function namaAman(nama: string): string {
  return nama.replace(/[^\w.\-]/g, '_')
}

/** Unggah bukti ke finance-proofs lalu RPC finance_cairkan_kasbon. Galat RPC dilempar apa adanya. */
export function useCairkanKasbon() {
  const supabase = useMemo(() => createClient(), [])
  const segarkan = useSegarkanKasbon()
  return useMutation({
    mutationFn: async (v: { id: string; cashLocationId: string; proofFile: File }) => {
      const path = `kasbon/${v.id}-${Date.now()}-${namaAman(v.proofFile.name)}`
      const { error: upErr } = await supabase.storage.from('finance-proofs').upload(path, v.proofFile)
      if (upErr) throw upErr
      const { data, error } = await supabase.rpc('finance_cairkan_kasbon', {
        p_id: v.id,
        p_cash_location_id: v.cashLocationId,
        p_bukti: path,
      })
      if (error) throw error
      return data as string
    },
    onSettled: segarkan,
  })
}

export function useTolakKasbon() {
  const supabase = useMemo(() => createClient(), [])
  const segarkan = useSegarkanKasbon()
  return useMutation({
    mutationFn: async (v: { id: string; alasan: string }) => {
      const { error } = await supabase.rpc('finance_tolak_kasbon', { p_id: v.id, p_alasan: v.alasan.trim() })
      if (error) throw error
    },
    onSettled: segarkan,
  })
}

export function useBatalCairKasbon() {
  const supabase = useMemo(() => createClient(), [])
  const segarkan = useSegarkanKasbon()
  return useMutation({
    mutationFn: async (v: { id: string; alasan: string }) => {
      const { error } = await supabase.rpc('finance_batal_cair_kasbon', { p_id: v.id, p_alasan: v.alasan.trim() })
      if (error) throw error
    },
    onSettled: segarkan,
  })
}

export interface StatusKasbon {
  id: string
  status: string
  amount: number
  remaining: number | null
}

/** Status kasbon terkini untuk baris riwayat (tombol batal pencairan). */
export function useStatusKasbon(ids: string[]) {
  const supabase = useMemo(() => createClient(), [])
  const kunci = [...ids].sort()
  return useQuery<Record<string, StatusKasbon>>({
    queryKey: ['kasbon_status', kunci],
    enabled: kunci.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('cash_advances').select('id, status, amount, remaining').in('id', kunci)
      if (error) throw error
      return Object.fromEntries(
        ((data ?? []) as StatusKasbon[]).map((k) => [
          k.id,
          { ...k, amount: Number(k.amount) || 0, remaining: k.remaining == null ? null : Number(k.remaining) },
        ]),
      )
    },
  })
}
