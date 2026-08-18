'use client'
import { useId } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRealtimeInvalidate } from '@suka/realtime'
import { getOutletBudgetStatus, listOutletBudgets, setOutletBudgetConfig } from '@/app/actions/budget'
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

export function useOutletBudgetAdmin() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['outlet_budget_admin_list'],
    queryFn: () => listOutletBudgets(),
    staleTime: 15000,
    gcTime: 60000,
  })

  const save = async (outletId: string, nominal: number, periodType: PeriodType) => {
    await setOutletBudgetConfig(outletId, nominal, periodType)
    await refetch()
  }

  return {
    budgets: data ?? [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refresh: refetch,
    save,
  }
}
