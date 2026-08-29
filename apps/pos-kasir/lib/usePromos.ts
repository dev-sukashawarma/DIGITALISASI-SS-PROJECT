'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calculateItemPrice, calculateGlobalDiscount, isPromoEligible } from './promo-calculator'
import { db } from '@/lib/db'

export type OutletPromo = {
  id: string
  promo_name?: string | null
  outlet_id: string
  scope: 'global' | 'item'
  menu_item_id: string | null
  discount_type: 'percentage' | 'nominal' | 'buy_one_get_one'
  discount_value: number
  is_active: boolean
  min_purchase?: number | null
  usage_limit?: number | null
  current_usage?: number
  quota_scope?: 'global' | 'per_outlet'
  /** Promo terjadwal: belum berlaku sebelum waktu ini. NULL = berlaku sejak diaktifkan. */
  start_date?: string | null
  end_date?: string | null
  apply_to_food_apps?: boolean
  buy_quantity?: number
  get_quantity?: number
}

export function usePromos(outletId: string | undefined) {
  const [promos, setPromos] = useState<OutletPromo[]>([])
  const [loading, setLoading] = useState(true)
  // Tick setiap 5 detik → memaksa re-render sehingga isPromoEligible dievaluasi
  // ulang tepat saat start_date/end_date tercapai tanpa menunggu polling berikutnya.
  const [now, setNow] = useState<number>(() => Date.now())

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    if (!outletId) {
      setPromos([])
      setLoading(false)
      return
    }

    async function load(isSilent = false) {
      try {
        if (!isSilent) setLoading(true)
        const supabase = createClient()
        const { data, error } = await supabase
          .from('outlet_promos')
          .select('*')
          .eq('outlet_id', outletId)
          .eq('is_active', true)

        if (error) throw error
        setPromos(data || [])
        // Cache promo ke IndexedDB untuk dipakai saat offline
        await db.app_state.put({ key: `promos:${outletId}`, value: data || [], synced_at: Date.now() }).catch(() => {})
      } catch (err) {
        console.warn('Failed to load promos, fallback ke cache IndexedDB:', err)
        const cached = await db.app_state.get(`promos:${outletId}`).catch(() => undefined)
        if (cached?.value) setPromos(cached.value)
      } finally {
        setLoading(false)
      }
    }

    load()

    const supabase = createClient()
    const uniqueId = Math.random().toString(36).substring(7)
    const channel = supabase
      .channel(`promos-realtime-${outletId}-${uniqueId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'outlet_promos', filter: `outlet_id=eq.${outletId}` },
        () => load(true)
      )
      .subscribe()

    // Fallback polling setiap 5 detik — memastikan data segar bila realtime
    // channel sesaat terputus DAN sekaligus me-refresh now via setNow di atas.
    const interval = setInterval(() => {
      load(true)
    }, 5000)

    // Re-fetch segera saat tab kembali aktif (misalnya kasir alt-tab lalu balik).
    const handleVisibility = () => { if (!document.hidden) load(true) }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [outletId])

  // ─── Derived: hanya promo yang BENAR-BENAR sedang berjalan ─────────────────
  // Menggunakan `now` dari state sehingga komponen konsumen re-render
  // secara otomatis setiap 5 detik — bukan hanya saat data baru datang.
  const activeGlobalPromo = promos.find(p => p.scope === 'global' && isPromoEligible(p, now)) ?? null
  const activeItemPromos  = promos.filter(p => p.scope === 'item' && isPromoEligible(p, now))

  const calcItemPrice = (
    originalPrice: number,
    menuId: string,
    cartBaseSubtotal?: number,
    salesSource?: string,
    channelPrices?: Record<string, number> | null,
    opts?: { ignoreFoodAppRule?: boolean }
  ): number => {
    return calculateItemPrice(originalPrice, menuId, promos, cartBaseSubtotal, salesSource, channelPrices, now, opts)
  }

  const calcGlobalDiscount = (subtotal: number): number => {
    return calculateGlobalDiscount(subtotal, promos)
  }

  /** Promo yang sedang AKTIF dan berada di dalam jendela jadwal. */
  const getPromoForMenu = (menuId: string): OutletPromo | null => {
    if (activeGlobalPromo) return activeGlobalPromo
    return activeItemPromos.find(p => p.menu_item_id === menuId) ?? null
  }

  /**
   * Promo yang is_active=true tapi start_date masih di depan (belum mulai).
   * Dipakai untuk badge "Terjadwal" di kartu menu kasir — bukan untuk kalkulasi harga.
   */
  const getScheduledPromoForMenu = (menuId: string): OutletPromo | null => {
    const isScheduled = (p: OutletPromo) => {
      if (!p.is_active) return false
      if (!p.start_date) return false
      const start = new Date(p.start_date).getTime()
      // Jika sudah lewat end_date juga bukan "terjadwal"
      if (p.end_date) {
        const end = new Date(p.end_date).getTime()
        if (!isNaN(end) && end < now) return false
      }
      return !isNaN(start) && start > now
    }

    const globalSched = promos.find(p => p.scope === 'global' && isScheduled(p))
    if (globalSched) return globalSched

    return promos.find(p => p.scope === 'item' && p.menu_item_id === menuId && isScheduled(p)) ?? null
  }

  return {
    promos,
    loading,
    /** Promo global yang SEDANG BERJALAN (lolos jadwal & kuota). */
    globalPromo: activeGlobalPromo,
    /** Promo per-item yang SEDANG BERJALAN (lolos jadwal & kuota). */
    itemPromos: activeItemPromos,
    calculateItemPrice: calcItemPrice,
    calculateGlobalDiscount: calcGlobalDiscount,
    getPromoForMenu,
    getScheduledPromoForMenu,
  }
}
