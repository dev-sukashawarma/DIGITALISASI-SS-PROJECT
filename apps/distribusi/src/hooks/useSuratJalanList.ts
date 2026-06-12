'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

interface SuratJalan {
  id: string
  outlet_id: string
  status: string
  created_at: string
  document_number?: string
  has_problem?: boolean
}

interface SuratJalanWithOutlet extends SuratJalan {
  outlet?: { name: string }
}

type DateFilter = 'all' | 'today' | '7days' | '30days' | 'belum_verif' | 'telah_verif'

export function useSuratJalanList(dateFilter: DateFilter = 'all') {
  const [data, setData] = useState<SuratJalanWithOutlet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)

      const supabase = createClient()
      let query = supabase
        .from('surat_jalan')
        .select('id, outlet_id, status, created_at, document_number, surat_jalan_item(qty_dikirim, qty_terima, kondisi)')
        .order('created_at', { ascending: false })

      // Apply date filters
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

      if (dateFilter === 'today') {
        query = query.gte('created_at', today)
      } else if (dateFilter === '7days') {
        query = query.gte('created_at', sevenDaysAgo)
      } else if (dateFilter === '30days') {
        query = query.gte('created_at', thirtyDaysAgo)
      } else if (dateFilter === 'belum_verif') {
        query = query.in('status', ['diterima_lengkap', 'diterima_sebagian'])
      } else if (dateFilter === 'telah_verif') {
        query = query.eq('status', 'selesai')
      }

      try {
        const { data: sjList, error: err } = await query

        if (err) {
          setError(err.message)
          setData([])
          return
        }

        // Batch fetch outlets
        const outletIds = (sjList || []).map((sj: any) => sj.outlet_id)
        const { data: outlets } = outletIds.length > 0
          ? await supabase
              .from('outlets')
              .select('id, name')
              .in('id', outletIds)
          : { data: [] }

        const outletMap = new Map(
          (outlets || []).map((o: any) => [o.id, o])
        )

        const result = (sjList || []).map((sj: any) => {
          const items = sj.surat_jalan_item || []
          const has_problem = items.some(
            (it: any) => it.kondisi === 'rusak' || (it.qty_terima != null && it.qty_terima < it.qty_dikirim)
          )
          return {
            ...sj,
            outlet: outletMap.get(sj.outlet_id),
            has_problem,
          }
        })

        setData(result as SuratJalanWithOutlet[])
      } catch (err: any) {
        setError(err?.message || 'Terjadi kesalahan')
        setData([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [dateFilter])

  const draftCount = data.filter((sj) => sj.status === 'draft').length
  const sentCount = data.filter((sj) => sj.status === 'dikirim').length
  const diterimaCount = data.filter((sj) => sj.status === 'diterima_lengkap' || sj.status === 'diterima_sebagian').length
  const selesaiCount = data.filter((sj) => sj.status === 'selesai').length

  return { data, loading, error, draftCount, sentCount, diterimaCount, selesaiCount }
}
