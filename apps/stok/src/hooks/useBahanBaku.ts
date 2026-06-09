'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { BahanBaku } from '@/types/stok'

export function useBahanBaku() {
  const [data, setData] = useState<BahanBaku[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const supabase = createClient()
    supabase.from('bahan_baku').select('*').eq('is_active', true).order('nama')
      .then(({ data }) => { setData((data as BahanBaku[]) ?? []); setLoading(false) })
  }, [])
  return { bahanBaku: data, loading }
}
