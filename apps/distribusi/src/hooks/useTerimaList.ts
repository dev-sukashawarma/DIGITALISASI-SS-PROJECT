'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

interface SuratJalan {
  id: string
  outlet_id: string
  status: string
  created_at: string
  outlets?: { name: string }
}

export function useTerimaList() {
  const [data, setData] = useState<SuratJalan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    const supabase = createClient()
    supabase
      .from('surat_jalan')
      .select('id, outlet_id, status, created_at, outlets(name)')
      .in('status', ['dikirim', 'diterima_sebagian'])
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message)
          setData([])
        } else {
          setData((data || []) as SuratJalan[])
        }
      })
      .catch(err => {
        setError(err.message)
        setData([])
      })
      .finally(() => setLoading(false))
  }, [])

  return { data, loading, error }
}
