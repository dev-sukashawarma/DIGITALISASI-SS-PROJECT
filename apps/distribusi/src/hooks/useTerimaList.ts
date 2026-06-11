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
    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        const supabase = createClient()
        const { data, error: err } = await supabase
          .from('surat_jalan')
          .select('id, outlet_id, status, created_at, outlets(name)')
          .in('status', ['dikirim', 'diterima_sebagian'])
          .order('created_at', { ascending: false })

        if (err) {
          setError(err.message)
          setData([])
        } else {
          const formatted = (data || []).map((sj: any) => ({
            ...sj,
            outlets: Array.isArray(sj.outlets) ? sj.outlets[0] : sj.outlets
          }))
          setData(formatted as SuratJalan[])
        }
      } catch (err: any) {
        setError(err?.message || 'Terjadi kesalahan')
        setData([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return { data, loading, error }
}
