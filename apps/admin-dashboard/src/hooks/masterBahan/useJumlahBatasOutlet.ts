'use client'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'

/**
 * Jumlah outlet yang punya batas minimum khusus (outlet_reorder_point) per bahan.
 * Hanya informasi (K8): penimpa per outlet tetap diatur di app Stok. Bila RLS
 * menolak baca, `tersedia` = false dan layar tidak menampilkan angka.
 */
export function useJumlahBatasOutlet() {
  const supabase = useMemo(() => createClient(), [])
  const q = useQuery({
    queryKey: ['master_bahan', 'batas_outlet'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('outlet_reorder_point').select('bahan_baku_id')
      if (error) return { jumlah: new Map<string, number>(), tersedia: false }
      const jumlah = new Map<string, number>()
      for (const r of (data ?? []) as { bahan_baku_id: string }[]) {
        jumlah.set(r.bahan_baku_id, (jumlah.get(r.bahan_baku_id) ?? 0) + 1)
      }
      return { jumlah, tersedia: true }
    },
  })
  return q.data ?? { jumlah: new Map<string, number>(), tersedia: false }
}
