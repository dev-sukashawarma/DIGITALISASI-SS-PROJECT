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
    const load = async () => {
      try {
        const { data, error: err } = await supabase.from('bahan_baku').select('*').eq('is_active', true).order('nama')
        if (err) throw err
        setData((data as BahanBaku[]) ?? [])
      } catch (err: any) {
        setError(err.message || err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])
  return { bahanBaku: data, loading, error }
}
