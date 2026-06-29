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

    async function load() {
      try {
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
  }, [outletId])

  const globalPromo = promos.find(p => p.scope === 'global')
  const itemPromos = promos.filter(p => p.scope === 'item')

  const calculateItemPrice = (originalPrice: number, menuId: string): number => {
    // If global promo is active, it affects the total, usually not individual item display
    // or maybe it does? Based on requirement, Kasir sets either global OR item.
    // If global is active, we don't apply item promos.
    if (globalPromo) return originalPrice

    const promo = itemPromos.find(p => p.menu_item_id === menuId)
    if (!promo) return originalPrice

    if (promo.discount_type === 'nominal') {
      return Math.max(0, originalPrice - promo.discount_value)
    } else {
      return Math.max(0, originalPrice * (1 - promo.discount_value / 100))
    }
  }

  const calculateGlobalDiscount = (subtotal: number): number => {
    if (!globalPromo) return 0
    if (globalPromo.discount_type === 'nominal') {
      return Math.min(subtotal, globalPromo.discount_value)
    } else {
      return subtotal * (globalPromo.discount_value / 100)
    }
  }

  return { promos, loading, globalPromo, itemPromos, calculateItemPrice, calculateGlobalDiscount }
}
