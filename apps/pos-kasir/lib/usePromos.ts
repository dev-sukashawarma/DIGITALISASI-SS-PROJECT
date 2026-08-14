'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calculateItemPrice, calculateGlobalDiscount, isPromoEligible } from './promo-calculator'
import { db } from '@/lib/db'

export type OutletPromo = {
  id: string
  outlet_id: string
  scope: 'global' | 'item'
  menu_item_id: string | null
  discount_type: 'percentage' | 'nominal'
  discount_value: number
  is_active: boolean
  min_purchase?: number | null
  usage_limit?: number | null
  current_usage?: number
  /** Promo terjadwal: belum berlaku sebelum waktu ini. NULL = berlaku sejak diaktifkan. */
  start_date?: string | null
  end_date?: string | null
  apply_to_food_apps?: boolean
}

export function usePromos(outletId: string | undefined) {
  const [promos, setPromos] = useState<OutletPromo[]>([])
  const [loading, setLoading] = useState(true)

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

    // Fallback polling — dipercepat ke 5 detik agar perubahan jadwal dari admin
    // tidak tertunda terlalu lama bila realtime channel sesaat terputus.
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

  const globalPromo = promos.find(p => p.scope === 'global')
  const itemPromos = promos.filter(p => p.scope === 'item')

  const calcItemPrice = (originalPrice: number, menuId: string, cartBaseSubtotal?: number, salesSource?: string, channelPrices?: Record<string, number> | null): number => {
    return calculateItemPrice(originalPrice, menuId, promos, cartBaseSubtotal, salesSource, channelPrices)
  }

  const calcGlobalDiscount = (subtotal: number): number => {
    return calculateGlobalDiscount(subtotal, promos)
  }

  const getPromoForMenu = (menuId: string): OutletPromo | null => {
    // Promo terjadwal yang belum mulai tidak boleh muncul sebagai badge aktif di menu.
    const globalP = promos.find(p => p.scope === 'global' && isPromoEligible(p))
    if (globalP) return globalP

    const itemP = promos.find(p => p.scope === 'item' && p.menu_item_id === menuId && isPromoEligible(p))
    return itemP || null
  }

  /**
   * Promo yang is_active=true tapi belum mulai (start_date > now).
   * Dipakai untuk badge "Terjadwal" di kartu menu kasir — bukan untuk kalkulasi harga.
   */
  const getScheduledPromoForMenu = (menuId: string): OutletPromo | null => {
    const isScheduled = (p: OutletPromo) => {
      if (!p.is_active) return false
      if (!p.start_date) return false
      const start = new Date(p.start_date).getTime()
      return !isNaN(start) && start > Date.now()
    }

    // Global terjadwal berlaku semua menu
    const globalSched = promos.find(p => p.scope === 'global' && isScheduled(p))
    if (globalSched) return globalSched

    const itemSched = promos.find(p => p.scope === 'item' && p.menu_item_id === menuId && isScheduled(p))
    return itemSched || null
  }

  return { promos, loading, globalPromo, itemPromos, calculateItemPrice: calcItemPrice, calculateGlobalDiscount: calcGlobalDiscount, getPromoForMenu, getScheduledPromoForMenu }
}
