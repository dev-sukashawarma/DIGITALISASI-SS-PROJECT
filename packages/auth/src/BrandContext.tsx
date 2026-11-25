'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from './supabase-client'

export interface BrandContextType {
  brandName: string
  brandLogo: string | null
  userBrandLogo: string | null
  loading: boolean
  refreshBrand: () => Promise<void>
}

const BrandContext = createContext<BrandContextType>({
  brandName: 'SHAWARMA',
  brandLogo: null,
  userBrandLogo: null,
  loading: true,
  refreshBrand: async () => {},
})

function normalizeLogoValue(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim().replace(/^"|"$/g, '')
  if (!trimmed || trimmed === 'null') return null
  return trimmed
}

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [brandName, setBrandName] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('suka_brand_name') || 'SHAWARMA'
    }
    return 'SHAWARMA'
  })
  const [brandLogo, setBrandLogo] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('suka_brand_logo') || null
    }
    return null
  })
  const [userBrandLogo, setUserBrandLogo] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('suka_user_brand_logo') || null
    }
    return null
  })
  const [loading, setLoading] = useState(true)

  const fetchBrand = async () => {
    try {
      const supabase = createSupabaseBrowserClient()
      const { data, error } = await supabase
        .from('global_settings')
        .select('key, value')
        .in('key', ['brand_name', 'brand_logo', 'user_brand_logo'])

      if (data && !error) {
        let hasBrandLogoRow = false
        let hasUserBrandLogoRow = false

        data.forEach((row: { key: string; value: any }) => {
          if (row.key === 'brand_name' && row.value) {
            const cleanName = typeof row.value === 'string' ? row.value.replace(/^"|"$/g, '') : String(row.value)
            setBrandName(cleanName)
            if (typeof window !== 'undefined') {
              localStorage.setItem('suka_brand_name', cleanName)
            }
          }
          if (row.key === 'brand_logo') {
            hasBrandLogoRow = true
            const logo = normalizeLogoValue(row.value)
            setBrandLogo(logo)
            if (typeof window !== 'undefined') {
              if (logo) localStorage.setItem('suka_brand_logo', logo)
              else localStorage.removeItem('suka_brand_logo')
            }
          }
          if (row.key === 'user_brand_logo') {
            hasUserBrandLogoRow = true
            const logo = normalizeLogoValue(row.value)
            setUserBrandLogo(logo)
            if (typeof window !== 'undefined') {
              if (logo) localStorage.setItem('suka_user_brand_logo', logo)
              else localStorage.removeItem('suka_user_brand_logo')
            }
          }
        })

        if (!hasBrandLogoRow) {
          setBrandLogo(null)
          if (typeof window !== 'undefined') localStorage.removeItem('suka_brand_logo')
        }
        if (!hasUserBrandLogoRow) {
          setUserBrandLogo(null)
          if (typeof window !== 'undefined') localStorage.removeItem('suka_user_brand_logo')
        }
      }
    } catch (e) {
      console.error('[BrandProvider] Failed to load brand settings', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBrand()

    let cleanup: (() => void) | undefined
    try {
      const supabase = createSupabaseBrowserClient()
      const channel = supabase
        .channel('public:global_settings_brand')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'global_settings' },
          (payload: any) => {
            const key = payload?.new?.key || payload?.old?.key
            if (key === 'brand_name' || key === 'brand_logo' || key === 'user_brand_logo') {
              fetchBrand()
            }
          }
        )
        .subscribe()

      cleanup = () => {
        supabase.removeChannel(channel)
      }
    } catch {}

    return () => {
      cleanup?.()
    }
  }, [])

  return (
    <BrandContext.Provider value={{ brandName, brandLogo, userBrandLogo, loading, refreshBrand: fetchBrand }}>
      {children}
    </BrandContext.Provider>
  )
}

export function useBrand() {
  return useContext(BrandContext)
}
