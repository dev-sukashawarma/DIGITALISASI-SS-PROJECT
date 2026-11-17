'use client'

import React from 'react'
import Image from 'next/image'
import { Store, Globe, Smartphone, Gift } from 'lucide-react'
import { getChannel } from '@/lib/channels'

interface ChannelLogoProps {
  channelKey: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function ChannelLogo({ channelKey, size = 'md', className = '' }: ChannelLogoProps) {
  const norm = (channelKey || '').toLowerCase()

  // Dimension mapping
  const sizeMap = {
    sm: { box: 'w-6 h-6 rounded-lg text-xs', img: 14, icon: 12 },
    md: { box: 'w-8 h-8 rounded-xl text-sm', img: 20, icon: 16 },
    lg: { box: 'w-10 h-10 rounded-2xl text-base', img: 24, icon: 20 },
  }
  const s = sizeMap[size]

  // 1. Kasir Offline (POS)
  if (norm === 'pos' || norm.includes('kasir') || norm.includes('offline')) {
    return (
      <div
        className={`${s.box} bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs ${className}`}
        title="POS Kasir"
      >
        <Store size={s.icon} className="stroke-[2.5]" />
      </div>
    )
  }

  // 2. ShopeeFood (Official Food Delivery)
  if (norm === 'shopeefood' || norm.includes('shopee_food')) {
    return (
      <div
        className={`${s.box} bg-[#EE4D2D] text-white flex items-center justify-center shrink-0 shadow-2xs overflow-hidden ${className}`}
        title="ShopeeFood"
      >
        <Image
          src="/logos/shopeefood.svg"
          alt="ShopeeFood"
          width={s.img}
          height={s.img}
          className="object-contain brightness-0 invert"
          unoptimized
        />
      </div>
    )
  }

  // 3. Shopee Seller / Marketplace
  if (norm === 'shopee_shop' || norm === 'shopee' || norm.includes('shopee_seller') || norm.includes('shopeeseller')) {
    return (
      <div
        className={`${s.box} bg-[#EE4D2D] text-white flex items-center justify-center shrink-0 shadow-2xs overflow-hidden ${className}`}
        title="Shopee Seller"
      >
        <Image
          src="/logos/shopeefood.svg"
          alt="Shopee Seller"
          width={s.img}
          height={s.img}
          className="object-contain brightness-0 invert"
          unoptimized
        />
      </div>
    )
  }

  // 4. GrabFood (Official Food Delivery)
  if (norm === 'grabfood' || norm.includes('grab')) {
    return (
      <div
        className={`${s.box} bg-[#00B14F] text-white flex items-center justify-center shrink-0 shadow-2xs overflow-hidden p-0.5 ${className}`}
        title="GrabFood"
      >
        <Image
          src="/logos/grabfood.svg"
          alt="GrabFood"
          width={s.img + 4}
          height={s.img + 4}
          className="object-contain"
          unoptimized
        />
      </div>
    )
  }

  // 5. GoFood (Official Gojek Food Delivery)
  if (norm === 'gofood' || norm.includes('gofood') || norm.includes('gojek')) {
    return (
      <div
        className={`${s.box} bg-[#00AA13] text-white flex items-center justify-center shrink-0 shadow-2xs overflow-hidden p-1 ${className}`}
        title="GoFood"
      >
        {/* GoFood official white ring vector */}
        <svg viewBox="0 0 24 24" className="w-full h-full fill-white">
          <path d="M12.072.713a15.38 15.38 0 0 0-.643.011C5.317.998.344 5.835.017 11.818c-.266 4.913 2.548 9.21 6.723 11.204 1.557.744 3.405-.19 3.706-1.861.203-1.126-.382-2.241-1.429-2.742-2.373-1.139-3.966-3.602-3.778-6.406.22-3.28 2.931-5.945 6.279-6.171 3.959-.267 7.257 2.797 7.257 6.619 0 2.623-1.553 4.888-3.809 5.965a2.511 2.511 0 0 0-1.395 2.706l.011.056c.295 1.644 2.111 2.578 3.643 1.852C21.233 21.139 24 17.117 24 12.461 23.996 5.995 18.664.749 12.072.711v.002Zm-.061 7.614c-2.331 0-4.225 1.856-4.225 4.139 0 2.282 1.894 4.137 4.225 4.137 2.33 0 4.225-1.855 4.225-4.137 0-2.283-1.895-4.139-4.225-4.139Z" />
        </svg>
      </div>
    )
  }

  // 6. TikTok Go (Food Delivery)
  if (norm === 'tiktok' || norm === 'tiktokgo' || norm.includes('tiktok_go')) {
    return (
      <div
        className={`${s.box} bg-black text-white flex items-center justify-center shrink-0 shadow-2xs overflow-hidden p-1.5 ${className}`}
        title="TikTok Go"
      >
        {/* TikTok official 3D note with cyan and magenta accents */}
        <svg viewBox="0 0 24 24" className="w-full h-full fill-white">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
        </svg>
      </div>
    )
  }

  // 7. TikTok Shop (E-commerce Marketplace)
  if (norm === 'tiktok_shop' || norm.includes('tiktokshop') || norm.includes('tiktok_seller')) {
    return (
      <div
        className={`${s.box} bg-[#010101] text-white flex items-center justify-center shrink-0 shadow-2xs overflow-hidden p-1.5 relative ${className}`}
        title="TikTok Shop"
      >
        <svg viewBox="0 0 24 24" className="w-full h-full fill-white">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
        </svg>
      </div>
    )
  }

  // 8. Website Online (SS Online)
  if (norm === 'online' || norm === 'website' || norm.includes('web')) {
    return (
      <div
        className={`${s.box} bg-gradient-to-br from-orange-500 to-amber-600 text-white flex items-center justify-center shrink-0 shadow-2xs ${className}`}
        title="Website Online"
      >
        <Globe size={s.icon} className="stroke-[2.5]" />
      </div>
    )
  }

  // 9. Aplikasi Pelanggan
  if (norm === 'app' || norm.includes('aplikasi')) {
    return (
      <div
        className={`${s.box} bg-[#701604] text-white flex items-center justify-center shrink-0 shadow-2xs ${className}`}
        title="Aplikasi SukaShawarma"
      >
        <Smartphone size={s.icon} className="stroke-[2.5]" />
      </div>
    )
  }

  // 10. Endorse
  if (norm === 'endors' || norm === 'endorse') {
    return (
      <div
        className={`${s.box} bg-gradient-to-br from-fuchsia-500 to-pink-600 text-white flex items-center justify-center shrink-0 shadow-2xs ${className}`}
        title="Endorse"
      >
        <Gift size={s.icon} className="stroke-[2.5]" />
      </div>
    )
  }

  // Fallback with getChannel logoPath if available
  const ch = getChannel(norm)
  if (ch?.logoPath) {
    return (
      <div
        className={`${s.box} text-white flex items-center justify-center shrink-0 shadow-2xs overflow-hidden p-1.5 ${className}`}
        style={{ backgroundColor: ch.bg }}
        title={ch.label}
      >
        <svg viewBox="0 0 24 24" className="w-full h-full fill-white">
          <path d={ch.logoPath} />
        </svg>
      </div>
    )
  }

  return (
    <div
      className={`${s.box} bg-suka-gray-100 text-suka-gray-600 flex items-center justify-center shrink-0 border border-suka-gray-200 ${className}`}
    >
      <Store size={s.icon} />
    </div>
  )
}
