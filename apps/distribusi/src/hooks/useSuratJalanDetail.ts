'use client'

import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@suka/auth'

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
      const supabase = createSupabaseBrowserClient()

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

        // Fetch items with embedded relation
        const { data: items, error: itemsError } = await supabase
          .from('surat_jalan_item')
          .select('*, bahan_baku(id, nama, satuan, kategori)')
          .eq('surat_jalan_id', id)

        if (itemsError) {
          setError(itemsError.message)
          setData(null)
          setLoading(false)
          return
        }

        setData({
          ...sj,
          outlets: outlet,
          surat_jalan_item: items || [],
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
