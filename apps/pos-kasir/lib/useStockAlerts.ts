'use client'

import { useQuery } from '@tanstack/react-query'
import { useSignalInvalidate } from '@suka/realtime'
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
}

async function fetchStockAlerts(outletId: string): Promise<StockAlertItem[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('monitoring_view_crew')
    .select('bahan_baku_id, item_name, satuan, kategori, current_qty, threshold, status')
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
 * ke outlet kasir sendiri. Sinyal `stok_berubah` dari database (channel privat
 * `stok:<outlet_id>`, migrasi 20300247000000) memicu refetch instan agar notif
 * tidak nunggu polling.
 *
 * Dulu pemicunya postgres_changes stok_balance: satu penjualan = ±18 baris, dan
 * server memeriksa RLS tiap baris untuk tiap pelanggan. Sinyal dikirim sekali per
 * outlet per transaksi. KasirNav dan StockMarquee memakai hook ini bersamaan;
 * channel bertopik sama itu dibagi oleh @suka/realtime.
 */
export function useStockAlerts(outletId: string | null) {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['stock-alerts', outletId],
    queryFn: () => fetchStockAlerts(outletId as string),
    enabled: !!outletId,
    refetchInterval: 30000,
    staleTime: 20000,
    retry: false,
  })

  useSignalInvalidate({
    topic: `stok:${outletId}`,
    event: 'stok_berubah',
    enabled: !!outletId,
    queryKeys: [['stock-alerts', outletId]],
  })

  const criticalItems = items.filter((i) => i.status === 'below')
  const warningItems = items.filter((i) => i.status === 'warning')

  return {
    items,
    criticalItems,
    warningItems,
    isLoading,
  }
}
