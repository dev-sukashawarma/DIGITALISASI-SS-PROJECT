'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Plus, Minus, Sandwich, ShoppingCart } from 'lucide-react'
import { useCart } from '@/store/cart'
import { formatRupiah } from '@/lib/validations'
import { usePromos } from '@/lib/usePromos'
import type { MenuItem } from '@/types'

export default function ProductDetailClient({
  item,
  upsellItems,
  outletId,
}: {
  item: MenuItem
  upsellItems: MenuItem[]
  packageOptionItems?: MenuItem[]
  outletId?: string
}) {
  const router = useRouter()
  const { addItem, items } = useCart()

  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')
  const [selectedUpsells, setSelectedUpsells] = useState<Record<string, number>>({})
  const [selectedPackageChoices, setSelectedPackageChoices] = useState<Record<string, string>>({})

  function handleAdd() {
    // 1. Prepare final note with package choices
    let finalNote = note.trim()
    if (item.is_package && item.package_items && packageOptionItems) {
      const choicesText = Object.entries(selectedPackageChoices).map(([piId, itemId]) => {
        const pItem = packageOptionItems.find(i => i.id === itemId)
        return pItem ? pItem.name : ''
      }).filter(Boolean).join(', ')
      
      if (choicesText) {
        finalNote = finalNote ? `${finalNote} (Paket: ${choicesText})` : `Paket: ${choicesText}`
      }
    }

    // 2. Add main item
    const parentId = addItem(item, qty, finalNote, undefined, selectedPackageChoices)

    // 2. Add upsell items
    Object.entries(selectedUpsells).forEach(([uId, uQty]) => {
      if (uQty > 0) {
        const uItem = upsellItems.find(u => u.id === uId)
        if (uItem) addItem(uItem, uQty, '', parentId)
      }
    })

    router.push('/')
  }

  const { calculateItemPrice, getPromoForMenu } = usePromos(outletId)

  const cartBaseSubtotal = items.reduce((acc, curr) => acc + curr.item.price * curr.quantity, 0)
  const finalPrice = calculateItemPrice(item.price, item.id, cartBaseSubtotal)
  const isDiscountActiveNow = finalPrice < item.price

  const applicablePromo = getPromoForMenu(item.id)
  const hasPotentialPromo = applicablePromo != null
  const needsMinPurchase = hasPotentialPromo && (applicablePromo!.min_purchase || 0) > 0
  
  const hasUsageLimit = hasPotentialPromo && (applicablePromo!.usage_limit || 0) > 0
  const remainingUsage = hasUsageLimit ? (applicablePromo!.usage_limit || 0) - (applicablePromo!.current_usage || 0) : null

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
            <Image src={item.image_url!} alt={item.name} fill className="object-cover" priority unoptimized />
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
          <div className="pt-3 border-t border-gray-100 flex flex-col justify-end">
            {isDiscountActiveNow ? (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex gap-2 items-center flex-wrap">
                    <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
                      PROMO
                    </span>
                    {hasUsageLimit && remainingUsage && remainingUsage > 0 && (
                      <span className="bg-red-50 text-red-600 border border-red-200 text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
                        Sisa Kuota: {remainingUsage}
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-gray-400 line-through">
                    {formatRupiah(item.price)}
                  </span>
                </div>
                <p className="text-3xl font-bold text-red-600 tracking-tight">{formatRupiah(finalPrice)}</p>
              </>
            ) : (
              <>
                <p className="text-3xl font-bold text-amber-600 tracking-tight mb-1.5">{formatRupiah(item.price)}</p>
                {needsMinPurchase && (
                  <span className="text-[12px] text-amber-700 font-bold bg-amber-50 inline-block px-2.5 py-1 rounded-md leading-none w-fit border border-amber-100">
                    Ada Diskon {applicablePromo!.discount_type === 'percentage' ? `${applicablePromo!.discount_value}%` : formatRupiah(applicablePromo!.discount_value).replace('Rp ', '')} 
                    {applicablePromo!.min_purchase! > 0 ? ` (Min. Belanja ${formatRupiah(applicablePromo!.min_purchase!)})` : ''}
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Package Choices */}
        {item.is_package && item.package_items && item.package_items.length > 0 && item.package_items.some(pi => pi.or_menu_item_id) && packageOptionItems && (
          <div className="space-y-4">
            <h3 className="text-[15px] font-bold text-gray-900 px-1 flex items-center gap-2">
              <Sandwich className="w-5 h-5 text-amber-500" /> Pilihan Item Paket
            </h3>
            <div className="space-y-3 bg-white p-5 rounded-2xl shadow-card border border-gray-100">
              {item.package_items.filter(pi => pi.or_menu_item_id).map(pi => {
                const mainItem = packageOptionItems.find(i => i.id === pi.menu_item_id)
                const orItem = packageOptionItems.find(i => i.id === pi.or_menu_item_id)
                if (!mainItem || !orItem) return null
                
                const selected = selectedPackageChoices[pi.id] || pi.menu_item_id
                
                return (
                  <div key={pi.id} className="bg-gray-50 border border-amber-100/50 rounded-xl p-3.5">
                    <p className="text-xs font-bold text-gray-500 mb-2.5">Pilih salah satu:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setSelectedPackageChoices(prev => ({ ...prev, [pi.id]: mainItem.id }))}
                        className={`p-3 rounded-xl border text-sm font-bold text-center transition-all active:scale-[0.98] ${selected === mainItem.id ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-sm' : 'border-gray-200 bg-white text-gray-600 hover:border-amber-300'}`}
                      >
                        {mainItem.name}
                      </button>
                      <button
                        onClick={() => setSelectedPackageChoices(prev => ({ ...prev, [pi.id]: orItem.id }))}
                        className={`p-3 rounded-xl border text-sm font-bold text-center transition-all active:scale-[0.98] ${selected === orItem.id ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-sm' : 'border-gray-200 bg-white text-gray-600 hover:border-amber-300'}`}
                      >
                        {orItem.name}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

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
                <div 
                  key={u.id} 
                  className={`flex items-center gap-4 p-3 rounded-2xl border transition-all ${selectedUpsells[u.id] ? 'border-amber-400 bg-amber-50/50' : 'border-gray-100 bg-white shadow-sm cursor-pointer hover:border-amber-200'}`}
                  onClick={() => {
                    if (!selectedUpsells[u.id]) setSelectedUpsells(p => ({...p, [u.id]: 1}))
                  }}
                >
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
