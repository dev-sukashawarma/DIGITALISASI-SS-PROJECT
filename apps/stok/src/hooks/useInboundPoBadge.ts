'use client'

import { useQuery } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@suka/auth'

/**
 * Daftar PO yang sedang menunggu diterima (dikirim ke supplier / sebagian
 * diterima) dalam 30 hari terakhir — sumber badge "Terima PO".
 *
 * Dulu sidebar (AppSidebar) dan bottom nav (BottomNav) masing-masing punya
 * kunci sendiri (`sidebar-inbound-pos` & `bottomnav-inbound-pos`) dengan
 * queryFn identik, sehingga RPC get_purchase_orders dipanggil dua kali.
 * Sekarang satu kunci bersama; perilaku (rentang tanggal, filter status,
 * galat → daftar kosong, staleTime 30 dtk) dipertahankan persis.
 */
export function useInboundPoBadge(enabled: boolean) {
  const { data: inboundPos = [] } = useQuery({
    queryKey: ['inbound-pos-badge'],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient()
      const { data, error } = await supabase.rpc('get_purchase_orders', {
        p_from: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
        p_to: new Date().toISOString().split('T')[0],
        p_status: null,
      })
      if (error) return []
      return (data ?? []).filter(
        (p: any) => p.status === 'dikirim_ke_supplier' || p.status === 'sebagian_diterima',
      )
    },
    enabled,
    staleTime: 30000,
  })
  return inboundPos.length
}
