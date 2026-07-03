'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useSwipeable } from 'react-swipeable'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type NavItem = { href: string; label: string; icon?: React.ReactNode };

interface SwipeableContainerProps {
  children: React.ReactNode;
  navItems: NavItem[];
}

export function SwipeableContainer({ children, navItems }: SwipeableContainerProps) {
  const router = useRouter()
  const pathname = usePathname()
  const containerRef = useRef<HTMLDivElement>(null)
  
  const [peekDirection, setPeekDirection] = useState<'Left' | 'Right' | null>(null)
  const isIgnoringSwipe = useRef(false)

  // Active resolution matching layout.tsx logic
  const isActive = (href: string, currentPath: string) =>
    currentPath === href || (href !== "/dashboard" && currentPath.startsWith(href + "/"));

  const currentIndex = navItems.findIndex((item) => isActive(item.href, pathname))
  const prevTab = currentIndex > 0 ? navItems[currentIndex - 1] : null
  const nextTab = currentIndex >= 0 && currentIndex < navItems.length - 1 ? navItems[currentIndex + 1] : null

  useEffect(() => {
    navItems.forEach((item) => {
      router.prefetch(item.href)
    })
  }, [navItems, router])

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.transition = 'none'
      containerRef.current.style.transform = 'translateX(0px)'
    }
    setPeekDirection(null)
  }, [pathname])

  const isValidSwipeStart = (e: Event) => {
    const target = e.target as HTMLElement
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

      let moveX = eventData.dir === 'Left' ? -eventData.absX : eventData.dir === 'Right' ? eventData.absX : 0
      
      if ((moveX < 0 && !nextTab) || (moveX > 0 && !prevTab)) {
        moveX = moveX / 4 // resistance
      }

      setPeekDirection(moveX < 0 ? 'Left' : moveX > 0 ? 'Right' : null)
      containerRef.current.style.transform = `translateX(${moveX}px)`
    },
    onSwiped: (eventData) => {
      if (isIgnoringSwipe.current || !containerRef.current) return
      
      const threshold = 100
      const passedThreshold = eventData.absX > threshold
      
      if (passedThreshold && eventData.dir === 'Left' && nextTab) {
        containerRef.current.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
        containerRef.current.style.transform = 'translateX(-100vw)'
        router.push(nextTab.href)
      } else if (passedThreshold && eventData.dir === 'Right' && prevTab) {
        containerRef.current.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
        containerRef.current.style.transform = 'translateX(100vw)'
        router.push(prevTab.href)
      } else {
        containerRef.current.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
        containerRef.current.style.transform = 'translateX(0px)'
        setTimeout(() => {
          setPeekDirection(null)
        }, 250)
      }
    },
    delta: 10,
    trackMouse: false,
  })

  // Only apply touch-pan-y on mobile so we don't mess up desktop
  return (
    <div {...handlers} className="flex-1 flex flex-col min-w-0 h-full w-full relative overflow-hidden lg:overflow-auto">
      {/* Peek Background (Underneath) - Only visible on mobile/touch */}
      <div className="absolute inset-0 z-0 bg-slate-50 flex items-center justify-between px-8 pointer-events-none lg:hidden">
        <div className={`flex flex-col items-start gap-2 transition-opacity duration-200 ${peekDirection === 'Right' ? 'opacity-100' : 'opacity-0'}`}>
          {prevTab && (
            <>
              <div className="w-12 h-12 rounded-2xl bg-suka-orange/10 flex items-center justify-center text-suka-orange">
                <ChevronLeft size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Kembali</p>
                <p className="text-lg font-extrabold text-suka-ink">{prevTab.label}</p>
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
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Menuju</p>
                <p className="text-lg font-extrabold text-suka-ink">{nextTab.label}</p>
              </div>
            </>
          )}
        </div>
      </div>

      <div 
        ref={containerRef} 
        className="flex-1 flex flex-col min-w-0 h-full w-full bg-slate-50 z-10 will-change-transform shadow-[0_0_30px_rgba(0,0,0,0.05)] lg:shadow-none lg:transform-none"
      >
        {children}
      </div>
    </div>
  )
}
