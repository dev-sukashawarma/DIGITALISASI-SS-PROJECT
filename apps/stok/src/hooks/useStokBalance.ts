'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { StokBalance } from '@/types/stok'

const REFRESH_MS = 30_000

export function useStokBalance(outletId: string | undefined) {
  const [data, setData] = useState<StokBalance[]>([])
  const [loading, setLoading] = useState(true)

  const fetchBalance = useCallback(async () => {
    if (!outletId) return
    const supabase = createClient()
    const { data } = await supabase.from('stok_balance').select('*').eq('outlet_id', outletId)
    setData((data as StokBalance[]) ?? [])
    setLoading(false)
  }, [outletId])

  useEffect(() => {
    fetchBalance()
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    const id = setInterval(() => { if (navigator.onLine) fetchBalance() }, REFRESH_MS)
    return () => clearInterval(id)
  }, [fetchBalance])

  return { balances: data, loading, refresh: fetchBalance }
}
