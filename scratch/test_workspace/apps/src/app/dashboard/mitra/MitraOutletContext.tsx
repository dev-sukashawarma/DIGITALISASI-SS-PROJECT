'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

type MitraOutletContextType = {
  outlets: any[]
  profile: any
  selectedOutletId: string | null
  setSelectedOutletId: (id: string) => void
  selectedOutlet: any | null
}

const MitraOutletContext = createContext<MitraOutletContextType | undefined>(undefined)

export function MitraOutletProvider({ 
  children, 
  outlets, 
  profile 
}: { 
  children: React.ReactNode
  outlets: any[]
  profile: any
}) {
  const [selectedOutletId, setSelectedOutletId] = useState<string | null>(
    outlets.length > 0 ? outlets[0].id : null
  )

  useEffect(() => {
    if (outlets.length > 0 && !selectedOutletId) {
      setSelectedOutletId(outlets[0].id)
    }
  }, [outlets, selectedOutletId])

  const selectedOutlet = outlets.find((o) => o.id === selectedOutletId) || null

  return (
    <MitraOutletContext.Provider value={{ outlets, profile, selectedOutletId, setSelectedOutletId, selectedOutlet }}>
      {children}
    </MitraOutletContext.Provider>
  )
}

export function useMitraOutlet() {
  const context = useContext(MitraOutletContext)
  if (context === undefined) {
    throw new Error('useMitraOutlet must be used within a MitraOutletProvider')
  }
  return context
}
