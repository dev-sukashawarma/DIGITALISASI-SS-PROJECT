'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { CashLocation, CashBalance, CashTransaction, LocationWithBalance } from '@/lib/types'

/** Lokasi kas + saldo tergabung (dua query, di-merge di klien — sederhana & prediktif). */
export function useCashOverview() {
  const supabase = useMemo(() => createClient(), [])

  const locationsQ = useQuery<CashLocation[]>({
    queryKey: ['cash_location'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_location')
        .select('*')
        .order('kind', { ascending: true })
        .order('label', { ascending: true })
      if (error) throw error
      return (data as CashLocation[]) ?? []
    },
  })

  const balancesQ = useQuery<CashBalance[]>({
    queryKey: ['cash_balance'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cash_balance').select('*')
      if (error) throw error
      return (data as CashBalance[]) ?? []
    },
  })

  const merged: LocationWithBalance[] = useMemo(() => {
    const balMap = new Map((balancesQ.data ?? []).map((b) => [b.cash_location_id, b.saldo]))
    return (locationsQ.data ?? []).map((loc) => ({
      ...loc,
      saldo: balMap.get(loc.id) ?? loc.opening_balance ?? 0,
    }))
  }, [locationsQ.data, balancesQ.data])

  return {
    locations: merged,
    isLoading: locationsQ.isLoading || balancesQ.isLoading,
    error: (locationsQ.error || balancesQ.error) as Error | null,
  }
}

/** Riwayat transaksi kas terbaru (dengan label lokasi). */
export function useCashTransactions(limit = 50) {
  const supabase = useMemo(() => createClient(), [])
  return useQuery<CashTransaction[]>({
    queryKey: ['cash_transaction', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_transaction')
        .select('*, cash_location:cash_location_id(label, kind)')
        .order('occurred_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data as unknown as CashTransaction[]) ?? []
    },
  })
}
