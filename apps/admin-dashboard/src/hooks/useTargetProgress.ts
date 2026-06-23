'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createSupabaseBrowserClient } from '@suka/auth'

export interface TargetProgressRow {
  outlet_id: string
  outlet_name: string
  target_amount: number
  omzet_today: number
}

/**
 * Progress target harian semua outlet (untuk dashboard owner).
 * Realtime: refetch (debounced) tiap ada perubahan tabel `orders`, jadi bar
 * progress ikut naik begitu kasir menyelesaikan transaksi.
 */
export function useTargetProgress() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])
  const [rows, setRows] = useState<TargetProgressRow[]>([])
  const [loading, setLoading] = useState(true)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchRows = async () => {
    const { data } = await supabase
      .from('daily_target_progress_spv')
      .select('*')
      .order('outlet_name')
    setRows(
      (data ?? []).map((r: any) => ({
        outlet_id: r.outlet_id,
        outlet_name: r.outlet_name,
        target_amount: Number(r.target_amount) || 0,
        omzet_today: Number(r.omzet_today) || 0,
      }))
    )
    setLoading(false)
  }

  useEffect(() => {
    const doFetch = async () => {
      await fetchRows()
    }

    doFetch()

    const scheduleRefetch = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(fetchRows, 1200)
    }

    const channel = supabase
      .channel('owner-target-progress')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_sales_targets' }, scheduleRefetch)
      .subscribe()

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      supabase.removeChannel(channel)
    }
  }, [supabase])

  return { rows, loading, refetch: fetchRows }
}
