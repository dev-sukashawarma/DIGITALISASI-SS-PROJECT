'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

interface Item {
  id: string
  bahan_baku_id: string
  qty_dikirim: number
  qty_terima?: number
  kondisi?: string
  bahan_baku?: { nama: string; satuan: string }
}

interface SuratJalanDetail {
  id: string
  outlet_id: string
  status: string
  created_at: string
  outlets?: { name: string }
  surat_jalan_item: Item[]
}

export function useSuratJalanDetail(id: string) {
  const [data, setData] = useState<SuratJalanDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return

    setLoading(true)
    setError(null)

    const supabase = createClient()
    supabase
      .from('surat_jalan')
      .select('*')
      .eq('id', id)
      .single()
      .then(async ({ data: sj, error: sjError }) => {
        if (sjError) {
          setError(sjError.message)
          setData(null)
          setLoading(false)
          return
        }

        // Fetch outlet
        const { data: outlet } = await supabase
          .from('outlets')
          .select('*')
          .eq('id', sj.outlet_id)
          .single()

        // Fetch items
        const { data: items } = await supabase
          .from('surat_jalan_item')
          .select('*')
          .eq('surat_jalan_id', id)

        // Fetch bahan for each item
        const itemsWithBahan = await Promise.all(
          (items || []).map(async (item) => {
            const { data: bahan } = await supabase
              .from('bahan_baku')
              .select('nama, satuan')
              .eq('id', item.bahan_baku_id)
              .single()
            return { ...item, bahan_baku: bahan }
          })
        )

        setData({
          ...sj,
          outlets: outlet,
          surat_jalan_item: itemsWithBahan,
        } as SuratJalanDetail)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setData(null)
        setLoading(false)
      })
  }, [id])

  return { data, loading, error }
}
