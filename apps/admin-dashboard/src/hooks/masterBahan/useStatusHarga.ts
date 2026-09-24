'use client'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'

export type StatusHarga = {
  bahan_baku_id: string
  nama: string
  harga_master: number | null
  harga_master_updated_at: string | null
  status: 'terkonfirmasi' | 'belum_dikonfirmasi'
  vendor_terbaru_id: string | null
  harga_vendor_per_besar: number | null
  asal_catatan: string | null
  asal_waktu: string | null
}

type BarisStatus = Omit<StatusHarga, 'asal_catatan' | 'asal_waktu'>
type BarisAsal = { bahan_baku_id: string; catatan: string | null; changed_at: string }

/** View bahan_baku_status_harga (Tahap 1) + asal harga terbaru (bahan_baku_harga_asal). */
export function useStatusHarga() {
  const supabase = useMemo(() => createClient(), [])
  return useQuery<StatusHarga[]>({
    queryKey: ['master_bahan', 'status_harga'],
    staleTime: 60_000,
    queryFn: async () => {
      const [s, a] = await Promise.all([
        supabase.from('bahan_baku_status_harga').select('*').order('nama'),
        supabase.from('bahan_baku_harga_asal').select('bahan_baku_id, catatan, changed_at'),
      ])
      if (s.error) throw s.error
      if (a.error) throw a.error
      const asal = new Map(((a.data ?? []) as BarisAsal[]).map((x) => [x.bahan_baku_id, x]))
      return ((s.data ?? []) as BarisStatus[]).map((r) => ({
        ...r,
        harga_master: r.harga_master === null ? null : Number(r.harga_master),
        harga_vendor_per_besar: r.harga_vendor_per_besar === null ? null : Number(r.harga_vendor_per_besar),
        asal_catatan: asal.get(r.bahan_baku_id)?.catatan ?? null,
        asal_waktu: asal.get(r.bahan_baku_id)?.changed_at ?? null,
      }))
    },
  })
}
