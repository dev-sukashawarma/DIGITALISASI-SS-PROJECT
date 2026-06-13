'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@suka/auth'

export interface RiwayatRow {
  id: string
  outlet_id: string
  status: string
  created_at: string
  document_number?: string
  outlets?: { name: string }
  has_problem: boolean
}

export function useRiwayatList() {
  const { outletStaff } = useAuth()
  const [data, setData] = useState<RiwayatRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)

      // Guard: tanpa outlet_id, jangan kirim query tanpa filter (cegah bocor lintas-outlet)
      if (!outletStaff?.outlet_id) {
        setData([])
        setLoading(false)
        return
      }

      try {
        const supabase = createClient()
        const query = supabase
          .from('surat_jalan')
          .select('id, outlet_id, status, created_at, document_number, outlets(name), surat_jalan_item(qty_dikirim, qty_terima, kondisi)')
          .in('status', ['diterima_lengkap', 'diterima_sebagian', 'selesai'])
          .eq('outlet_id', outletStaff.outlet_id)

        const { data, error: err } = await query.order('created_at', { ascending: false })
        if (err) { setError(err.message); setData([]); return }

        const rows: RiwayatRow[] = (data || []).map((sj: any) => {
          const items = sj.surat_jalan_item || []
          const has_problem = items.some(
            (it: any) => it.kondisi === 'rusak' || (it.qty_terima != null && it.qty_terima < it.qty_dikirim)
          )
          return {
            id: sj.id,
            outlet_id: sj.outlet_id,
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
  }, [outletStaff?.outlet_id])

  return { data, loading, error }
}
