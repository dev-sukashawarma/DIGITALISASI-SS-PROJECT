'use client'

import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@suka/auth'
import { cachedFetch } from '@/lib/refCache'

interface BahanBaku {
  id: string
  nama: string
  satuan: string
  kategori?: string
}

async function fetchBahanBaku(): Promise<BahanBaku[]> {
  const supabase = createSupabaseBrowserClient()
  const { data, error } = await supabase
    .from('bahan_baku')
    .select('id, nama, satuan, kategori')
    .eq('is_active', true)
    .order('nama')
  if (error) throw new Error(error.message)
  return data || []
}

export function useBahanBaku() {
  const [bahanBaku, setBahanBaku] = useState<BahanBaku[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    // Reference data: di-cache per-tab supaya tidak refetch tiap mount.
    cachedFetch('bahan_baku:active', fetchBahanBaku)
      .then((data) => {
        if (!active) return
        setBahanBaku(data)
      })
      .catch((err: any) => {
        if (!active) return
        setError(err?.message || 'Terjadi kesalahan')
        setBahanBaku([])
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return { bahanBaku, loading, error }
}
