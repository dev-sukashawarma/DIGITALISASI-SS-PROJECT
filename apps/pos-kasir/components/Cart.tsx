'use client'

import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ShoppingCart, Plus, Minus, Trash2, X, ArrowRight, Sandwich } from 'lucide-react'
import { useCart } from '@/store/cart'
import { formatRupiah } from '@/lib/validations'
import type { CartItem as CartItemType } from '@/types'

export default function Cart() {
  const router = useRouter()
  const { items, updateQuantity, removeItem, totalItems, totalPrice, closeCart } = useCart()
  const total = totalPrice()
  const count = totalItems()
  const rootItems = items.filter(i => !i.parentId)

  if (items.length === 0) {
    return (
      <div className="flex flex-col h-full flex-1 min-h-0">
        <CartHeader count={0} onClose={closeCart} />
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
          <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mb-4">
            <ShoppingCart className="w-9 h-9 text-amber-200" strokeWidth={1.5} />
          </div>
          <p className="font-semibold text-gray-700">Keranjang Kosong</p>
          <p className="text-gray-400 text-sm mt-1 leading-relaxed">
            Pilih menu favoritmu untuk mulai memesan
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full flex-1 min-h-0">
      <CartHeader count={count} onClose={closeCart} />

      {/* Items */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-1">
        {rootItems.map((root) => {
          const children = items.filter(i => i.parentId === root.cartItemId)
          return (
            <div key={root.cartItemId} className="py-3 border-b border-gray-50 last:border-0 flex flex-col gap-2 relative">
              {/* Vertical Line for Cart */}
              {children.length > 0 && (
                <div className="absolute left-[24px] top-12 bottom-6 w-[2px] bg-gray-200" />
              )}
              
              <div className="relative z-10">
                <CartItemRow 
                  itemData={root} 
                  updateQuantity={updateQuantity} 
                  removeItem={removeItem} 
                />
              </div>
              
              {children.length > 0 && (
                <div className="mt-1 space-y-2 relative">
                  {children.map(child => (
                    <div key={child.cartItemId} className="relative pl-[3.5rem]">
                      {/* L-Shape branch indicator */}
                      <div className="absolute left-[24px] top-[1.25rem] w-4 h-[2px] bg-gray-200" />
                      <CartItemRow 
                        itemData={child} 
                        updateQuantity={updateQuantity} 
                        removeItem={removeItem} 
                        isChild 
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-gray-100 px-5 pt-4 pb-5 space-y-4 bg-white">
        {/* Total breakdown */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-500">
            <span>{count} item</span>
            <span>{formatRupiah(total)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-bold text-gray-900">Total Pembayaran</span>
            <span className="font-extrabold text-xl text-amber-600">{formatRupiah(total)}</span>
          </div>
        </div>

        <button
          onClick={() => { closeCart(); router.push('/recommendations') }}
          className="btn-primary w-full py-3.5 text-base"
        >
          Pesan Sekarang
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function CartHeader({ count, onClose }: { count: number; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center">
          <ShoppingCart className="w-4 h-4 text-white" strokeWidth={2.5} />
        </div>
        <div>
          <h2 className="font-bold text-gray-900 leading-none">Pesananmu</h2>
          {count > 0 && (
            <p className="text-amber-600 text-xs font-semibold mt-0.5">{count} item dipilih</p>
          )}
        </div>
      </div>
      <button
        onClick={onClose}
        className="lg:hidden w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200
          flex items-center justify-center text-gray-500 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

function CartItemRow({ 
  itemData, 
  updateQuantity, 
  removeItem, 
  isChild = false 
}: { 
  itemData: CartItemType, 
  updateQuantity: (id: string, q: number) => void, 
  removeItem: (id: string) => void, 
  isChild?: boolean 
}) {
  const { cartItemId, item, quantity, note } = itemData
  
  return (
    <div className="group flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Thumbnail */}
          <div className={`relative rounded-xl overflow-hidden bg-gradient-to-br from-amber-50 to-orange-50 flex-shrink-0 border border-amber-100/50 ${isChild ? 'w-10 h-10' : 'w-12 h-12'}`}>
            {item.image_url ? (
              <Image
                src={item.image_url}
                alt={item.name}
                fill
                className="object-cover"
                sizes={isChild ? "40px" : "48px"}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Sandwich className="w-5 h-5 text-amber-200" strokeWidth={1.5} />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className={`font-semibold text-gray-900 leading-tight truncate ${isChild ? 'text-[13px]' : 'text-sm'}`}>
              {item.name}
            </p>
            <p className={`text-amber-600 font-semibold mt-0.5 ${isChild ? 'text-[11px]' : 'text-xs'}`}>
              {formatRupiah(item.price)}
            </p>
            {note && (
              <p className="text-gray-500 text-xs mt-1 italic line-clamp-2">
                Note: {note}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0 mt-2 sm:mt-0">
          {!isChild && (
            <>
              <button
                onClick={() => updateQuantity(cartItemId, quantity - 1)}
                className="w-7 h-7 bg-gray-50 hover:bg-gray-100 text-gray-500
                  rounded-full flex items-center justify-center transition-colors active:scale-95"
              >
                <Minus className="w-3.5 h-3.5" strokeWidth={2.5} />
              </button>
              <span className="w-6 text-center font-bold text-gray-900 text-[15px] tabular-nums">
                {quantity}
              </span>
              <button
                onClick={() => updateQuantity(cartItemId, quantity + 1)}
                disabled={quantity >= 10}
                className="w-7 h-7 bg-amber-500 text-white hover:bg-amber-600
                  rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-30 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
              </button>
            </>
          )}
          <button
            onClick={() => removeItem(cartItemId)}
            className="w-7 h-7 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-full
              flex items-center justify-center transition-colors ml-1 active:scale-95"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
