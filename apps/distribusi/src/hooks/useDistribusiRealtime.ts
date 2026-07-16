'use client'

import { useRealtimeInvalidate } from '@suka/realtime'

/**
 * Realtime distribusi (Surat Jalan).
 * - Pusat (daftar Surat Jalan): tanpa outletId → subscribe semua surat_jalan.
 * - Outlet (Terima): dengan outletId → subscribe surat_jalan outlet itu saja.
 *
 * Catatan: Permintaan Bahan TIDAK di-subscribe di sini — daftar/approval
 * permintaan berada di app `stok` (PermintaanList/ApprovalList), bukan
 * distribusi. Realtime permintaan menjadi tanggung jawab app stok (follow-up).
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
    ],
  })
}
