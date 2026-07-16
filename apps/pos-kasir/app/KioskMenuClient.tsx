'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import KioskUI from '@/components/KioskUI'
import type { MenuItem as MenuItemType, Category } from '@/types'

export interface KioskInitialData {
  menuItems: MenuItemType[]
  categories: Category[]
  bestsellerIds: string[]
  coverUrl: string | null
  outletName: string
  outletId?: string
}

export default function KioskMenuClient({ initialData }: { initialData: KioskInitialData }) {
  const [menuItems, setMenuItems] = useState<MenuItemType[]>(initialData.menuItems)
  const [bestsellerIds, setBestsellerIds] = useState<string[]>(initialData.bestsellerIds)
  const [coverUrl, setCoverUrl] = useState<string | null>(initialData.coverUrl)
  const [isIdle, setIsIdle] = useState(true)
  const outletId = initialData.outletId

  // Realtime listener untuk sinkronisasi seketika saat kasir ubah ketersediaan (is_available)
  // Data awal sudah dirender server-side; effect ini hanya menjaga data tetap segar.
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase.channel('kiosk-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_items' },
        (payload) => {
          if (!outletId) return
          const updatedItem = payload.new as MenuItemType
          setMenuItems(prev => prev.map(item => item.id === updatedItem.id ? { ...item, ...updatedItem } : item))
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kiosk_settings' },
        (payload) => {
          const updated = payload.new as any
          if (updated.key === 'unavailable_menu_ids' || updated.key === 'auto_unavailable_menu_ids' || updated.key === 'force_available_menu_ids') {
            // Fetch both settings to combine them
            supabase
              .from('kiosk_settings')
              .select('key, value, outlet_id')
              .or(`outlet_id.is.null,outlet_id.eq.550e8400-e29b-41d4-a716-446655440001,outlet_id.eq.${outletId}`)
              .in('key', ['unavailable_menu_ids', 'auto_unavailable_menu_ids', 'force_available_menu_ids'])
              .then(({ data }) => {
                const PUSAT_OUTLET_ID = '550e8400-e29b-41d4-a716-446655440001'
                const parseIds = (raw: string | null | undefined) => {
                  try { return raw ? JSON.parse(raw) : [] } catch { return [] }
                }
                const getSetting = (key: string, preferGlobal: boolean = false) => {
                  const rows = data?.filter(s => s.key === key) || []
                  const sortedRows = [...rows].sort((a, b) => {
                    const getWeight = (id: string | null) => {
                      if (preferGlobal) {
                        if (id === null) return 3
                        if (id === PUSAT_OUTLET_ID) return 2
                        if (id === outletId) return 1
                        return 0
                      } else {
                        if (id === outletId) return 3
                        if (id === PUSAT_OUTLET_ID) return 2
                        if (id === null) return 1
                        return 0
                      }
                    }
                    return getWeight(a.outlet_id) - getWeight(b.outlet_id)
                  })
                  const best = sortedRows.pop()
                  return parseIds(best?.value)
                }

                let manualIds = getSetting('unavailable_menu_ids', false)
                let autoIds = getSetting('auto_unavailable_menu_ids', false)
                let forceIds = getSetting('force_available_menu_ids', false)

                const manualSet = new Set(manualIds)
                const autoSet = new Set(autoIds)
                const forceSet = new Set(forceIds)
                
                setMenuItems(prev => prev.map(item => {
                  const isManualUnav = manualSet.has(item.id)
                  const isAutoUnav = autoSet.has(item.id)
                  const isForceAvail = forceSet.has(item.id)
                  const isAvailable = !(isManualUnav || (isAutoUnav && !isForceAvail))
                  return { ...item, is_available: isAvailable }
                }))
              })
          } else if (updated.key === 'bestseller_ids') {
            try { setBestsellerIds(JSON.parse(updated.value || '[]')) } catch (e) {}
          } else if (updated.key === 'cover_image_url') {
            setCoverUrl(updated.value || null)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [outletId])

  return (
    <KioskUI
      menuItems={menuItems}
      categories={initialData.categories}
      bestsellerIds={bestsellerIds}
      coverUrl={coverUrl}
      outletName={initialData.outletName}
      outletId={outletId}
      isIdle={isIdle}
      setIsIdle={setIsIdle}
    />
  )
}
