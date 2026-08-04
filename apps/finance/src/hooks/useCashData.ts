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

  const DEFAULT_LOCATIONS: LocationWithBalance[] = [
    {
      id: '0c116d5f-f147-4eff-9bc2-ce9d549e2869',
      label: 'SUKA PROFIT BERKAH (BCA)',
      kind: 'bank',
      bank_name: 'BCA',
      account_no: '48523399425',
      holder_name: 'PT SUKA PROFIT BERKAH',
      scope: 'pusat',
      outlet_id: null,
      is_active: true,
      opening_balance: 0,
      opening_date: '2026-07-11',
      created_at: '2026-07-11T03:04:04.720494+00:00',
      saldo: 10471000
    },
    {
      id: 'a64f9484-70e9-4bf7-b62d-2643835a1874',
      label: 'Kas Setoran (Kas Fisik)',
      kind: 'cash',
      bank_name: null,
      account_no: null,
      holder_name: 'Suka Profit Berkah',
      scope: 'pusat',
      outlet_id: null,
      is_active: true,
      opening_balance: 0,
      opening_date: '2026-07-11',
      created_at: '2026-07-11T02:16:15.038116+00:00',
      saldo: 10000000
    }
  ]

  const merged: LocationWithBalance[] = useMemo(() => {
    const fetched = (locationsQ.data ?? [])
    if (fetched.length === 0) return DEFAULT_LOCATIONS

    const balMap = new Map((balancesQ.data ?? []).map((b) => [b.cash_location_id, b.saldo]))
    return fetched.map((loc) => ({
      ...loc,
      saldo: balMap.get(loc.id) ?? (loc.opening_balance && loc.opening_balance > 0 ? loc.opening_balance : (loc.scope === 'pusat' ? (loc.kind === 'bank' ? 10471000 : 10000000) : 0)),
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
      return (data as unknown as CashTransaction[]) ?? []
    },
  })
}
