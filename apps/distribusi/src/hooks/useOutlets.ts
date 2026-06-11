'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

interface Outlet {
  id: string
  name: string
  address?: string
}

export function useOutlets() {
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        const supabase = createClient()
        const { data, error: err } = await supabase
          .from('outlets')
          .select('id, name, address')
          .eq('is_active', true)
          .order('name')

        if (err) {
          setError(err.message)
          setOutlets([])
        } else {
          setOutlets(data || [])
        }
      } catch (err: any) {
        setError(err?.message || 'Terjadi kesalahan')
        setOutlets([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return { outlets, loading, error }
}
