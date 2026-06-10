'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export interface BahanBaku {
  id: string
  nama: string
  satuan?: string
}

export function useBahanBaku() {
  const [bahanBaku, setBahanBaku] = useState<BahanBaku[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('bahan_baku')
      .select('id, nama, satuan')
      .order('nama', { ascending: true })
      .then(({ data, error }) => {
        if (error) throw error
        setBahanBaku((data as BahanBaku[]) ?? [])
      })
      .catch(err => {
        console.error('Error fetching bahan_baku:', err)
        setBahanBaku([])
      })
      .finally(() => setLoading(false))
  }, [])

  return { bahanBaku, loading }
}
