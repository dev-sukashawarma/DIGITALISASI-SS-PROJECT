'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

interface BahanBaku {
  id: string
  nama: string
  satuan: string
  kategori?: string
}

export function useBahanBaku() {
  const [bahanBaku, setBahanBaku] = useState<BahanBaku[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    const supabase = createClient()
    supabase
      .from('bahan_baku')
      .select('id, nama, satuan, kategori')
      .eq('is_active', true)
      .order('nama')
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message)
          setBahanBaku([])
        } else {
          setBahanBaku(data || [])
        }
      })
      .catch(err => {
        setError(err.message)
        setBahanBaku([])
      })
      .finally(() => setLoading(false))
  }, [])

  return { bahanBaku, loading, error }
}
