'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

interface SuratJalan {
  id: string
  outlet_id: string
  status: string
  created_at: string
  outlets?: { name: string }
}

export function useTerimaList() {
  const { outletStaff } = useAuth()
  const [data, setData] = useState<SuratJalan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        const supabase = createClient()
        let query = supabase
          .from('surat_jalan')
          .select('id, outlet_id, status, created_at, outlets(name)')
          .in('status', ['dikirim', 'dikirim_lengkap', 'diterima_sebagian'])

        // Crew sees only SJ for their own outlet
        if (outletStaff?.outlet_id) {
          query = query.eq('outlet_id', outletStaff.outlet_id)
        }

        const { data, error: err } = await query
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
