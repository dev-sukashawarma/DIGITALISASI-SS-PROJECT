'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

interface BrandContextType {
  brandName: string
  brandLogo: string | null
  loading: boolean
  refreshBrand: () => Promise<void>
}

const BrandContext = createContext<BrandContextType>({
  brandName: 'SHAWARMA',
  brandLogo: null,
  loading: true,
  refreshBrand: async () => {},
})

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [brandName, setBrandName] = useState('SHAWARMA')
  const [brandLogo, setBrandLogo] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchBrand = async () => {
    try {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        if (data.brand_name) setBrandName(data.brand_name)
        if (data.brand_logo !== undefined) setBrandLogo(data.brand_logo)
      }
    } catch (e) {
      console.error('Failed to load brand settings', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBrand()
  }, [])

  return (
    <BrandContext.Provider value={{ brandName, brandLogo, loading, refreshBrand: fetchBrand }}>
      {children}
    </BrandContext.Provider>
  )
}

export function useBrand() {
  return useContext(BrandContext)
}
