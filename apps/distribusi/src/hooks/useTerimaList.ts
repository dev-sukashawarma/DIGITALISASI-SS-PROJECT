'use client'

import { useQuery } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@suka/auth'
import { useAuth } from '@suka/auth'

interface SuratJalan {
  id: string
  outlet_id: string
  status: string
  created_at: string
  document_number?: string
  outlets?: { name: string }
}

async function fetchTerima(outletId: string | null | undefined): Promise<SuratJalan[]> {
  const supabase = createSupabaseBrowserClient()
  let query = supabase
    .from('surat_jalan')
    .select('id, outlet_id, status, created_at, document_number, outlets(name)')
    .in('status', ['dikirim', 'dikirim_lengkap', 'diterima_sebagian'])

  if (outletId) query = query.eq('outlet_id', outletId)

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error

  return (data || []).map((sj: any) => ({
    ...sj,
    outlets: Array.isArray(sj.outlets) ? sj.outlets[0] : sj.outlets,
  })) as SuratJalan[]
}

export function useTerimaList() {
  const { outletStaff } = useAuth()
  const outletId = outletStaff?.outlet_id
  const { data = [], isLoading: loading, error } = useQuery({
    queryKey: ['surat_jalan_terima', outletId ?? 'all'],
    queryFn: () => fetchTerima(outletId),
  })

  return { data, loading, error: error ? (error as Error).message : null }
}
