'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  EtollCard,
  EtollCardAssignment,
  EtollCategory,
  EtollIssuer,
  EtollScan,
  EtollTerminalEntry,
  EtollTopup,
  EtollTopupStatus,
  EtollTransaction,
} from '@/lib/etoll/types'

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.error || `Request gagal (${res.status})`)
  }
  return data as T
}

export function useEtollCards() {
  return useQuery({
    queryKey: ['etoll', 'cards'],
    queryFn: () => apiJson<{ cards: EtollCard[] }>('/api/etoll/cards'),
  })
}

export function useEtollCardDetail(cardId: string | null) {
  return useQuery({
    queryKey: ['etoll', 'card-detail', cardId],
    enabled: Boolean(cardId),
    queryFn: () =>
      apiJson<{
        card: EtollCard
        assignments: EtollCardAssignment[]
        scans: EtollScan[]
        topups: EtollTopup[]
      }>(`/api/etoll/cards/${cardId}`),
  })
}

export interface EtollTxFilters {
  from: string
  to: string
  cardId?: string
  holderId?: string
  category?: string
  txType?: string
  source?: string
  search?: string
}

export function useEtollTransactions(filters: EtollTxFilters) {
  const params = new URLSearchParams()
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.cardId && filters.cardId !== 'all') params.set('cardId', filters.cardId)
  if (filters.holderId && filters.holderId !== 'all') params.set('holderId', filters.holderId)
  if (filters.category && filters.category !== 'all') params.set('category', filters.category)
  if (filters.txType && filters.txType !== 'all') params.set('txType', filters.txType)
  if (filters.source && filters.source !== 'all') params.set('source', filters.source)
  if (filters.search?.trim()) params.set('search', filters.search.trim())

  return useQuery({
    queryKey: ['etoll', 'transactions', filters],
    queryFn: () =>
      apiJson<{
        transactions: EtollTransaction[]
        summary: {
          totalDebit: number
          totalTopup: number
          totalUntrackedGap: number
          uncategorizedCount: number
          count: number
        }
      }>(`/api/etoll/transactions?${params.toString()}`),
  })
}

export function useEtollTopups(cardId?: string) {
  const params = new URLSearchParams()
  if (cardId && cardId !== 'all') params.set('cardId', cardId)
  return useQuery({
    queryKey: ['etoll', 'topups', cardId ?? 'all'],
    queryFn: () => apiJson<{ topups: EtollTopup[] }>(`/api/etoll/topups?${params.toString()}`),
  })
}

export function useEtollDictionary() {
  return useQuery({
    queryKey: ['etoll', 'dictionary'],
    queryFn: () => apiJson<{ entries: EtollTerminalEntry[] }>('/api/etoll/dictionary'),
  })
}

export function useEtollReference() {
  return useQuery({
    queryKey: ['etoll', 'reference'],
    staleTime: 5 * 60_000,
    queryFn: () =>
      apiJson<{
        staff: { id: string; name: string; role: string; outlet_id: string | null }[]
        outlets: { id: string; name: string; type: string }[]
      }>('/api/etoll/reference'),
  })
}

export function useCreateEtollCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: {
      card_number: string
      issuer: EtollIssuer
      label: string
      holder_staff_id?: string | null
      outlet_id?: string | null
      division?: string | null
      vehicle_plate?: string | null
      initial_balance?: number
      notes?: string | null
    }) => apiJson<{ card: EtollCard }>('/api/etoll/cards', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['etoll', 'cards'] })
    },
  })
}

export function useUpdateEtollCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: {
      id: string
      label?: string
      status?: 'active' | 'inactive' | 'lost'
      holder_staff_id?: string | null
      outlet_id?: string | null
      division?: string | null
      vehicle_plate?: string | null
      notes?: string | null
      handover_note?: string | null
    }) =>
      apiJson<{ card: EtollCard; handover_recorded: boolean }>(`/api/etoll/cards/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['etoll', 'cards'] })
      qc.invalidateQueries({ queryKey: ['etoll', 'card-detail', vars.id] })
    },
  })
}

export function useTagEtollTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      category,
      merchant_label,
      note,
      save_to_dictionary,
    }: {
      id: string
      category: EtollCategory
      merchant_label?: string
      note?: string
      save_to_dictionary?: boolean
    }) =>
      apiJson<{ transaction: EtollTransaction; dictionary_saved: boolean }>(
        `/api/etoll/transactions/${id}/tag`,
        {
          method: 'PATCH',
          body: JSON.stringify({ category, merchant_label, note, save_to_dictionary }),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['etoll', 'transactions'] })
      qc.invalidateQueries({ queryKey: ['etoll', 'dictionary'] })
    },
  })
}

export function useSaveDictionaryEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: {
      issuer: EtollIssuer | 'all'
      terminal_code: string
      merchant_name: string
      default_category: string
      notes?: string
    }) =>
      apiJson<{ entry: EtollTerminalEntry }>('/api/etoll/dictionary', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['etoll', 'dictionary'] })
      qc.invalidateQueries({ queryKey: ['etoll', 'transactions'] })
    },
  })
}

export function useDeleteDictionaryEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiJson<{ ok: boolean }>(`/api/etoll/dictionary/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['etoll', 'dictionary'] })
    },
  })
}

export function useCreateEtollTopup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: {
      card_id: string
      topup_date: string
      amount: number
      funding_source?: string
      reference_no?: string
      note?: string
    }) =>
      apiJson<{ topup: EtollTopup; auto_matched: boolean }>('/api/etoll/topups', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['etoll', 'topups'] })
    },
  })
}

export function useUpdateEtollTopupStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      status,
      mismatch_note,
    }: {
      id: string
      status: EtollTopupStatus
      mismatch_note?: string
    }) =>
      apiJson<{ topup: EtollTopup }>(`/api/etoll/topups/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, mismatch_note }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['etoll', 'topups'] })
    },
  })
}
