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
  surat_jalan_item?: any[]
}

interface SuratJalanWithOutlet extends SuratJalan {
  outlet?: { name: string }
}

export type DateFilter = 'all' | 'today' | '7days' | '30days' | 'belum_verif' | 'telah_verif' | 'custom'

export interface CustomDateRange {
  startDate?: string
  endDate?: string
}

async function fetchSuratJalan(
  dateFilter: DateFilter,
  outletStaff: any,
  customRange?: CustomDateRange
): Promise<SuratJalanWithOutlet[]> {
  const supabase = createSupabaseBrowserClient()

  // Filter disimpan sebagai data lalu diterapkan ke builder BARU tiap halaman
  // (builder Supabase dieksekusi ulang tiap .then — tidak boleh dipakai ulang).
  let outletEq: string | null = null
  let outletIn: string[] | null = null

  const isGlobalPusat = ['kitchen', 'admin', 'admin_hr', 'spv', 'regional_manager', 'owner', 'developer'].includes(outletStaff?.role || '')

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
        outletIn = accessibleIds
      } else {
        return []
      }
    } else if (outletStaff.outlet_id) {
      outletEq = outletStaff.outlet_id
    } else {
      return []
    }
  }

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const buildPage = (fromRow: number, toRow: number) => {
    let query = supabase
      .from('surat_jalan')
      .select('id, outlet_id, status, created_at, document_number, outlets(name), surat_jalan_item(qty_dikirim, qty_terima, kondisi)')

    if (outletEq) query = query.eq('outlet_id', outletEq)
    else if (outletIn) query = query.in('outlet_id', outletIn)

    if (dateFilter === 'today') query = query.gte('created_at', today)
    else if (dateFilter === '7days') query = query.gte('created_at', sevenDaysAgo)
    else if (dateFilter === '30days') query = query.gte('created_at', thirtyDaysAgo)
    else if (dateFilter === 'belum_verif') query = query.in('status', ['diterima_lengkap', 'diterima_sebagian'])
    else if (dateFilter === 'telah_verif') query = query.eq('status', 'selesai')
    else if (dateFilter === 'custom') {
      if (customRange?.startDate) {
        query = query.gte('created_at', `${customRange.startDate}T00:00:00+07:00`)
      }
      if (customRange?.endDate) {
        query = query.lte('created_at', `${customRange.endDate}T23:59:59.999+07:00`)
      }
    }

    // Urutan tampilan tetap created_at terbaru dulu; id sebagai tiebreak unik
    // supaya batas halaman deterministik.
    return query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(fromRow, toRow)
  }

  // Filter "Semua"/"Selesai" dulu satu request → terpotong diam-diam di 1.000
  // SJ (max-rows PostgREST), riwayat lama hilang dari daftar & hitungan.
  // Sekarang ditarik habis per 1.000 baris.
  const PAGE_SIZE = 1000
  let sjList: any[] = []
  let fromRow = 0
  while (true) {
    const { data: pageRows, error } = await buildPage(fromRow, fromRow + PAGE_SIZE - 1)
    if (error) throw error
    const rows = pageRows ?? []
    sjList = sjList.concat(rows)
    if (rows.length < PAGE_SIZE) break
    fromRow += PAGE_SIZE
  }

  return sjList.map((sj: any) => {
    const items = sj.surat_jalan_item || []
    const has_problem = items.some(
      (it: any) => it.kondisi === 'rusak' || (it.qty_terima != null && it.qty_terima < it.qty_dikirim)
    )
    const outlet = Array.isArray(sj.outlets) ? sj.outlets[0] : sj.outlets
    return { ...sj, outlet, has_problem }
  }) as SuratJalanWithOutlet[]
}

export function useSuratJalanList(dateFilter: DateFilter = 'all', customRange?: CustomDateRange) {
  const { outletStaff } = useAuth()

  const { data = [], isLoading: loading, error } = useQuery({
    queryKey: [
      'surat_jalan',
      dateFilter,
      customRange?.startDate,
      customRange?.endDate,
      outletStaff?.id,
      outletStaff?.role,
      outletStaff?.outlet_id,
    ],
    queryFn: () => fetchSuratJalan(dateFilter, outletStaff, customRange),
    enabled: !!outletStaff,
  })

  const draftCount = data.filter((sj: SuratJalanWithOutlet) => sj.status === 'draft').length
  const sentCount = data.filter((sj: SuratJalanWithOutlet) => sj.status === 'dikirim').length
  const diterimaCount = data.filter((sj: SuratJalanWithOutlet) => sj.status === 'diterima_lengkap' || sj.status === 'diterima_sebagian').length
  const selesaiCount = data.filter((sj: SuratJalanWithOutlet) => sj.status === 'selesai').length

  return { data, loading, error: error ? (error as Error).message : null, draftCount, sentCount, diterimaCount, selesaiCount }
}
