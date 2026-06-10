'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { BahanBaku } from '@/types/stok'

export function useBahanBaku() {
  const [data, setData] = useState<BahanBaku[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const supabase = createClient()
    supabase.from('bahan_baku').select('*').eq('is_active', true).order('nama')
      .then(({ data, error: err }) => {
        if (err) throw err
        setData((data as BahanBaku[]) ?? [])
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])
  return { bahanBaku: data, loading, error }
}
