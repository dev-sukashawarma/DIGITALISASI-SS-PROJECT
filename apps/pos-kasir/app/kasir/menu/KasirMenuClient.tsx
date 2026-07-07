'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import {
  Loader2,
  Sandwich, ToggleLeft, ToggleRight,
  FileArchive, Search, Star, PlusCircle, Globe, ThumbsUp, ChevronDown, Check, CheckCircle2, AlertCircle
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useMyOutlet } from '@/lib/useMyOutlet'
import { formatRupiah } from '@/lib/validations'
import type { MenuItem, Category } from '@/types'
import { Skeleton } from '@suka/design-system'

const BUCKET = 'menu-images'

export interface MenuQueryData {
  items: MenuItem[]
  categories: Category[]
  bestsellers: string[]
  upsells: string[]
  recommendations: string[]
  unavailableIds: string[]
}

async function fetchMenuData(outletId: string): Promise<MenuQueryData> {
  const supabase = createClient()

  const [{ data: m }, { data: c }, { data: b }, { data: u }, { data: unav }, { data: rec }] = await Promise.all([
    supabase.from('menu_items').select('*, categories(id,name,sort_order)').or(`outlet_id.is.null,outlet_id.eq.${outletId}`).order('sort_order'),
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('kiosk_settings').select('value').eq('outlet_id', outletId).eq('key', 'bestseller_ids').maybeSingle(),
    supabase.from('kiosk_settings').select('value').eq('outlet_id', outletId).eq('key', 'upsell_ids').maybeSingle(),
    supabase.from('kiosk_settings').select('value').eq('outlet_id', outletId).eq('key', 'unavailable_menu_ids').maybeSingle(),
    supabase.from('kiosk_settings').select('value').eq('outlet_id', outletId).eq('key', 'recommendation_ids').maybeSingle(),
  ])

  const parseIds = (raw: string | null | undefined) => {
    try { return raw ? JSON.parse(raw) : [] } catch { return [] }
  }

  return {
    items: m ?? [],
    categories: c ?? [],
    bestsellers: parseIds(b?.value),
    upsells: parseIds(u?.value),
    recommendations: parseIds(rec?.value),
    unavailableIds: parseIds(unav?.value),
  }
}

type Toast = { type: 'success' | 'error'; message: string } | null

