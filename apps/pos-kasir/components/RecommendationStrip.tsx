'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Plus, Sandwich } from 'lucide-react'
import type { MenuItem } from '@/types'
import { useCart } from '@/store/cart'
import { formatRupiah } from '@/lib/validations'

interface Props {
  /** Detail mode: recommend items bought together with this product. */
  productId?: string
  /** Cart mode: recommend items bought together with these cart item ids. */
  cartIds?: string[]
  title?: string
  limit?: number
  /** 'carousel' = horizontal cards (wide context). 'list' = stacked rows (narrow cart column). */
  variant?: 'carousel' | 'list'
}

export default function RecommendationStrip({ productId, cartIds, title = 'Sering dibeli bersama', limit = 4, variant = 'carousel' }: Props) {
  const [items, setItems] = useState<MenuItem[]>([])
  const { addItem, items: cartItems } = useCart()

  // Stable string key so a new array identity each render does not refetch in a loop.
  const cartKey = cartIds && cartIds.length ? cartIds.join(',') : ''

  useEffect(() => {
    if (!productId && !cartKey) { setItems([]); return }
    const params = new URLSearchParams()
    if (productId) params.set('productId', productId)
    if (cartKey) params.set('cart', cartKey)
    params.set('limit', String(limit))

    let active = true
    fetch(`/api/recommendations?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => { if (active) setItems(data.items ?? []) })
      .catch(() => { if (active) setItems([]) })
    return () => { active = false }
  }, [productId, cartKey, limit])

  // Hide items already in the cart (covers optimistic adds after fetch).
  const cartIdSet = new Set(cartItems.map((c) => c.item.id))
  const visible = items.filter((m) => !cartIdSet.has(m.id))

  if (visible.length === 0) return null

  // ── Compact stacked rows — tidy in a narrow cart column ──
  if (variant === 'list') {
    return (
      <div className="space-y-2">
        <h3 className="font-bold text-gray-700 text-xs uppercase tracking-wide">{title}</h3>
        <div className="space-y-2">
          {visible.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 bg-amber-50/50 rounded-2xl p-2 border border-amber-100/60"
            >
              <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-gradient-to-br from-amber-50 to-orange-100 flex-shrink-0">
                {item.image_url ? (
                  <Image src={item.image_url} alt={item.name} fill className="object-cover" unoptimized />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sandwich className="w-5 h-5 text-amber-200" strokeWidth={1.2} />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-900 leading-snug line-clamp-1">{item.name}</p>
                <span className="text-amber-600 font-bold text-xs">{formatRupiah(item.price)}</span>
              </div>
              <button
                onClick={() => addItem(item)}
                aria-label={`Tambah ${item.name}`}
                className="w-8 h-8 bg-amber-500 text-white rounded-full flex items-center justify-center shadow-sm hover:bg-amber-600 active:scale-95 transition-all flex-shrink-0"
              >
                <Plus className="w-4 h-4" strokeWidth={2.5} />
              </button>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Horizontal carousel — wide context (detail page) ──
  return (
    <div className="space-y-3">
      <h3 className="font-bold text-gray-900 text-sm">{title}</h3>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
        {visible.map((item) => (
          <div
            key={item.id}
            className="w-32 flex-shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
          >
            <div className="relative h-20 bg-gradient-to-br from-amber-50 to-orange-100">
              {item.image_url ? (
                <Image src={item.image_url} alt={item.name} fill className="object-cover" unoptimized />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sandwich className="w-8 h-8 text-amber-200" strokeWidth={1} />
                </div>
              )}
            </div>
            <div className="p-2.5">
              <p className="text-xs font-bold text-gray-900 leading-snug line-clamp-1">{item.name}</p>
              <div className="mt-1.5 flex items-center justify-between gap-1">
                <span className="text-amber-600 font-bold text-xs">{formatRupiah(item.price)}</span>
                <button
                  onClick={() => addItem(item)}
                  aria-label={`Tambah ${item.name}`}
                  className="w-7 h-7 bg-amber-500 text-white rounded-full flex items-center justify-center shadow-sm hover:bg-amber-600 active:scale-95 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
