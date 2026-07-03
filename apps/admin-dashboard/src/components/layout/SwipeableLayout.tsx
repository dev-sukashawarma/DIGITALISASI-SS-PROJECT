'use client'

import React, { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useSwipeable } from 'react-swipeable'
import { useRole } from './RoleContext'
import { accessibleItems, isItemActive } from './navConfig'

export function SwipeableLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { role } = useRole()

  const items = accessibleItems(role)
  const inline = items.slice(0, 4)

  // Aggressive prefetching for adjacent tabs for zero-lag swipe transitions
  useEffect(() => {
    inline.forEach((item) => {
      router.prefetch(item.href)
    })
  }, [inline, router])

  const handlers = useSwipeable({
    onSwipedLeft: (eventData) => {
      // Ignore swipes that originated from horizontally scrollable elements like tables
      const target = eventData.event.target as HTMLElement
      if (target.closest('.overflow-x-auto') || target.closest('[data-no-swipe]')) return
      
      const currentIndex = inline.findIndex((item) => isItemActive(item.href, pathname))
      if (currentIndex >= 0 && currentIndex < inline.length - 1) {
        router.push(inline[currentIndex + 1].href)
      }
    },
    onSwipedRight: (eventData) => {
      const target = eventData.event.target as HTMLElement
      if (target.closest('.overflow-x-auto') || target.closest('[data-no-swipe]')) return
      
      const currentIndex = inline.findIndex((item) => isItemActive(item.href, pathname))
      if (currentIndex > 0) {
        router.push(inline[currentIndex - 1].href)
      }
    },
    delta: 50, // Require a deliberate swipe distance
    trackMouse: false, // Mobile focus
  })

  return (
    <div {...handlers} className="flex-1 flex flex-col h-full w-full relative touch-pan-y">
      {children}
    </div>
  )
}
