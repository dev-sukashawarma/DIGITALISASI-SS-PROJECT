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

        // Batch fetch all bahan_baku for these items
        const bahanIds = (items || []).map((item) => item.bahan_baku_id)
        const { data: bahanList } = bahanIds.length > 0
          ? await supabase
              .from('bahan_baku')
              .select('id, nama, satuan')
              .in('id', bahanIds)
          : { data: [] }

        const bahanMap = new Map(
          (bahanList || []).map((b) => [b.id, b])
        )

        const itemsWithBahan = (items || []).map((item) => ({
          ...item,
          bahan_baku: bahanMap.get(item.bahan_baku_id) || null,
        }))

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
