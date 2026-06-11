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
    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        const supabase = createClient()
        const { data, error: err } = await supabase
          .from('bahan_baku')
          .select('id, nama, satuan, kategori')
          .eq('is_active', true)
          .order('nama')

        if (err) {
          setError(err.message)
          setBahanBaku([])
        } else {
          setBahanBaku(data || [])
        }
      } catch (err: any) {
        setError(err?.message || 'Terjadi kesalahan')
        setBahanBaku([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return { bahanBaku, loading, error }
}
