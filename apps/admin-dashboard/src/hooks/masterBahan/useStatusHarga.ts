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
  /** Nama pelaku (outlet_staff.name) dari perubahan harga master terakhir, atau null bila
   *  sistem (changed_by NULL) ATAU nama gagal dibaca — pelengkap, bukan wajib. */
  asal_oleh: string | null
}

type BarisStatus = Omit<StatusHarga, 'asal_catatan' | 'asal_waktu' | 'asal_oleh'>
type BarisAsal = { bahan_baku_id: string; catatan: string | null; changed_at: string; changed_by: string | null }

/** View bahan_baku_status_harga (Tahap 1) + asal harga terbaru (bahan_baku_harga_asal). */
export function useStatusHarga() {
  const supabase = useMemo(() => createClient(), [])
  return useQuery<StatusHarga[]>({
    queryKey: ['master_bahan', 'status_harga'],
    staleTime: 60_000,
    queryFn: async () => {
      const [s, a] = await Promise.all([
        supabase.from('bahan_baku_status_harga').select('*').order('nama'),
        supabase.from('bahan_baku_harga_asal').select('bahan_baku_id, catatan, changed_at, changed_by'),
      ])
      if (s.error) throw s.error
      if (a.error) throw a.error
      const asal = new Map(((a.data ?? []) as BarisAsal[]).map((x) => [x.bahan_baku_id, x]))

      // Nama pelaku hanya pelengkap: gagal baca (mis. RLS) cukup tampil "oleh sistem".
      const idPelaku = Array.from(new Set(Array.from(asal.values()).map((x) => x.changed_by).filter((x): x is string => !!x)))
      const namaPelaku = new Map<string, string>()
      if (idPelaku.length > 0) {
        const staf = await supabase.from('outlet_staff').select('id, name').in('id', idPelaku)
        for (const p of (staf.data ?? []) as { id: string; name: string | null }[]) {
          if (p.name) namaPelaku.set(p.id, p.name)
        }
      }

      return ((s.data ?? []) as BarisStatus[]).map((r) => {
        const changedBy = asal.get(r.bahan_baku_id)?.changed_by ?? null
        return {
          ...r,
          harga_master: r.harga_master === null ? null : Number(r.harga_master),
          harga_vendor_per_besar: r.harga_vendor_per_besar === null ? null : Number(r.harga_vendor_per_besar),
          asal_catatan: asal.get(r.bahan_baku_id)?.catatan ?? null,
          asal_waktu: asal.get(r.bahan_baku_id)?.changed_at ?? null,
          asal_oleh: changedBy ? namaPelaku.get(changedBy) ?? null : null,
        }
      })
    },
  })
}
