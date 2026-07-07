'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import KioskUI from '@/components/KioskUI'
import type { MenuItem as MenuItemType, Category } from '@/types'
import { Loader2 } from 'lucide-react'

export default function MenuPage() {
  const [menuItems, setMenuItems] = useState<MenuItemType[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [bestsellerIds, setBestsellerIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [isIdle, setIsIdle] = useState(true)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [outletName, setOutletName] = useState<string>('')
  const [outletId, setOutletId] = useState<string | undefined>()

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()
      
      // 1. Dapatkan sesi & outlet_id
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com'
        return
      }
      
      const { data: profile } = await supabase.from('outlet_staff').select('outlet_id, role').eq('id', user.id).single()
      if (!profile || !profile.outlet_id || profile.role !== 'kiosk') {
        // Jika admin atau kasir membuka halaman ini, tetap izinkan tapi tanpa spesifik outlet (atau gunakan pusat)
        // Tapi idealnya redirect ke login jika bukan role kiosk. Untuk fleksibilitas admin lihat kiosk, kita izinkan.
      }

      const currentOutletId = profile?.outlet_id || '11111111-1111-1111-1111-111111111111' // Fallback to pusat
      setOutletId(currentOutletId)
      
      // 2. Fetch data paralel
      const [items_result, cats_result, cover_result, bs_result, outlet_result, unav_result] = await Promise.all([
        supabase.from('menu_items').select('*, categories(id,name,sort_order)').or(`outlet_id.is.null,outlet_id.eq.${currentOutletId}`).order('sort_order'),
        supabase.from('categories').select('*').order('sort_order'),
        supabase.from('kiosk_settings').select('value').eq('outlet_id', currentOutletId).eq('key', 'cover_image_url').maybeSingle(),
        supabase.from('kiosk_settings').select('value').eq('outlet_id', currentOutletId).eq('key', 'bestseller_ids').maybeSingle(),
        supabase.from('outlets').select('name').eq('id', currentOutletId).single(),
        supabase.from('kiosk_settings').select('value').eq('outlet_id', currentOutletId).eq('key', 'unavailable_menu_ids').maybeSingle()
      ])
      
      setMenuItems(items_result.data ?? [])
      setCategories(cats_result.data ?? [])
      setCoverUrl(cover_result?.data?.value ?? null)
      setOutletName(outlet_result?.data?.name ?? 'Pusat')
      
      let unavailableIds: string[] = []
      try { unavailableIds = unav_result?.data?.value ? JSON.parse(unav_result.data.value) : [] } catch {}

      const fetchedItems = items_result.data ?? []
      setMenuItems(fetchedItems.map(item => {
        const isGlobal = item.outlet_id === null
        if (isGlobal && unavailableIds.includes(item.id)) {
          return { ...item, is_available: false }
        }
        return item
      }))

      try {
        setBestsellerIds(bs_result?.data?.value ? JSON.parse(bs_result.data.value) : [])
      } catch {
        setBestsellerIds([])
      }
      
      setLoading(false)
    }
    fetchData()

    const supabase = createClient()
    
    // Real-time listener untuk sinkronisasi seketika saat kasir ubah ketersediaan (is_available)
    const channel = supabase.channel('kiosk-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_items' },
        (payload) => {
          if (!outletId) return; // tunggu sampai outletId diketahui
          const updatedItem = payload.new as MenuItemType;
          setMenuItems(prev => prev.map(item => item.id === updatedItem.id ? { ...item, ...updatedItem } : item));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kiosk_settings' },
        (payload) => {
          const updated = payload.new;
          if (updated.key === 'unavailable_menu_ids') {
            try {
              const unavIds: string[] = JSON.parse(updated.value || '[]');
              setMenuItems(prev => prev.map(item => {
                if (item.outlet_id === null) {
                  return { ...item, is_available: !unavIds.includes(item.id) };
                }
                return item;
              }));
            } catch (e) {}
          } else if (updated.key === 'bestseller_ids') {
             try { setBestsellerIds(JSON.parse(updated.value || '[]')); } catch (e) {}
          } else if (updated.key === 'cover_image_url') {
             setCoverUrl(updated.value || null);
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
      categories={categories} 
      bestsellerIds={bestsellerIds}
      coverUrl={coverUrl} 
      outletName={outletName}
      outletId={outletId}
      isIdle={isIdle} 
      setIsIdle={setIsIdle} 
    />
  )
}
