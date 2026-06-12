'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Plus, Minus, Sandwich } from 'lucide-react'
import type { MenuItem as MenuItemType } from '@/types'
import { useCart } from '@/store/cart'
import { formatRupiah } from '@/lib/validations'

interface Props {
  item: MenuItemType
}

export default function MenuItem({ item }: Props) {
  const { items, addItem, updateQuantity } = useCart()
  const router = useRouter()
  const [imgError, setImgError] = useState(false)
  
  const itemCartItems = items.filter((i) => i.item.id === item.id)
  const totalQuantity = itemCartItems.reduce((acc, curr) => acc + curr.quantity, 0)

  const showPlaceholder = !item.image_url || imgError

  return (
    <div
      onClick={() => router.push(`/menu/${item.id}`)}
      className={`group bg-white rounded-2xl overflow-hidden border border-gray-100
        shadow-card hover:shadow-card-hover hover:-translate-y-0.5
        transition-all duration-200 flex flex-col cursor-pointer
        ${!item.is_available ? 'opacity-55 !cursor-not-allowed' : ''}`}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] bg-amber-50/60 overflow-hidden flex-shrink-0">
        {!showPlaceholder ? (
          <Image
            src={item.image_url!}
            alt={item.name}
            fill
            className="object-cover group-hover:scale-[1.03] transition-transform duration-300"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Sandwich className="w-14 h-14 text-amber-200" strokeWidth={1} />
          </div>
        )}

        {/* "Habis" overlay */}
        {!item.is_available && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center">
            <span className="bg-white text-gray-600 text-[11px] font-semibold px-3 py-1 rounded-full tracking-wide uppercase border border-gray-200">
              Habis
            </span>
          </div>
        )}

        {/* Quantity badge (when in cart) */}
        {totalQuantity > 0 && (
          <div className="absolute top-2.5 right-2.5 min-w-6 h-6 px-1.5 bg-amber-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-sm animate-scale-in">
            {totalQuantity}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3.5 sm:p-4 flex flex-col flex-1">
        <h3 className="font-semibold text-gray-900 text-sm sm:text-[15px] leading-snug line-clamp-2">
          {item.name}
        </h3>
        {item.description && (
          <p className="text-gray-400 text-xs mt-1 line-clamp-2 leading-relaxed flex-1">
            {item.description}
          </p>
        )}

        {/* Price */}
        <div className="mt-3 flex items-center justify-between">
          <span className="font-bold text-amber-600 text-base tracking-tight leading-none">
            {formatRupiah(item.price)}
          </span>
        </div>
      </div>
    </div>
  )
}
