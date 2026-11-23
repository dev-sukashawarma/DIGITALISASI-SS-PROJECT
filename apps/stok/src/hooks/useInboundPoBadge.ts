'use client'

import { useQuery } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@suka/auth'
import { ambilPoTerbuka } from '@/lib/stok/poTerbuka'

/**
 * Daftar PO yang sedang menunggu diterima (dikirim ke supplier / sebagian
 * diterima) — sumber badge "Terima PO".
 *
 * Dulu sidebar (AppSidebar) dan bottom nav (BottomNav) masing-masing punya
 * kunci sendiri (`sidebar-inbound-pos` & `bottomnav-inbound-pos`) dengan
 * queryFn identik, sehingga RPC get_purchase_orders dipanggil dua kali.
 * Sekarang satu kunci bersama.
 *
 * Sumber data sama dengan halaman Penerimaan PO (ambilPoTerbuka): semua PO
 * berstatus terbuka tanpa batas umur. Dulu hanya tanggal_po 30 hari terakhir
 * (batas atas tanggal UTC), sehingga PO terbuka yang lebih lama tak terhitung.
 * Galat → 0 (badge tidak boleh memecah navigasi), staleTime 30 dtk.
 */
export function useInboundPoBadge(enabled: boolean) {
  const { data: inboundPos = [] } = useQuery({
    queryKey: ['inbound-pos-badge'],
    queryFn: async () => {
      try {
        return await ambilPoTerbuka(createSupabaseBrowserClient())
      } catch {
        return []
      }
    },
    enabled,
    staleTime: 30000,
  })
  return inboundPos.length
}
