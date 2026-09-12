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
  foto_path?: string | null
  vendor_id?: string | null
  vendor?: { id: string; nama: string } | null
  bahan_baku?: {
    id?: string
    nama: string
    satuan: string
    kategori?: string
    satuan_distribusi?: string
    satuan_tengah?: string
    satuan_kecil?: string
    faktor_tengah?: number
    faktor_tampilan?: number
  }
}

interface SuratJalanDetail {
  id: string
  outlet_id: string
  status: string
  created_at: string
  notes?: string | null
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

  const fetchData = async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    const supabase = createSupabaseBrowserClient()

    try {
      // Satu query embedded: header + outlet + item (+ bahan_baku & vendor) sekaligus
      const { data: sj, error: sjError } = await supabase
        .from('surat_jalan')
        .select(
          'id, outlet_id, status, created_at, notes, signatures, receipt_signatures, document_number, verification_code, outlets(name), surat_jalan_item(*, vendor:supplier!surat_jalan_item_vendor_id_fkey(id, nama), bahan_baku(id, nama, satuan, kategori, satuan_distribusi, satuan_tengah, satuan_kecil, faktor_tengah, faktor_tampilan))'
        )
        .eq('id', id)
        .single()

      if (sjError) {
        setError(sjError.message)
        setData(null)
        setLoading(false)
        return
      }

      setData({
        ...sj,
        outlets: Array.isArray((sj as any).outlets) ? (sj as any).outlets[0] : (sj as any).outlets,
        surat_jalan_item: (sj as any).surat_jalan_item || [],
      } as SuratJalanDetail)
    } catch (err: any) {
      setError(err?.message || 'Terjadi kesalahan')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [id])

  return { data, loading, error, refetch: fetchData }
}
