'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export interface PengirimanRow {
  id: string
  status: string
  created_at: string
  document_number?: string
  outlets?: { name: string }
  has_problem: boolean
}

export function usePengirimanList() {
  const [data, setData] = useState<PengirimanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        const supabase = createClient()
        // Lintas-outlet: tanpa filter outlet_id. Semua status.
        const { data, error: err } = await supabase
          .from('surat_jalan')
          .select('id, status, created_at, document_number, outlets(name), surat_jalan_item(qty_dikirim, qty_terima, kondisi)')
          .order('created_at', { ascending: false })

        if (err) { setError(err.message); setData([]); return }

        const rows: PengirimanRow[] = (data || []).map((sj: any) => {
          const items = sj.surat_jalan_item || []
          const has_problem = items.some(
            (it: any) => it.kondisi === 'rusak' || (it.qty_terima != null && it.qty_terima < it.qty_dikirim)
          )
          return {
            id: sj.id,
            status: sj.status,
            created_at: sj.created_at,
            document_number: sj.document_number,
            outlets: Array.isArray(sj.outlets) ? sj.outlets[0] : sj.outlets,
            has_problem,
          }
        })
        setData(rows)
      } catch (err: any) {
        setError(err?.message || 'Terjadi kesalahan')
        setData([])
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  return { data, loading, error }
}
