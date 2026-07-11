'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'

export function useExpectedCash(outletId: string | null, dateStr: string) {
  const supabase = useMemo(() => createClient(), [])

  return useQuery({
    queryKey: ['expected_cash', outletId, dateStr],
    queryFn: async () => {
      if (!outletId) return 0

      // Let's use simple string manipulation for date prefix if the timezone is tricky,
      // but the safest for TIMESTAMPTZ is to send local range bounds as ISO.
      const start = new Date(dateStr)
      start.setHours(0, 0, 0, 0)
      const end = new Date(dateStr)
      end.setHours(23, 59, 59, 999)

      const { data, error } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('outlet_id', outletId)
        .eq('payment_method', 'cash')
        .in('status', ['completed', 'ready'])
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())

      if (error) throw error

      const total = data.reduce((acc, row) => acc + Number(row.total_amount || 0), 0)
      return total
    },
    enabled: !!outletId && !!dateStr,
  })
}
