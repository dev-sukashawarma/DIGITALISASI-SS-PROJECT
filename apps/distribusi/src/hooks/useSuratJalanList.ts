'use client'

import { useQuery } from '@tanstack/react-query'
import { createSupabaseBrowserClient, useAuth } from '@suka/auth'

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

async function fetchSuratJalan(dateFilter: DateFilter, outletStaff: any): Promise<SuratJalanWithOutlet[]> {
  const supabase = createSupabaseBrowserClient()
  let query = supabase
    .from('surat_jalan')
    .select('id, outlet_id, status, created_at, document_number, outlets(name), surat_jalan_item(qty_dikirim, qty_terima, kondisi)')
    .order('created_at', { ascending: false })

  const isGlobalPusat = ['kitchen', 'admin', 'admin_hr', 'spv', 'regional_manager', 'owner'].includes(outletStaff?.role || '')

  if (!isGlobalPusat && outletStaff) {
    if (outletStaff.role === 'leader') {
      const { data: soData } = await supabase
        .from('staff_outlets')
        .select('outlet_id')
        .eq('staff_id', outletStaff.id)

      const ids = new Set<string>()
      if (outletStaff.outlet_id) ids.add(outletStaff.outlet_id)
      if (soData) {
        soData.forEach((row: any) => {
          if (row.outlet_id) ids.add(row.outlet_id)
        })
      }
      const accessibleIds = Array.from(ids)
      if (accessibleIds.length > 0) {
        query = query.in('outlet_id', accessibleIds)
      } else {
        return []
      }
    } else if (outletStaff.outlet_id) {
      query = query.eq('outlet_id', outletStaff.outlet_id)
    } else {
      return []
    }
  }

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  if (dateFilter === 'today') query = query.gte('created_at', today)
  else if (dateFilter === '7days') query = query.gte('created_at', sevenDaysAgo)
  else if (dateFilter === '30days') query = query.gte('created_at', thirtyDaysAgo)
  else if (dateFilter === 'belum_verif') query = query.in('status', ['diterima_lengkap', 'diterima_sebagian'])
  else if (dateFilter === 'telah_verif') query = query.eq('status', 'selesai')

  const { data: sjList, error } = await query
  if (error) throw error

  return (sjList || []).map((sj: any) => {
    const items = sj.surat_jalan_item || []
    const has_problem = items.some(
      (it: any) => it.kondisi === 'rusak' || (it.qty_terima != null && it.qty_terima < it.qty_dikirim)
    )
    const outlet = Array.isArray(sj.outlets) ? sj.outlets[0] : sj.outlets
    return { ...sj, outlet, has_problem }
  }) as SuratJalanWithOutlet[]
}

export function useSuratJalanList(dateFilter: DateFilter = 'all') {
  const { outletStaff } = useAuth()

  const { data = [], isLoading: loading, error } = useQuery({
    queryKey: ['surat_jalan', dateFilter, outletStaff?.id, outletStaff?.role, outletStaff?.outlet_id],
    queryFn: () => fetchSuratJalan(dateFilter, outletStaff),
    enabled: !!outletStaff,
  })

  const draftCount = data.filter((sj: SuratJalanWithOutlet) => sj.status === 'draft').length
  const sentCount = data.filter((sj: SuratJalanWithOutlet) => sj.status === 'dikirim').length
  const diterimaCount = data.filter((sj: SuratJalanWithOutlet) => sj.status === 'diterima_lengkap' || sj.status === 'diterima_sebagian').length
  const selesaiCount = data.filter((sj: SuratJalanWithOutlet) => sj.status === 'selesai').length

  return { data, loading, error: error ? (error as Error).message : null, draftCount, sentCount, diterimaCount, selesaiCount }
}
