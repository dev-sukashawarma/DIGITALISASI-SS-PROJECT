'use client'
import { useId } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRealtimeInvalidate } from '@suka/realtime'
import {
  getOutletBudgetStatus,
  getAllOutletsBudgetStatus,
  getOutletSpendingHistory,
  getOutletBudgetHistory,
  updateOutletBudgetConfigAction,
  getOutletTopupRequestsAction,
  requestBudgetTopupAction,
  approveBudgetTopupAction
} from '@/app/actions/budget'
import type { PeriodType } from '@/lib/stok/budget'

export function useOutletBudgetStatus(outletId: string | undefined) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['outlet_budget_status', outletId],
    queryFn: () => getOutletBudgetStatus(outletId as string),
    enabled: !!outletId,
    staleTime: 25000,
    gcTime: 60000,
  })

  const instanceId = useId()
  useRealtimeInvalidate({
    channelName: `outlet_budget_status_${outletId ?? 'none'}_${instanceId}`,
    enabled: !!outletId,
    subs: [
      {
        table: 'permintaan_bahan',
        filter: outletId ? `outlet_id=eq.${outletId}` : undefined,
        queryKeys: [['outlet_budget_status', outletId]],
      },
      {
        table: 'outlet_budget_config',
        filter: outletId ? `outlet_id=eq.${outletId}` : undefined,
        queryKeys: [['outlet_budget_status', outletId]],
      },
    ],
  })

  return {
    status: data ?? null,
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refresh: refetch,
  }
}

export function useAllOutletsBudgetStatus() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['all_outlets_budget_status'],
    queryFn: () => getAllOutletsBudgetStatus(),
    staleTime: 20000,
    gcTime: 60000,
  })

  const instanceId = useId()
  useRealtimeInvalidate({
    channelName: `all_outlets_budget_status_${instanceId}`,
    subs: [
      {
        table: 'outlet_budget_config',
        queryKeys: [['all_outlets_budget_status']],
      },
      {
        table: 'permintaan_bahan',
        queryKeys: [['all_outlets_budget_status']],
      },
    ],
  })

  return {
    outlets: data ?? [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refresh: refetch,
  }
}

export function useOutletSpendingHistory(outletId: string | null, fromDate?: string, toDate?: string) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['outlet_spending_history', outletId, fromDate, toDate],
    queryFn: () => (outletId ? getOutletSpendingHistory(outletId, fromDate, toDate) : Promise.resolve([])),
    enabled: !!outletId,
    staleTime: 20000,
    gcTime: 60000,
  })

  const instanceId = useId()
  useRealtimeInvalidate({
    channelName: `outlet_spending_${outletId ?? 'none'}_${instanceId}`,
    enabled: !!outletId,
    subs: [
      {
        table: 'permintaan_bahan',
        filter: outletId ? `outlet_id=eq.${outletId}` : undefined,
        queryKeys: [['outlet_spending_history', outletId, fromDate, toDate]],
      },
    ],
  })

  return {
    transactions: data ?? [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refresh: refetch,
  }
}

export function useOutletBudgetHistory(outletId: string | null) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['outlet_budget_history', outletId],
    queryFn: () => (outletId ? getOutletBudgetHistory(outletId) : Promise.resolve([])),
    enabled: !!outletId,
    staleTime: 30000,
  })

  return {
    history: data ?? [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refresh: refetch,
  }
}

export function useUpdateOutletBudgetConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: {
      outletId: string
      nominal: number
      periodType: PeriodType
      customDays?: number | null
      catatan?: string
    }) => updateOutletBudgetConfigAction(input),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['all_outlets_budget_status'] })
      queryClient.invalidateQueries({ queryKey: ['outlet_budget_status', vars.outletId] })
      queryClient.invalidateQueries({ queryKey: ['outlet_budget_history', vars.outletId] })
    },
  })
}

export function useOutletTopupRequests(outletId?: string) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['outlet_topup_requests', outletId],
    queryFn: () => getOutletTopupRequestsAction(outletId),
  })

  const instanceId = useId()
  useRealtimeInvalidate({
    channelName: `outlet_topup_requests_${outletId ?? 'all'}_${instanceId}`,
    subs: [
      {
        table: 'outlet_budget_topup_requests',
        filter: outletId ? `outlet_id=eq.${outletId}` : undefined,
        queryKeys: [['outlet_topup_requests', outletId]],
      },
    ],
  })

  return {
    requests: data ?? [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refresh: refetch,
  }
}

export function useRequestBudgetTopup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { outletId: string; requestedAmount: number; periodCategory: 'weekday' | 'weekend' }) => 
      requestBudgetTopupAction(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outlet_topup_requests'] })
      queryClient.invalidateQueries({ queryKey: ['outlet_budget_status'] })
    }
  })
}

export function useApproveBudgetTopup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { requestId: string; action: 'approve_am' | 'approve_finance' | 'reject'; notes?: string }) => 
      approveBudgetTopupAction(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outlet_topup_requests'] })
      queryClient.invalidateQueries({ queryKey: ['outlet_budget_status'] })
      queryClient.invalidateQueries({ queryKey: ['all_outlets_budget_status'] })
    }
  })
}
