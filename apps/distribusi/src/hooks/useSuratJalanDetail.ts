'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

interface Item {
  id: string
  bahan_baku_id: string
  qty_dikirim: number
  qty_terima?: number
  kondisi?: string
  catatan?: string | null
  bahan_baku?: { nama: string; satuan: string; kategori?: string }
}

interface SuratJalanDetail {
  id: string
  outlet_id: string
  status: string
  created_at: string
  outlets?: { name: string }
  surat_jalan_item: Item[]
  signatures?: any[]
  receipt_signatures?: any[]
  document_number?: string
  verification_code?: string
}

export function useSuratJalanDetail(id: string) {
  const [data, setData] = useState<SuratJalanDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return

    const fetchData = async () => {
      setLoading(true)
      setError(null)
      const supabase = createClient()

      try {
        const { data: sj, error: sjError } = await supabase
          .from('surat_jalan')
          .select('id, outlet_id, status, created_at, signatures, receipt_signatures, document_number, verification_code')
          .eq('id', id)
          .single()

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
        const bahanIds = (items || []).map((item: any) => item.bahan_baku_id)
        const { data: bahanList } = bahanIds.length > 0
          ? await supabase
              .from('bahan_baku')
              .select('id, nama, satuan, kategori')
              .in('id', bahanIds)
          : { data: [] }

        const bahanMap = new Map(
          (bahanList || []).map((b: any) => [b.id, b])
        )

        const itemsWithBahan = (items || []).map((item: any) => ({
          ...item,
          bahan_baku: bahanMap.get(item.bahan_baku_id) || null,
        }))

        setData({
          ...sj,
          outlets: outlet,
          surat_jalan_item: itemsWithBahan,
        } as SuratJalanDetail)
      } catch (err: any) {
        setError(err?.message || 'Terjadi kesalahan')
        setData(null)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [id])

  return { data, loading, error }
}
