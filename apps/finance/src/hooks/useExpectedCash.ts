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

      // Create start and end of the selected date (in local time / browser time)
      const startOfDay = new Date(`${dateStr}T00:00:00.000Z`)
      const endOfDay = new Date(`${dateStr}T23:59:59.999Z`)

      // For more accurate timezone handling, if the dateStr is YYYY-MM-DD
      // we should construct the range using the local timezone offset if the business operates locally
      // But standard ISO string works if we assume the server stores TIMESTAMPTZ and we pass ISO strings
      const startIso = new Date(dateStr).toISOString()
      
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
