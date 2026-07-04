'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useSwipeable } from 'react-swipeable'
import { useRole } from './RoleContext'
import { accessibleItems, isItemActive } from './navConfig'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function SwipeableLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { role } = useRole()
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Track if we're currently swiping so we can show the peek background
  const [peekDirection, setPeekDirection] = useState<'Left' | 'Right' | null>(null)
  const isIgnoringSwipe = useRef(false)

  const items = accessibleItems(role)
  const inline = items.slice(0, 4)
  const currentIndex = inline.findIndex((item) => isItemActive(item.href, pathname))
  const prevTab = currentIndex > 0 ? inline[currentIndex - 1] : null
  const nextTab = currentIndex >= 0 && currentIndex < inline.length - 1 ? inline[currentIndex + 1] : null

  // Aggressive prefetching for adjacent tabs for zero-lag swipe transitions
  useEffect(() => {
    inline.forEach((item) => {
      router.prefetch(item.href)
    })
  }, [inline, router])

  // Reset transform when pathname changes (navigation completed)
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.transition = 'none'
      containerRef.current.style.transform = 'translateX(0px)'
    }
    setPeekDirection(null)
  }, [pathname])

  const isValidSwipeStart = (e: any) => {
    const target = e.target as HTMLElement
    // Ignore swipes from horizontally scrollable tables/containers
    if (target.closest('.overflow-x-auto') || target.closest('[data-no-swipe]')) return false
    return true
  }

  const handlers = useSwipeable({
    onSwipeStart: (eventData) => {
      if (!isValidSwipeStart(eventData.event)) {
        isIgnoringSwipe.current = true
        return
      }
      isIgnoringSwipe.current = false
      if (containerRef.current) {
        containerRef.current.style.transition = 'none'
      }
    },
    onSwiping: (eventData) => {
      if (isIgnoringSwipe.current || !containerRef.current) return

      // eventData.dir is "Left" or "Right"
      let moveX = eventData.dir === 'Left' ? -eventData.absX : eventData.dir === 'Right' ? eventData.absX : 0
      
      // Apply resistance if swiping past the ends
      if ((moveX < 0 && !nextTab) || (moveX > 0 && !prevTab)) {
        moveX = moveX / 4 // resistance
      }

      setPeekDirection(moveX < 0 ? 'Left' : moveX > 0 ? 'Right' : null)
      containerRef.current.style.transform = `translateX(${moveX}px)`
    },
    onSwiped: (eventData) => {
      if (isIgnoringSwipe.current || !containerRef.current) return
      
      const threshold = 100 // px required to trigger navigation
      const passedThreshold = eventData.absX > threshold
      
      if (passedThreshold && eventData.dir === 'Left' && nextTab) {
        // Animate out to the left
        containerRef.current.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
        containerRef.current.style.transform = 'translateX(-100vw)'
        router.push(nextTab.href)
      } else if (passedThreshold && eventData.dir === 'Right' && prevTab) {
        // Animate out to the right
        containerRef.current.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
        containerRef.current.style.transform = 'translateX(100vw)'
        router.push(prevTab.href)
      } else {
        // Snap back
        containerRef.current.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
        containerRef.current.style.transform = 'translateX(0px)'
        setTimeout(() => {
          setPeekDirection(null)
        }, 250) // wait for animation
      }
    },
    delta: 10, // start detecting early for smooth 1:1 tracking
    trackMouse: false,
  })

  return (
    <div {...handlers} className="flex-1 flex flex-col h-full w-full relative touch-pan-y overflow-hidden">
      {/* Peek Background (Underneath) */}
      <div className="absolute inset-0 z-0 bg-suka-cream/60 flex items-center justify-between px-8 pointer-events-none">
        {/* Left Peek (Shows Previous Tab) */}
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
        
        {/* Right Peek (Shows Next Tab) */}
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

      {/* Main Content (On Top) */}
      <div 
        ref={containerRef} 
        className="flex-1 flex flex-col h-full w-full bg-suka-cream z-10 will-change-transform shadow-[0_0_30px_rgba(0,0,0,0.08)]"
      >
        {children}
      </div>
    </div>
  )
}
