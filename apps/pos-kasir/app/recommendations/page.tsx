'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Sandwich, Loader2, ArrowRight } from 'lucide-react'
import { useCart } from '@/store/cart'
import type { MenuItem } from '@/types'
import { formatRupiah } from '@/lib/validations'
import { createClient } from '@/lib/supabase/client'

export default function RecommendationsPage() {
  const router = useRouter()
  const { items: cartItems, addItem } = useCart()
  const [recommendations, setRecommendations] = useState<MenuItem[]>([])
  const [upsellItems, setUpsellItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)

  // Track selected items: { [menuId]: { note: string, upsells: Record<string, number> } }
  const [selectedItems, setSelectedItems] = useState<Record<string, { note: string, upsells: Record<string, number> }>>({})

  useEffect(() => {
    if (cartItems.length === 0) {
      router.replace('/')
      return
    }

    async function initData() {
      const supabase = createClient()
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }
      
      const { data: profile } = await supabase.from('profiles').select('outlet_id').eq('id', user.id).single()
      const currentOutletId = profile?.outlet_id || '11111111-1111-1111-1111-111111111111'

      const { data: settings } = await supabase
        .from('kiosk_settings')
        .select('key, value')
        .eq('outlet_id', currentOutletId)
        .in('key', ['upsell_ids', 'unavailable_menu_ids', 'recommendation_ids'])

      let unavIds: string[] = []
      let upIds: string[] = []
      let recIds: string[] = []
      
      settings?.forEach(s => {
        if (s.key === 'unavailable_menu_ids' && s.value) {
          try { unavIds = JSON.parse(s.value) } catch {}
        }
        if (s.key === 'upsell_ids' && s.value) {
          try { upIds = JSON.parse(s.value) } catch {}
        }
        if (s.key === 'recommendation_ids' && s.value) {
          try { recIds = JSON.parse(s.value) } catch {}
        }
      })

      const cartIdSet = new Set(cartItems.map(c => c.item.id))
      let recs: MenuItem[] = []

      // If Kasir has manually set recommendations, use them. Otherwise fallback to API.
      if (recIds.length > 0) {
        const { data: mItems } = await supabase
          .from('menu_items')
          .select('*')
          .in('id', recIds)
          .eq('is_available', true)
          
        recs = (mItems || []).filter(m => !cartIdSet.has(m.id))
      } else {
        const cartIds = cartItems.map(c => c.item.id).join(',')
        try {
          const res = await fetch(`/api/recommendations?cart=${cartIds}&limit=5`)
          const data = await res.json()
          recs = (data.items || []).filter((m: MenuItem) => !cartIdSet.has(m.id))
        } catch {}
      }

      // Filter recommendations availability based on outlet setting
      const finalRecs = recs.filter(m => {
        const isGlobal = m.outlet_id === null
        if (isGlobal && unavIds.includes(m.id)) return false
        return true
      })

      if (finalRecs.length === 0) {
        router.replace('/checkout')
        return
      }

      setRecommendations(finalRecs)

      // Fetch upsell items
      if (upIds.length > 0) {
        const { data: uItems } = await supabase
          .from('menu_items')
          .select('*')
          .in('id', upIds)
          .eq('is_available', true)
          
        const filteredUpsells = (uItems || []).filter(u => {
          if (u.outlet_id === null && unavIds.includes(u.id)) return false
          return true
        })
        setUpsellItems(filteredUpsells)
      }

      setLoading(false)
    }

    initData()
  }, [cartItems, router])

  function handleContinue() {
    // Add selected items to cart
    Object.entries(selectedItems).forEach(([uId, data]) => {
      const uItem = recommendations.find(u => u.id === uId)
      if (uItem) {
        // 1. Add recommendation as main item
        const parentId = addItem(uItem, 1, data.note)
        
        // 2. Add selected extras as children
        Object.keys(data.upsells).forEach(upsellId => {
          const extraItem = upsellItems.find(x => x.id === upsellId)
          if (extraItem) {
            addItem(extraItem, 1, '', parentId)
          }
        })
      }
    })
    router.push('/checkout')
  }

  function handleNoThanks() {
    router.push('/checkout')
  }

  function toggleItem(uId: string) {
    setSelectedItems(prev => {
      const next = { ...prev }
      if (next[uId]) {
        delete next[uId]
      } else {
        next[uId] = { note: '', upsells: {} }
      }
      return next
    })
  }

  function updateNote(uId: string, note: string) {
    setSelectedItems(prev => ({
      ...prev,
      [uId]: { ...prev[uId], note }
    }))
  }

  function toggleUpsell(recId: string, upsellId: string) {
    setSelectedItems(prev => {
      if (!prev[recId]) return prev
      const currentUpsells = prev[recId].upsells
      const newUpsells = { ...currentUpsells }
      if (newUpsells[upsellId]) {
        delete newUpsells[upsellId]
      } else {
        newUpsells[upsellId] = 1
      }
      return {
        ...prev,
        [recId]: { ...prev[recId], upsells: newUpsells }
      }
    })
  }

  if (loading) {
    return <div className="min-h-screen bg-[#FFFBF5]" />
  }

  if (recommendations.length === 0) {
    return null // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-[#FFFBF5] pb-32">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-5 py-6 text-center space-y-2">
          <div className="inline-flex items-center justify-center gap-1.5 bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold mb-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            Penawaran Spesial Sebelum Bayar!
          </div>
          <h1 className="text-2xl font-black text-gray-900 leading-tight tracking-tight">Lengkapi Pesananmu</h1>
          <p className="text-[15px] font-medium text-gray-500">Paling pas dinikmati bersama...</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 gap-4">
          {recommendations.map((u, idx) => {
            const isSelected = !!selectedItems[u.id]
            const badges = ['🔥 Paling Laris', '👍 Favorit', '⭐ Pilihan Chef', '✨ Terbatas']
            const badge = badges[idx % badges.length]

            return (
              <div
                key={u.id}
                className={`bg-white rounded-[1.5rem] overflow-hidden border transition-all duration-300 flex flex-col relative
                  ${isSelected ? 'border-amber-400 shadow-lg shadow-amber-500/10 ring-2 ring-amber-400/20' : 'border-gray-100 shadow-sm hover:border-amber-200'}`}
              >
                {/* Image Section */}
                <div className="relative w-full aspect-[4/3] bg-gray-50 group overflow-hidden">
                  {u.image_url ? (
                    <Image src={u.image_url} alt={u.name} fill className="object-cover group-hover:scale-105 transition-transform duration-500" unoptimized/>
                  ) : (
                    <Sandwich className="w-12 h-12 m-auto absolute inset-0 text-gray-300" strokeWidth={1.5}/>
                  )}
                  {/* Badge */}
                  <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-lg shadow-sm border border-white/20">
                    <span className="text-[10px] font-extrabold text-gray-800 tracking-wide">{badge}</span>
                  </div>
                  {/* Selected Overlay */}
                  {isSelected && (
                    <div className="absolute inset-0 bg-amber-500/20 backdrop-blur-[1px] flex items-center justify-center animate-fade-in z-10">
                      <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg shadow-amber-500/30">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                      </div>
                    </div>
                  )}
                </div>

                {/* Content Section */}
                <div className="p-4 flex flex-col flex-1">
                  <h3 className="font-bold text-gray-900 text-[14px] sm:text-[15px] leading-snug line-clamp-2 min-h-[42px]">{u.name}</h3>
                  <p className="font-black text-amber-600 mt-1 mb-4 text-[15px]">{formatRupiah(u.price)}</p>
                  
                  <div className="mt-auto space-y-3">
                    <button 
                      onClick={() => toggleItem(u.id)}
                      className={`w-full font-bold py-3 rounded-xl text-[14px] transition-all active:scale-[0.98] flex items-center justify-center gap-1.5
                        ${isSelected 
                          ? 'bg-amber-50 text-amber-600 border border-amber-200' 
                          : 'bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-500/20'}`}
                    >
                      {isSelected ? 'Batal' : '+ Tambah'}
                    </button>

                    {/* Note and Upsells if Selected */}
                    {isSelected && (
                      <div className="pt-3 border-t border-amber-100/50 animate-fade-in space-y-3">
                        <input
                          type="text"
                          value={selectedItems[u.id]?.note || ''}
                          onChange={(e) => updateNote(u.id, e.target.value)}
                          placeholder="Catatan (opsional)"
                          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-[12px] text-gray-900 
                            placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500
                            transition-all"
                        />

                        {/* Upsells / Extras */}
                        {upsellItems.length > 0 && (
                          <div>
                            <h4 className="font-bold text-gray-900 text-[11px] mb-1.5 px-1 uppercase tracking-wider text-amber-600/80">Ekstra</h4>
                            <div className="space-y-1.5">
                              {upsellItems.filter(up => up.id !== u.id).map(up => {
                                const isUpsellSelected = !!selectedItems[u.id].upsells[up.id]
                                return (
                                  <div key={up.id} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-gray-100 shadow-sm">
                                    <div className="w-8 h-8 bg-gray-50 rounded-lg overflow-hidden relative flex-shrink-0">
                                      {up.image_url ? (
                                        <Image src={up.image_url} alt={up.name} fill className="object-cover" unoptimized/>
                                      ) : (
                                        <Sandwich className="w-4 h-4 m-auto mt-2 text-gray-300"/>
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h5 className="font-bold text-gray-900 text-[11px] leading-tight truncate">{up.name}</h5>
                                      <p className="font-bold text-amber-600 mt-0.5 text-[10px]">{formatRupiah(up.price)}</p>
                                    </div>
                                    <div className="flex-shrink-0">
                                      {isUpsellSelected ? (
                                        <button 
                                          onClick={() => toggleUpsell(u.id, up.id)}
                                          className="bg-amber-100 text-amber-700 font-bold px-2.5 py-1 rounded-lg text-[10px] transition-colors active:scale-95"
                                        >
                                          Batal
                                        </button>
                                      ) : (
                                        <button 
                                          onClick={() => toggleUpsell(u.id, up.id)}
                                          className="bg-gray-50 hover:bg-gray-100 text-gray-900 font-bold px-2.5 py-1 rounded-lg text-[10px] transition-colors active:scale-95"
                                        >
                                          +
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Fixed Bottom Actions */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 shadow-[0_-10px_30px_rgba(0,0,0,0.08)] px-4 py-4 pb-8 sm:pb-4 z-20">
        <div className="max-w-2xl mx-auto flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
          <button 
            onClick={handleNoThanks} 
            className="w-full sm:w-auto order-2 sm:order-1 px-4 py-3 bg-transparent text-gray-400 hover:text-gray-600 text-sm font-semibold transition-all active:scale-[0.98]"
          >
            Nggak, makasih
          </button>
          <button 
            onClick={handleContinue} 
            className="w-full sm:flex-1 order-1 sm:order-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-base py-4 rounded-2xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            Lanjut ke Pembayaran
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
