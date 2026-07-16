'use client'

import { useRealtimeInvalidate } from '@suka/realtime'

/**
 * Realtime distribusi.
 * - Pusat (daftar Surat Jalan): tanpa outletId → subscribe semua surat_jalan.
 * - Outlet (Terima): dengan outletId → subscribe surat_jalan outlet itu saja.
 * Keduanya juga menyalakan Permintaan Bahan.
 */
export function useDistribusiRealtime(outletId?: string | null) {
  useRealtimeInvalidate({
    channelName: outletId ? `distribusi-${outletId}` : 'distribusi-pusat',
    subs: [
      {
        table: 'surat_jalan',
        filter: outletId ? `outlet_id=eq.${outletId}` : undefined,
        queryKeys: outletId ? [['surat_jalan_terima', outletId]] : [['surat_jalan']],
      },
      {
        table: 'permintaan_bahan',
        filter: outletId ? `outlet_id=eq.${outletId}` : undefined,
        queryKeys: [['permintaan_bahan']],
      },
    ],
  })
}
