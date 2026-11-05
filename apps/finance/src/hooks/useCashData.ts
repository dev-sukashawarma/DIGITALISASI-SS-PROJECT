'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { CashLocation, CashBalance, CashTransaction, LocationWithBalance } from '@/lib/types'

/** Lokasi kas + saldo tergabung (dua query, di-merge di klien — sederhana & prediktif). */
export function useCashOverview(initialLocations?: CashLocation[], initialBalances?: CashBalance[]) {
  const supabase = useMemo(() => createClient(), [])

  const locationsQ = useQuery<CashLocation[]>({
    queryKey: ['cash_location'],
    initialData: initialLocations,
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
    initialData: initialBalances,
    queryFn: async () => {
      const { data, error } = await supabase.from('cash_balance').select('*')
      if (error) throw error
      return (data as CashBalance[]) ?? []
    },
  })

  const merged: LocationWithBalance[] = useMemo(() => {
    const fetched = (locationsQ.data ?? [])
    const balMap = new Map((balancesQ.data ?? []).map((b) => [b.cash_location_id, b.saldo]))
    return fetched.map((loc) => ({
      ...loc,
      saldo: balMap.get(loc.id) ?? (loc.opening_balance && loc.opening_balance > 0 ? loc.opening_balance : 0),
    }))
  }, [locationsQ.data, balancesQ.data])

  return {
    locations: merged,
    isLoading: locationsQ.isLoading || balancesQ.isLoading,
    error: (locationsQ.error || balancesQ.error) as Error | null,
  }
}

/** Riwayat transaksi kas terbaru (dengan label lokasi). */
export function useCashTransactions(limit = 50, initialData?: CashTransaction[]) {
  const supabase = useMemo(() => createClient(), [])
  return useQuery<CashTransaction[]>({
    queryKey: ['cash_transaction', limit],
    initialData,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_transaction')
        .select('*, cash_location:cash_location_id(label, kind), outlet:outlet_id(name)')
        .order('occurred_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      const txs = (data as unknown as CashTransaction[]) ?? []

      // Enrich petty_cash_topup transaksi yang belum memiliki info outlet
      const topupIds = txs
        .filter((t) => t.source_type === 'petty_cash_topup' && t.source_id && !t.outlet?.name)
        .map((t) => t.source_id as string)

      if (topupIds.length > 0) {
        // Chunk IDs to avoid 414 Request-URI Too Long in Supabase GET
        const chunkSize = 50
        const chunks: string[][] = []
        for (let i = 0; i < topupIds.length; i += chunkSize) {
          chunks.push(topupIds.slice(i, i + chunkSize))
        }

        const topupResults = await Promise.all(
          chunks.map((chunk) =>
            supabase
              .from('petty_cash_topups')
              .select('id, description, outlets(name)')
              .in('id', chunk)
          )
        )

        const topups = topupResults.flatMap((r) => r.data || [])

        if (topups && topups.length > 0) {
          const topupMap = new Map<string, any>(topups.map((tp: any) => [tp.id, tp]))
          return txs.map((t) => {
            if (t.source_type === 'petty_cash_topup' && t.source_id && topupMap.has(t.source_id)) {
              const tp = topupMap.get(t.source_id)
              return {
                ...t,
                outlet: tp?.outlets?.name ? { name: tp.outlets.name } : t.outlet,
                topup_description: tp?.description || null,
              }
            }
            return t
          })
        }
      }

      return txs
    },
  })
}
