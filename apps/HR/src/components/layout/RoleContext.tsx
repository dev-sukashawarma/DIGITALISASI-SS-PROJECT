'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from '@suka/auth'

type Role = 'ADMIN_HR' | 'OWNER' | 'ADMIN' | 'DEVELOPER'

interface RoleContextType {
  role: Role
  outletId: string | null
  staffName: string
}

const RoleContext = createContext<RoleContextType | undefined>(undefined)

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const { outletStaff, loading } = useAuth()
  const [role, setRole] = useState<Role | null>(null)
  const [outletId, setOutletId] = useState<string | null>(null)

  useEffect(() => {
    if (loading) return

    if (outletStaff?.role) {
      const mappedRole = outletStaff.role.toUpperCase() as Role
      if (['OWNER', 'ADMIN', 'ADMIN_HR', 'DEVELOPER'].includes(mappedRole)) {
        setRole(mappedRole)
        setOutletId(outletStaff.outlet_id ?? null)
      } else {
        // Redirect to Portal if the role is not allowed in HR App
        const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com'
        let url = portalUrl
        if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
          url = 'http://localhost:3010'
        }
        window.location.href = url
      }
    } else if (outletStaff === null) {
      // Redirect to Portal if no staff profile is found
      const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com'
      let url = portalUrl
      if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
        url = 'http://localhost:3010'
      }
      window.location.href = url
    }
  }, [outletStaff, loading])

  if (loading || !role) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#FDF9F3]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-suka-orange border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-bold text-suka-brown tracking-wide animate-pulse">Memuat HR Workspace...</p>
        </div>
      </div>
    )
  }

  return (
    <RoleContext.Provider value={{ role, outletId, staffName: outletStaff?.name || 'Staff' }}>
      {children}
    </RoleContext.Provider>
  )
}

export function useRole() {
  const context = useContext(RoleContext)
  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider')
  }
  return context
}
