'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

interface SuratJalan {
  id: string
  outlet_id: string
  status: string
  created_at: string
}

interface SuratJalanWithOutlet extends SuratJalan {
  outlet?: { name: string }
}

type DateFilter = 'all' | 'today' | '7days' | '30days'

export function useSuratJalanList(dateFilter: DateFilter = 'all') {
  const [data, setData] = useState<SuratJalanWithOutlet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    const supabase = createClient()
    let query = supabase
      .from('surat_jalan')
      .select('id, outlet_id, status, created_at')
      .order('created_at', { ascending: false })

    // Apply date filters
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

    if (dateFilter === 'today') {
      query = query.gte('created_at', today)
    } else if (dateFilter === '7days') {
      query = query.gte('created_at', sevenDaysAgo)
    } else if (dateFilter === '30days') {
      query = query.gte('created_at', thirtyDaysAgo)
    }

    query.then(async ({ data: sjList, error: err }) => {
        if (err) {
          setError(err.message)
          setData([])
          setLoading(false)
          return
        }

        // Batch fetch outlets
        const outletIds = (sjList || []).map((sj) => sj.outlet_id)
        const { data: outlets } = outletIds.length > 0
          ? await supabase
              .from('outlets')
              .select('id, name')
              .in('id', outletIds)
          : { data: [] }

        const outletMap = new Map(
          (outlets || []).map((o) => [o.id, o])
        )

        const result = (sjList || []).map((sj) => ({
          ...sj,
          outlet: outletMap.get(sj.outlet_id),
        }))

        setData(result as SuratJalanWithOutlet[])
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setData([])
        setLoading(false)
      })
  }, [dateFilter])

  const draftCount = data.filter((sj) => sj.status === 'draft').length
  const sentCount = data.filter((sj) => sj.status === 'dikirim').length

  return { data, loading, error, draftCount, sentCount }
}
