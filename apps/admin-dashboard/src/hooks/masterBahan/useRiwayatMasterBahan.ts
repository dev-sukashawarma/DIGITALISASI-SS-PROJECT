'use client'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { BarisRiwayat } from '@/lib/masterBahan/riwayat'

export type FilterRiwayat = { bahanId: string | null; jenis: 'semua' | BarisRiwayat['jenis'] }

export function useRiwayatMasterBahan(filter: FilterRiwayat) {
  const supabase = useMemo(() => createClient(), [])
  const q = useQuery({
    queryKey: ['master_bahan', 'riwayat', filter.bahanId, filter.jenis],
    staleTime: 30_000,
    queryFn: async () => {
      let query = supabase.from('riwayat_master_bahan').select('*').order('changed_at', { ascending: false }).limit(200)
      if (filter.bahanId) query = query.eq('bahan_baku_id', filter.bahanId)
      if (filter.jenis !== 'semua') query = query.eq('jenis', filter.jenis)
      const { data, error } = await query
      if (error) throw error
      const rows = (data ?? []) as BarisRiwayat[]
      const ids = Array.from(new Set(rows.map((r) => r.changed_by).filter((x): x is string => !!x)))
      const namaPelaku = new Map<string, string>()
      if (ids.length > 0) {
        const staf = await supabase.from('outlet_staff').select('id, name').in('id', ids)
        // Nama pelaku hanya pelengkap: gagal baca (RLS) cukup tampil tanpa nama.
        for (const s of (staf.data ?? []) as { id: string; name: string | null }[]) {
          if (s.name) namaPelaku.set(s.id, s.name)
        }
      }
      return { rows, namaPelaku }
    },
  })
  return {
    rows: q.data?.rows ?? [],
    namaPelaku: q.data?.namaPelaku ?? new Map<string, string>(),
    loading: q.isLoading,
    error: q.error,
  }
}
