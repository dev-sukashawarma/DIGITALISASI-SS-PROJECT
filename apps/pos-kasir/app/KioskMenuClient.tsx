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
          if (updated.key === 'unavailable_menu_ids') {
            try {
              const unavIds: string[] = JSON.parse(updated.value || '[]')
              setMenuItems(prev => prev.map(item => {
                if (item.outlet_id === null) {
                  return { ...item, is_available: !unavIds.includes(item.id) }
                }
                return item
              }))
            } catch (e) {}
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
