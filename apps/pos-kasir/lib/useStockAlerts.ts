'use client'

import { useEffect, useId } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export type StockStatus = 'below' | 'warning' | 'ok'

export interface StockAlertItem {
  bahan_baku_id: string
  item_name: string
  satuan: string
  kategori: string
  current_qty: number
  threshold: number
  status: StockStatus
  projection_text: string | null
}

async function fetchStockAlerts(outletId: string): Promise<StockAlertItem[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('monitoring_view_crew')
    .select('bahan_baku_id, item_name, satuan, kategori, current_qty, threshold, status, projection_text')
    .eq('outlet_id', outletId)
    .in('status', ['below', 'warning'])
    .order('status')
    .order('item_name')

  if (error) throw error
  return data ?? []
}

/**
 * Stok menipis/kritis di outlet kasir, dari monitoring_view_crew (sama
 * threshold/status dengan papan monitoring apps/stok) — RLS membatasi hasil
 * ke outlet kasir sendiri. Realtime di stok_balance memicu refetch instan
 * agar notif tidak nunggu polling.
 */
export function useStockAlerts(outletId: string | null) {
  const queryClient = useQueryClient()
  const instanceId = useId()

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['stock-alerts', outletId],
    queryFn: () => fetchStockAlerts(outletId as string),
    enabled: !!outletId,
    refetchInterval: 30000,
    staleTime: 20000,
    retry: false,
  })

  useEffect(() => {
    if (!outletId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`stock_balance_${outletId}_${instanceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stok_balance', filter: `outlet_id=eq.${outletId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['stock-alerts', outletId] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [outletId, queryClient, instanceId])

  const criticalItems = items.filter((i) => i.status === 'below')
  const warningItems = items.filter((i) => i.status === 'warning')

  return {
    items,
    criticalItems,
    warningItems,
    isLoading,
  }
}
