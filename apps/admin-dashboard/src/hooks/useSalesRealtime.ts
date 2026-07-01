'use client'
import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'

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
 * Debounce 800ms: satu order = beberapa event (INSERT order + UPDATE status);
 * cukup refetch sekali agar tidak membanjiri jaringan.
 */
export function useSalesRealtime() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const invalidate = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['sales-summary'] })
        queryClient.invalidateQueries({ queryKey: ['sales-hourly'] })
        queryClient.invalidateQueries({ queryKey: ['menu-sales'] })
      }, 800)
    }

    const channel = supabase
      .channel('owner-sales-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, invalidate)
      .subscribe()

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])
}
