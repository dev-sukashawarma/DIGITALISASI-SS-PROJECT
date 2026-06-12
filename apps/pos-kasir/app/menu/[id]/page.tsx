'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Plus, Minus, Sandwich, ShoppingCart, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCart } from '@/store/cart'
import { formatRupiah } from '@/lib/validations'
import RecommendationStrip from '@/components/RecommendationStrip'
import type { MenuItem } from '@/types'

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = String(params.id)
  const { addItem } = useCart()

  const [item, setItem] = useState<MenuItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')

  // Upsell states
  const [upsellItems, setUpsellItems] = useState<MenuItem[]>([])
  const [selectedUpsells, setSelectedUpsells] = useState<Record<string, number>>({})

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/login'
        return
      }
      
      const { data: profile } = await supabase.from('profiles').select('outlet_id').eq('id', user.id).single()
      const currentOutletId = profile?.outlet_id || '11111111-1111-1111-1111-111111111111'

      // Fetch main item
      const { data: mainItem } = await supabase
        .from('menu_items')
        .select('*, categories(id,name,sort_order)')
        .eq('id', id)
        .single()
        
      if (!mainItem) {
        setLoading(false)
        return
      }

      // Fetch settings
      const { data: settings } = await supabase
        .from('kiosk_settings')
        .select('key, value')
        .eq('outlet_id', currentOutletId)
        .in('key', ['upsell_ids', 'unavailable_menu_ids'])

      let unavIds: string[] = []
      let upIds: string[] = []
      
      settings?.forEach(s => {
        if (s.key === 'unavailable_menu_ids' && s.value) {
          try { unavIds = JSON.parse(s.value) } catch {}
        }
        if (s.key === 'upsell_ids' && s.value) {
          try { upIds = JSON.parse(s.value) } catch {}
        }
      })

      // Apply availability override
      const isGlobal = mainItem.outlet_id === null
      if (isGlobal && unavIds.includes(mainItem.id)) {
        mainItem.is_available = false
      }
      
      setItem(mainItem as MenuItem)
      
      // Fetch upsells
      if (upIds.length > 0) {
        const { data: uItems } = await supabase
          .from('menu_items')
          .select('*')
          .in('id', upIds)
          .eq('is_available', true)
        
        // Don't show main item, and apply override to upsells too
        const filteredUpsells = (uItems || []).filter(u => {
          if (u.id === id) return false
          if (u.outlet_id === null && unavIds.includes(u.id)) return false
          return true
        })
        setUpsellItems(filteredUpsells)
      }

      setLoading(false)
    }

    fetchData()
  }, [id])

  function handleAdd() {
    if (!item) return
    
    // 1. Add main item
    const parentId = addItem(item, qty, note.trim())
    
    // 2. Add upsell items
    Object.entries(selectedUpsells).forEach(([uId, uQty]) => {
      if (uQty > 0) {
        const uItem = upsellItems.find(u => u.id === uId)
        if (uItem) addItem(uItem, uQty, '', parentId)
      }
    })
    
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFFBF5]">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    )
  }

  if (!item) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 px-4">
        <p className="text-gray-500 font-medium">Produk tidak ditemukan</p>
        <Link href="/" className="btn-primary">Kembali ke Menu</Link>
      </div>
    )
  }

  const showPlaceholder = !item.image_url

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)]">
        <div className="max-w-[800px] mx-auto px-5 py-4 flex items-center gap-4">
          <Link href="/" className="w-10 h-10 bg-white border border-gray-200 shadow-sm hover:bg-gray-50 rounded-full flex items-center justify-center transition-all active:scale-95">
            <ArrowLeft className="w-5 h-5 text-gray-700" strokeWidth={2.5} />
          </Link>
          <h1 className="font-extrabold text-gray-900 text-lg leading-none truncate">{item.name}</h1>
        </div>
      </div>

      <div className="max-w-[800px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Image */}
        <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-white shadow-card border border-gray-100">
          {!showPlaceholder ? (
            <Image src={item.image_url!} alt={item.name} fill className="object-cover" unoptimized />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Sandwich className="w-20 h-20 text-amber-200" strokeWidth={1} />
            </div>
          )}
          {!item.is_available && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center">
              <span className="bg-white text-gray-600 text-sm font-semibold px-5 py-2 rounded-full tracking-wide uppercase border border-gray-200">Habis</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-3 bg-white p-6 rounded-2xl shadow-card border border-gray-100">
          <div>
            {item.categories?.name && (
              <span className="inline-block text-[10px] font-semibold uppercase tracking-widest bg-gray-100 text-gray-500 px-3 py-1.5 rounded-lg mb-3">
                {item.categories.name}
              </span>
            )}
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight leading-tight">{item.name}</h2>
            {item.description && <p className="text-gray-500 text-[15px] leading-relaxed mt-2">{item.description}</p>}
          </div>
          <div className="pt-3 border-t border-gray-100">
            <p className="text-3xl font-bold text-amber-600 tracking-tight">{formatRupiah(item.price)}</p>
          </div>
        </div>

        {/* Note input */}
        {item.is_available && (
          <div className="space-y-2.5">
            <label htmlFor="note" className="block text-[15px] font-bold text-gray-900 px-1">
              Catatan Khusus (Opsional)
            </label>
            <textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contoh: Tanpa bawang, pedas sedang..."
              className="w-full bg-white border border-gray-200 rounded-xl px-5 py-4 text-[15px] text-gray-900
                placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400
                resize-none h-28 transition-all"
            />
          </div>
        )}

        {/* Add-ons List (Inline) */}
        {upsellItems.length > 0 && (
          <div className="pt-2">
            <h3 className="font-extrabold text-gray-900 text-lg mb-3 px-1">Extra</h3>
            <div className="space-y-2">
              {upsellItems.map(u => (
                <div key={u.id} className="flex items-center gap-4 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="w-14 h-14 bg-gray-50 rounded-[1rem] overflow-hidden relative flex-shrink-0">
                    {u.image_url ? (
                      <Image src={u.image_url} alt={u.name} fill className="object-cover" unoptimized/>
                    ) : (
                      <Sandwich className="w-6 h-6 m-auto mt-4 text-gray-300"/>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 text-[15px] leading-tight truncate">{u.name}</h3>
                    <p className="font-extrabold text-amber-600 mt-0.5 text-sm">{formatRupiah(u.price)}</p>
                  </div>
                  <div className="flex items-center flex-shrink-0">
                    {selectedUpsells[u.id] ? (
                      <button 
                        onClick={() => setSelectedUpsells(p => { const newP = {...p}; delete newP[u.id]; return newP; })} 
                        className="bg-amber-100 text-amber-700 font-bold px-4 py-2 rounded-full text-[13px] transition-colors active:scale-95"
                      >
                        Batal
                      </button>
                    ) : (
                      <button 
                        onClick={() => setSelectedUpsells(p => ({...p, [u.id]: 1}))} 
                        className="bg-gray-50 hover:bg-gray-100 text-gray-900 font-bold px-4 py-2 rounded-full text-[13px] transition-colors active:scale-95"
                      >
                        Tambah
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Qty + Add */}
        {item.is_available && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between sm:justify-start gap-3 bg-white border border-gray-200 shadow-sm rounded-full p-2">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="w-12 h-12 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-full flex items-center justify-center transition-all active:scale-95"
                aria-label="Kurangi"
              >
                <Minus className="w-5 h-5" strokeWidth={2.5} />
              </button>
              <span className="w-12 text-center font-black text-gray-900 text-xl tabular-nums">{qty}</span>
              <button
                onClick={() => setQty((q) => Math.min(10, q + 1))}
                disabled={qty >= 10}
                className="w-12 h-12 bg-amber-500 text-white shadow-md shadow-amber-500/20 rounded-full flex items-center justify-center transition-all hover:bg-amber-600 active:scale-95 disabled:opacity-30"
                aria-label="Tambah"
              >
                <Plus className="w-5 h-5" strokeWidth={2.5} />
              </button>
            </div>
            <button onClick={handleAdd} className="btn-primary flex-1 py-4 sm:py-0 h-16 text-lg">
              <ShoppingCart className="w-6 h-6" strokeWidth={2.5} />
              Tambah ke Keranjang
            </button>
          </div>
        )}
      </div>

    </div>
  )
}
