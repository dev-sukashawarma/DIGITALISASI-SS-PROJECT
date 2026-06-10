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

export function useSuratJalanList() {
  const [data, setData] = useState<SuratJalanWithOutlet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    const supabase = createClient()
    supabase
      .from('surat_jalan')
      .select('id, outlet_id, status, created_at, outlets(name)')
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message)
          setData([])
        } else {
          setData((data || []) as SuratJalanWithOutlet[])
        }
      })
      .catch(err => {
        setError(err.message)
        setData([])
      })
      .finally(() => setLoading(false))
  }, [])

  const draftCount = data.filter((sj) => sj.status === 'draft').length
  const sentCount = data.filter((sj) => sj.status === 'dikirim').length

  return { data, loading, error, draftCount, sentCount }
}
