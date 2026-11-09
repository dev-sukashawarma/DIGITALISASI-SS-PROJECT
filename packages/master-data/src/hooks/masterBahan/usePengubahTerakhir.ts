'use client'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createSupabaseBrowserClient as createClient } from '@suka/auth'
import type { PengubahTerakhir } from '../../lib/masterBahan/pengubah'

/**
 * Perubahan terakhir per bahan (data, harga master, harga vendor) + nama pelaku.
 * Kunci diawali 'master_bahan' supaya ikut disegarkan setelah setiap tulis master.
 * Gagal baca (peran tanpa akses) → peta kosong; kolom tampil "—".
 */
export function usePengubahTerakhir() {
  const supabase = useMemo(() => createClient(), [])
  const q = useQuery({
    queryKey: ['master_bahan', 'pengubah_terakhir'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('pengubah_terakhir_bahan')
      if (error) throw error
      return new Map(((data ?? []) as PengubahTerakhir[]).map((r) => [r.bahan_baku_id, r]))
    },
  })
  return q.data ?? new Map<string, PengubahTerakhir>()
}
