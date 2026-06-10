'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

interface Outlet {
  id: string
  nama: string
  alamat?: string
}

export function useOutlets() {
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    const supabase = createClient()
    supabase
      .from('outlets')
      .select('id, nama, alamat')
      .eq('is_active', true)
      .order('nama')
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message)
          setOutlets([])
        } else {
          setOutlets(data || [])
        }
      })
      .catch(err => {
        setError(err.message)
        setOutlets([])
      })
      .finally(() => setLoading(false))
  }, [])

  return { outlets, loading, error }
}
