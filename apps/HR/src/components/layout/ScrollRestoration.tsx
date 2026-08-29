'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

const scrollPositions = new Map<string, number>()

export function ScrollRestoration({ selector = 'main' }: { selector?: string }) {
  const pathname = usePathname()
  const isNavigating = useRef(false)

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

  useEffect(() => {
    const el = document.querySelector(selector)
    if (el) {
      isNavigating.current = true
      const savedPosition = scrollPositions.get(pathname) ?? 0
      
      requestAnimationFrame(() => {
        el.scrollTop = savedPosition
        setTimeout(() => {
          isNavigating.current = false
        }, 50)
      })
    }
  }, [pathname, selector])

  return null
}
