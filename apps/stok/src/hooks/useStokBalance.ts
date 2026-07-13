'use client'
import { useCallback, useEffect, useId, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { StokBalance } from '@/types/stok'

export function useStokBalance(outletId: string | undefined) {
  const [data, setData] = useState<StokBalance[]>([])
  const [loading, setLoading] = useState(true)
  const instanceId = useId()

  const fetchBalance = useCallback(async () => {
    if (!outletId) return
    const supabase = createClient()
    const { data } = await supabase.from('stok_balance').select('*').eq('outlet_id', outletId)
    setData((data as StokBalance[]) ?? [])
    setLoading(false)
  }, [outletId])

  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  useEffect(() => {
    if (!outletId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`stok_balance_${outletId}_${instanceId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'stok_balance',
        filter: `outlet_id=eq.${outletId}`,
      }, () => { fetchBalance() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [outletId, instanceId, fetchBalance])

  return { balances: data, loading, refresh: fetchBalance }
}
