'use client'
import { useEffect, useMemo, useState } from 'react'
import { createSupabaseBrowserClient } from '@suka/auth'
import type { PeriodFilterValue } from '@/lib/types'

export interface SalesHourlyRow {
  sales_hour: number
  omzet: number
  jumlah_order_completed: number
}

export function useSalesHourly(filter: PeriodFilterValue) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])
  const [rows, setRows] = useState<SalesHourlyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true); setError(null)

    // Build query for orders
    // created_at is TIMESTAMPTZ, so we need to query based on Asia/Jakarta timezone equivalent bounds
    // The simplest way without worrying about precise TZ boundaries if we just want a rough 1-day is
    // to query created_at >= fromT00:00:00+07:00 and <= fromT23:59:59+07:00
    const startStr = `${filter.from}T00:00:00+07:00`
    const endStr = `${filter.to}T23:59:59+07:00`

    let q = supabase.from('orders')
      .select('outlet_id, sales_source, created_at, total_amount, status')
      .gte('created_at', startStr)
      .lte('created_at', endStr)

    if (filter.outletId !== 'all') q = q.eq('outlet_id', filter.outletId)
    
    // We don't have sales_source column directly on all queries if we don't handle it, wait we added it!
    // filter.source applies to sales_source
    if (filter.source !== 'all') q = q.eq('sales_source', filter.source)

    q.then(({ data, error }) => {
      if (!active) return
      if (error) {
        setError(error.message)
      } else {
        // Aggregate by hour (0-23) based on Asia/Jakarta
        const hourMap = new Map<number, SalesHourlyRow>()
        for (let i = 0; i < 24; i++) {
          hourMap.set(i, { sales_hour: i, omzet: 0, jumlah_order_completed: 0 })
        }

        if (data) {
          for (const order of data) {
            if (order.status !== 'completed') continue
            
            // Get hour in Asia/Jakarta
            const dateObj = new Date(order.created_at)
            // A simple way to get the hour in local time if we assume the user is also in +07:00
            // Or explicitly:
            const jktStr = dateObj.toLocaleString('en-US', { timeZone: 'Asia/Jakarta', hour12: false, hour: 'numeric' })
            const hour = parseInt(jktStr, 10) % 24

            const existing = hourMap.get(hour)!
            existing.omzet += Number(order.total_amount)
            existing.jumlah_order_completed += 1
          }
        }
        
        setRows(Array.from(hourMap.values()).sort((a, b) => a.sales_hour - b.sales_hour))
      }
      setLoading(false)
    })

    return () => { active = false }
  }, [supabase, filter.from, filter.to, filter.outletId, filter.source])

  return { rows, loading, error }
}