export default function KasirMenuClient({
  initialData,
  serverOutletId
}: {
  initialData: MenuQueryData,
  serverOutletId: string
}) {
  const { outletId: clientOutletId } = useMyOutlet()
  const outletId = clientOutletId || serverOutletId
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast>(null)

  const showToast = useCallback((t: Toast) => {
    setToast(t)
    if (t) setTimeout(() => setToast(null), 3500)
  }, [])

  const { data, isLoading: loading } = useQuery({
    queryKey: ['menu', outletId],
    queryFn: () => fetchMenuData(outletId as string),
    enabled: !!outletId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    initialData: initialData,
    retry: false,
  })

  // Real-time updates for Menu & Settings
  useEffect(() => {
    if (!outletId) return;
    const supabase = createClient()
    const channel = supabase.channel('kasir-menu-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_items' },
        () => queryClient.invalidateQueries({ queryKey: ['menu', outletId] })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kiosk_settings', filter: `outlet_id=eq.${outletId}` },
        () => queryClient.invalidateQueries({ queryKey: ['menu', outletId] })
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [outletId, queryClient])

  const items = data?.items ?? []
  const categories = data?.categories ?? []
  const bestsellers = data?.bestsellers ?? []
  const upsells = data?.upsells ?? []
  const recommendations = data?.recommendations ?? []
  const unavailableIds = data?.unavailableIds ?? []

  const invalidateMenu = () => queryClient.invalidateQueries({ queryKey: ['menu', outletId] })

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!(e.target as Element).closest('.dropdown-trigger') && !(e.target as Element).closest('.dropdown-menu')) {
        setOpenDropdownId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function toggleAvail(item: MenuItem) {
    if (!outletId) return
    const supabase = createClient()

    try {
      if (item.outlet_id === outletId) {
        const { error } = await supabase.from('menu_items').update({ is_available: !item.is_available }).eq('id', item.id)
        if (error) throw error
      } else {
        const isUnav = unavailableIds.includes(item.id)
        const newUnav = isUnav
          ? unavailableIds.filter(id => id !== item.id)
          : [...unavailableIds, item.id]

        const { error } = await supabase.from('kiosk_settings').upsert({
          outlet_id: outletId,
          key: 'unavailable_menu_ids',
          value: JSON.stringify(newUnav)
        })
        if (error) throw error
      }
      invalidateMenu()
      showToast({ type: 'success', message: `Status menu ${item.name} berhasil diubah` })
    } catch (e) {
      showToast({ type: 'error', message: `Gagal mengubah status menu ${item.name}` })
    }
  }

  async function toggleBestseller(item: MenuItem) {
    if (!outletId) return
    const isBs = bestsellers.includes(item.id)
    const newBs = isBs
      ? bestsellers.filter(id => id !== item.id)
      : [...bestsellers, item.id]

    try {
      const supabase = createClient()
      const { error } = await supabase.from('kiosk_settings').upsert({
        outlet_id: outletId,
        key: 'bestseller_ids',
        value: JSON.stringify(newBs)
      })
      if (error) throw error
      invalidateMenu()
      showToast({ type: 'success', message: isBs ? `${item.name} dihapus dari Best Seller` : `${item.name} ditandai sebagai Best Seller` })
    } catch (e) {
      showToast({ type: 'error', message: 'Gagal mengubah Best Seller' })
    }
  }

  async function toggleUpsell(item: MenuItem) {
    if (!outletId) return
    const isUp = upsells.includes(item.id)
    const newUp = isUp
      ? upsells.filter(id => id !== item.id)
      : [...upsells, item.id]

    try {
      const supabase = createClient()
      const { error } = await supabase.from('kiosk_settings').upsert({
        outlet_id: outletId,
        key: 'upsell_ids',
        value: JSON.stringify(newUp)
      })
      if (error) throw error
      invalidateMenu()
      showToast({ type: 'success', message: isUp ? `${item.name} dihapus dari Menu Ekstra` : `${item.name} dijadikan Menu Ekstra` })
    } catch (e) {
      showToast({ type: 'error', message: 'Gagal mengubah Menu Ekstra' })
    }
  }

  async function toggleRecommendation(item: MenuItem) {
    if (!outletId) return
    const isRec = recommendations.includes(item.id)
    const newRec = isRec
      ? recommendations.filter(id => id !== item.id)
      : [...recommendations, item.id]

    try {
      const supabase = createClient()
      const { error } = await supabase.from('kiosk_settings').upsert({
        outlet_id: outletId,
        key: 'recommendation_ids',
        value: JSON.stringify(newRec)
      })
      if (error) throw error
      invalidateMenu()
      showToast({ type: 'success', message: isRec ? `${item.name} dihapus dari Menu Rekomendasi` : `${item.name} dijadikan Menu Rekomendasi` })
    } catch (e) {
      showToast({ type: 'error', message: 'Gagal mengubah Menu Rekomendasi' })
    }
  }


  const filteredItems = items.filter(item => {
    if (!searchQuery) return true;
    const lowerQ = searchQuery.toLowerCase();
    return item.name.toLowerCase().includes(lowerQ) || 
           (item.categories?.name && item.categories.name.toLowerCase().includes(lowerQ));
  });

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Manajemen Menu Kasir</h1>
          <p className="text-gray-400 text-sm mt-0.5">{filteredItems.length} menu tampil</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative w-full sm:w-auto sm:min-w-[200px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-2xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors text-sm"
              placeholder="Cari menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

        </div>
      </div>


      {/* ── Menu Grid / Table ────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card p-16 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-4">
            <Sandwich className="w-8 h-8 text-amber-200" strokeWidth={1} />
          </div>
          <p className="font-semibold text-gray-500">Belum ada menu</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="card p-16 flex flex-col items-center text-center">
          <Search className="w-10 h-10 text-gray-200 mb-3" />
          <p className="font-semibold text-gray-500">Menu tidak ditemukan</p>
        </div>
      ) : (
        <div className="card overflow-visible pb-32">
          <div className="overflow-x-auto overflow-y-visible">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left py-3.5 px-5 font-semibold text-gray-500 w-16">Foto</th>
                  <th className="text-left py-3.5 px-4 font-semibold text-gray-500">Nama Menu</th>
                  <th className="text-left py-3.5 px-4 font-semibold text-gray-500 hidden sm:table-cell">Kategori</th>
                  <th className="text-right py-3.5 px-4 font-semibold text-gray-500">Harga</th>
                  <th className="text-center py-3.5 px-4 font-semibold text-gray-500">Status</th>
                  <th className="text-right py-3.5 px-5 font-semibold text-gray-500">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, idx) => {
                  const isGlobal = item.outlet_id === null;
                  const isAvail = isGlobal 
                    ? item.is_available && !unavailableIds.includes(item.id)
                    : item.is_available;

                  return (
                    <tr
                      key={item.id}
                      className={`border-b border-gray-50 hover:bg-gray-50/60 transition-colors
                        ${idx === filteredItems.length - 1 ? 'border-0' : ''}`}
                    >
                      {/* Thumbnail */}
                      <td className="py-3.5 px-5 relative">
                        {isGlobal && (
                          <div className="absolute top-2 left-2 z-10 bg-blue-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm" title="Menu Global (Admin)">
                            <Globe className="w-2.5 h-2.5" />
                          </div>
                        )}
                        <div className="w-12 h-12 rounded-2xl overflow-hidden bg-amber-50 flex items-center justify-center">
                          {item.image_url ? (
                            <Image src={item.image_url} alt={item.name} width={48} height={48}
                              className="object-cover w-full h-full" />
                          ) : (
                            <Sandwich className="w-5 h-5 text-amber-200" strokeWidth={1.5} />
                          )}
                        </div>
                      </td>

                      {/* Name */}
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-gray-900 leading-none flex items-center gap-2">
                          {item.name}
                        </p>
                        {item.description && (
                          <p className="text-gray-400 text-xs mt-1 truncate max-w-[200px]">{item.description}</p>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4 hidden sm:table-cell">
                        {item.categories
                          ? <span className="badge-amber">{item.categories.name}</span>
                          : <span className="text-gray-300">—</span>
                        }
                      </td>

                      {/* Price */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-bold text-gray-900">{formatRupiah(item.price)}</span>
                      </td>

                      {/* Status toggle */}
                      <td className="py-3.5 px-4 text-center">
                        <button onClick={() => toggleAvail(item)}
                          className={`text-xs font-bold px-3.5 py-1.5 rounded-2xl transition-all
                            ${isAvail
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-red-50 text-red-500 hover:bg-red-100'}`}>
                          {isAvail ? 'Tersedia' : 'Habis'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-5 relative">
                        <div className="flex items-center justify-end">
                          <button 
                            className="dropdown-trigger px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 flex items-center gap-2 text-gray-700 font-semibold transition-all"
                            onClick={() => setOpenDropdownId(openDropdownId === item.id ? null : item.id)}
                          >
                            Aksi <ChevronDown className="w-4 h-4 text-gray-400" />
                          </button>
                        </div>
                        
                        {openDropdownId === item.id && (
                          <div className="dropdown-menu absolute right-5 top-14 z-50 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 animate-scale-in origin-top-right">
                            <button onClick={() => { toggleRecommendation(item); setOpenDropdownId(null) }} className="w-full text-left px-3 py-2.5 hover:bg-gray-50 rounded-xl text-[13px] flex items-center justify-between transition-colors">
                              <span className={recommendations.includes(item.id) ? 'font-bold text-amber-600' : 'font-medium text-gray-700'}>Jadikan Menu Rekomendasi</span>
                              {recommendations.includes(item.id) && <Check className="w-4 h-4 text-amber-600" />}
                            </button>
                            <button onClick={() => { toggleUpsell(item); setOpenDropdownId(null) }} className="w-full text-left px-3 py-2.5 hover:bg-gray-50 rounded-xl text-[13px] flex items-center justify-between transition-colors">
                              <span className={upsells.includes(item.id) ? 'font-bold text-amber-600' : 'font-medium text-gray-700'}>Jadikan Menu Ekstra</span>
                              {upsells.includes(item.id) && <Check className="w-4 h-4 text-amber-600" />}
                            </button>
                            <button onClick={() => { toggleBestseller(item); setOpenDropdownId(null) }} className="w-full text-left px-3 py-2.5 hover:bg-gray-50 rounded-xl text-[13px] flex items-center justify-between transition-colors">
                              <span className={bestsellers.includes(item.id) ? 'font-bold text-amber-600' : 'font-medium text-gray-700'}>Tandai Best Seller</span>
                              {bestsellers.includes(item.id) && <Check className="w-4 h-4 text-amber-600" />}
                            </button>
                            
                                                      </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[999] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg font-semibold text-sm animate-fade-up ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {toast.message}
        </div>
      )}
    </div>
  )
}
