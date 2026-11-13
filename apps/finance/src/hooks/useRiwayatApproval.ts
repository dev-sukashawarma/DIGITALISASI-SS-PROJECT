'use client'

import { useMemo } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { JenisRiwayat, KeputusanRiwayat, RiwayatApproval } from '@/lib/approval/riwayat'

export const RIWAYAT_PER_HALAMAN = 50

/**
 * Riwayat keputusan Hub Approval, berhalaman (di bawah cap 1.000 baris).
 * Yang berjam dulu (terbaru di atas); keputusan lama tanpa jam di akhir.
 */
export function useRiwayatApproval(
  enabled: boolean,
  jenis: JenisRiwayat | null,
  keputusan: KeputusanRiwayat | null,
  halaman: number,
) {
  const supabase = useMemo(() => createClient(), [])
  return useQuery<{ baris: RiwayatApproval[]; total: number }>({
    queryKey: ['approval_log', 'daftar', jenis, keputusan, halaman],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const dari = halaman * RIWAYAT_PER_HALAMAN
      let q = supabase
        .from('approval_log')
        .select(
          'id, jenis, keputusan, sumber_id, judul, keterangan, nominal, alasan, waktu, waktu_urut, dari_data_lama, pelaku_nama',
          { count: 'exact' },
        )
        .order('waktu', { ascending: false, nullsFirst: false })
        .order('waktu_urut', { ascending: false })
        .order('id', { ascending: false })
        .range(dari, dari + RIWAYAT_PER_HALAMAN - 1)
      if (jenis) q = q.eq('jenis', jenis)
      if (keputusan) q = q.eq('keputusan', keputusan)
      const { data, error, count } = await q
      if (error) throw error
      // Nama pelaku disimpan di riwayat; join ke outlet_staff tertahan RLS.
      const baris = ((data ?? []) as any[]).map((r) => ({
        ...r,
        nominal: r.nominal == null ? null : Number(r.nominal),
      })) as RiwayatApproval[]
      return { baris, total: count ?? baris.length }
    },
  })
}

/** Jumlah keputusan per jenis keputusan untuk ringkasan (ikut saringan jenis). */
export function useRingkasanRiwayat(enabled: boolean, jenis: JenisRiwayat | null) {
  const supabase = useMemo(() => createClient(), [])
  return useQuery<Record<KeputusanRiwayat, number>>({
    queryKey: ['approval_log', 'ringkasan', jenis],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const hitung = async (k: KeputusanRiwayat) => {
        let q = supabase.from('approval_log').select('id', { count: 'exact', head: true }).eq('keputusan', k)
        if (jenis) q = q.eq('jenis', jenis)
        const { count, error } = await q
        if (error) throw error
        return count ?? 0
      }
      const [setuju, tolak, serah_am, batal_cair] = await Promise.all([
        hitung('setuju'),
        hitung('tolak'),
        hitung('serah_am'),
        hitung('batal_cair'),
      ])
      return { setuju, tolak, serah_am, batal_cair }
    },
  })
}
