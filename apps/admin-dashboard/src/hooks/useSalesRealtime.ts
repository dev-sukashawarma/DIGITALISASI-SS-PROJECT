'use client'
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { createThrottledRefresher } from '@/lib/realtimeThrottle'
import { REALTIME_REFRESH_MIN_GAP_MS } from '@/lib/ownerDashboardCache'

/**
 * Realtime invalidation untuk dashboard owner.
 *
 * Begitu kasir menyelesaikan transaksi (INSERT/UPDATE pada tabel `orders` —
 * termasuk baris hasil sync POS `sync-pos-sales`), seluruh query penjualan
 * (KPI, tren omzet, menu) langsung di-invalidate → React Query refetch →
 * angka di papan ikut naik "di detik itu juga" tanpa user menyentuh filter.
 *
 * Pola mengikuti useTargetProgress (yang sudah terbukti jalan): `orders`
 * sudah ada di publication `supabase_realtime`
 * (migration 20260623130000_orders_realtime_publication.sql).
 *
 * Dibatasi maks. sekali per 20 detik (event pertama tetap langsung) dan
 * ditunda saat tab tersembunyi. Debounce 800 ms lama menyala di hampir setiap
 * order di jam ramai, padahal `sales-hourly-raw` kini dipaginasi penuh
 * (±8 halaman untuk 30 hari).
 */
export function useSalesRealtime() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  useEffect(() => {
    const refresher = createThrottledRefresher(() => {
      queryClient.invalidateQueries({ queryKey: ['sales-hourly-raw'] })
      queryClient.invalidateQueries({ queryKey: ['menu-sales'] })
      queryClient.invalidateQueries({ queryKey: ['target_progress_global'] })
    }, REALTIME_REFRESH_MIN_GAP_MS)
    const invalidate = () => refresher.trigger()

    const channel = supabase
      .channel('owner-sales-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, invalidate)
      .subscribe()

    return () => {
      refresher.dispose()
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])
}
