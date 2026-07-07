import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type OutletPromo = {
  id: string
  outlet_id: string
  scope: 'global' | 'item'
  menu_item_id: string | null
  discount_type: 'percentage' | 'nominal'
  discount_value: number
  is_active: boolean
  min_purchase?: number | null
  end_date?: string | null
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
      } catch (err) {
        console.error('Failed to load promos:', err)
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

    // Fallback polling to ensure real-time behavior even if replication is off
    const interval = setInterval(() => {
      load(true)
    }, 10000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [outletId])

  const globalPromo = promos.find(p => p.scope === 'global')
  const itemPromos = promos.filter(p => p.scope === 'item')

  const calculateItemPrice = (originalPrice: number, menuId: string, cartBaseSubtotal?: number): number => {
    // If global promo is active, it affects the total, usually not individual item display
    // or maybe it does? Based on requirement, Kasir sets either global OR item.
    // If global is active, we don't apply item promos.
    if (globalPromo) {
      if (globalPromo.end_date && new Date(globalPromo.end_date).getTime() < Date.now()) {
        // global promo is expired, so it's ignored, item promo might apply?
        // Let's just say if global is expired, we fall through to check item promo.
      } else {
        return originalPrice
      }
    }

    const promo = itemPromos.find(p => p.menu_item_id === menuId)
    if (!promo) return originalPrice

    if (promo.end_date && new Date(promo.end_date).getTime() < Date.now()) {
      return originalPrice // Expired
    }

    if (promo.min_purchase && promo.min_purchase > 0) {
      if (cartBaseSubtotal !== undefined && cartBaseSubtotal < promo.min_purchase) {
        return originalPrice // Not reached min purchase
      }
      // If cartBaseSubtotal is undefined (e.g. catalog display), we show the discounted price 
      // so the cashier is aware there is a promo available for this item.
    }

    if (promo.discount_type === 'nominal') {
      return Math.max(0, originalPrice - promo.discount_value)
    } else {
      return Math.max(0, originalPrice * (1 - promo.discount_value / 100))
    }
  }

  const calculateGlobalDiscount = (subtotal: number): number => {
    if (!globalPromo) return 0
    
    if (globalPromo.end_date && new Date(globalPromo.end_date).getTime() < Date.now()) {
      return 0 // Expired
    }

    if (globalPromo.min_purchase && subtotal < globalPromo.min_purchase) {
      return 0 // Not reached min purchase
    }

    if (globalPromo.discount_type === 'nominal') {
      return Math.min(subtotal, globalPromo.discount_value)
    } else {
      return subtotal * (globalPromo.discount_value / 100)
    }
  }

  return { promos, loading, globalPromo, itemPromos, calculateItemPrice, calculateGlobalDiscount }
}
