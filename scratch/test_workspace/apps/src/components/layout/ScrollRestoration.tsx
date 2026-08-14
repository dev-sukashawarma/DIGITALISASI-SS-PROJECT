'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

// Global map to store scroll positions across navigations
const scrollPositions = new Map<string, number>()

/**
 * Restores scroll position for a specific DOM element across client-side navigations.
 * This is needed when Next.js's native scroll restoration cannot target nested overflow elements.
 */
export function ScrollRestoration({ selector = 'main' }: { selector?: string }) {
  const pathname = usePathname()
  const isNavigating = useRef(false)

  // Save scroll position on scroll events
  useEffect(() => {
    const el = document.querySelector(selector)
    if (!el) return

    const handleScroll = () => {
      if (!isNavigating.current) {
        scrollPositions.set(pathname, el.scrollTop)
      }
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [pathname, selector])

  // Restore scroll position when pathname changes
  useEffect(() => {
    const el = document.querySelector(selector)
    if (el) {
      isNavigating.current = true
      const savedPosition = scrollPositions.get(pathname) ?? 0
      
      // Wait for next frame so DOM changes are flushed
      requestAnimationFrame(() => {
        el.scrollTop = savedPosition
        
        // Allow a small delay before we start recording new scrolls
        // to prevent capturing mid-render 0 values
        setTimeout(() => {
          isNavigating.current = false
        }, 50)
      })
    }
  }, [pathname, selector])

  return null
}
