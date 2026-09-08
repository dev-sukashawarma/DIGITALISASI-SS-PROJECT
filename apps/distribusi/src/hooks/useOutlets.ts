'use client'

import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@suka/auth'
import { cachedFetch } from '@/lib/refCache'
import { TEST_OUTLET_ID } from '@/lib/outletFilters'

interface Outlet {
  id: string
  name: string
  address?: string
}

async function fetchOutlets(): Promise<Outlet[]> {
  const supabase = createSupabaseBrowserClient()
  const { data, error } = await supabase
    .from('outlets')
    .select('id, name, address')
    .eq('is_active', true)
    // Outlet uji developer dikecualikan (lihat @/lib/outletFilters). Daftar ini
    // adalah pemilih tujuan surat jalan: mengirim barang ke outlet tes menulis
    // baris ledger sungguhan dan mengurangi stok Gudang Pusat.
    .neq('id', TEST_OUTLET_ID)
    .order('name')
  if (error) throw new Error(error.message)
  return data || []
}

export function useOutlets() {
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    // Reference data: di-cache per-tab supaya tidak refetch tiap mount.
    cachedFetch('outlets:active', fetchOutlets)
      .then((data) => {
        if (!active) return
        setOutlets(data)
      })
      .catch((err: any) => {
        if (!active) return
        setError(err?.message || 'Terjadi kesalahan')
        setOutlets([])
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return { outlets, loading, error }
}
