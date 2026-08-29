'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { ALL_NAV_ITEMS, isItemActive } from './navConfig'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function SwipeableLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const containerRef = useRef<HTMLDivElement>(null)
  
  const [peekDirection, setPeekDirection] = useState<'Left' | 'Right' | null>(null)
  const inline = ALL_NAV_ITEMS.slice(0, 4)
  const currentIndex = inline.findIndex((item) => isItemActive(item.href, pathname))
  const prevTab = currentIndex > 0 ? inline[currentIndex - 1] : null
  const nextTab = currentIndex >= 0 && currentIndex < inline.length - 1 ? inline[currentIndex + 1] : null

  useEffect(() => {
    inline.forEach((item) => {
      router.prefetch(item.href)
    })
  }, [inline, router])

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.transition = 'none'
      containerRef.current.style.transform = 'translateX(0px)'
    }
    setPeekDirection(null)
  }, [pathname])

  return (
    <div className="flex-1 min-w-0 flex flex-col h-full w-full relative touch-pan-y overflow-hidden">
      {/* Peek Background */}
      <div className="absolute inset-0 z-0 bg-[#FDF9F3] flex items-center justify-between px-8 pointer-events-none">
        <div className={`flex flex-col items-start gap-2 transition-opacity duration-200 ${peekDirection === 'Right' ? 'opacity-100' : 'opacity-0'}`}>
          {prevTab && (
            <>
              <div className="w-12 h-12 rounded-2xl bg-suka-orange/10 flex items-center justify-center text-suka-orange">
                <ChevronLeft size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-suka-gray-400 uppercase tracking-wider">Kembali</p>
                <p className="text-lg font-extrabold text-suka-brown">{prevTab.shortLabel || prevTab.label}</p>
              </div>
            </>
          )}
        </div>
        
        <div className={`flex flex-col items-end gap-2 transition-opacity duration-200 ${peekDirection === 'Left' ? 'opacity-100' : 'opacity-0'}`}>
          {nextTab && (
            <>
              <div className="w-12 h-12 rounded-2xl bg-suka-orange/10 flex items-center justify-center text-suka-orange">
                <ChevronRight size={24} />
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-suka-gray-400 uppercase tracking-wider">Menuju</p>
                <p className="text-lg font-extrabold text-suka-brown">{nextTab.shortLabel || nextTab.label}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div 
        ref={containerRef} 
        className="flex-1 min-w-0 flex flex-col h-full w-full bg-[#FDF9F3] z-10 will-change-transform shadow-[0_0_30px_rgba(0,0,0,0.08)]"
      >
        {children}
      </div>
    </div>
  )
}
