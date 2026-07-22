'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from '@suka/auth'
import { usePathname, useRouter } from 'next/navigation'

type Role = 'ADMIN_HR' | 'OWNER' | 'ADMIN' | 'MITRA' | 'LEADER' | 'AREA_MANAGER'

interface RoleContextType {
  role: Role
  outletId: string | null
  isReadOnly: boolean
}

const RoleContext = createContext<RoleContextType | undefined>(undefined)

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const { outletStaff, loading } = useAuth()
  const [role, setRole] = useState<Role | null>(null)
  const [outletId, setOutletId] = useState<string | null>(null)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (loading) return

    if (outletStaff?.role) {
      let mappedRole = outletStaff.role.toUpperCase() as Role
      if (mappedRole as any === 'KORLAP') mappedRole = 'AREA_MANAGER'
      
      if (['OWNER', 'ADMIN', 'ADMIN_HR', 'MITRA', 'LEADER', 'AREA_MANAGER'].includes(mappedRole)) {
        setRole(mappedRole)
        setOutletId(outletStaff.outlet_id ?? null)
      } else {
        // Redirect to Portal if the role is not allowed in admin-dashboard (e.g. crew)
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

  // Route-guard: Redirect OWNER to /dashboard/owner if trying to access HR or Admin paths
  useEffect(() => {
    if (role === 'OWNER') {
      const isHrRoute = pathname.startsWith('/dashboard/hr')
      const isAdminRoute = pathname.startsWith('/dashboard/system-health') || pathname.startsWith('/dashboard/outlets')
      if (isHrRoute || isAdminRoute) {
        router.replace('/dashboard/owner')
      }
    }
  }, [role, pathname, router])

  // ADMIN has full access (Owner Dashboard + System & Admin) — no route-guard restriction.

  // Route-guard: MITRA may only see its 4 read-only pages.
  useEffect(() => {
    if (role !== 'MITRA') return
    const allowed = ['/dashboard/mitra']
    if (!allowed.some((a) => pathname === a || pathname.startsWith(a + '/'))) {
      router.replace('/dashboard/mitra')
    }
  }, [role, pathname, router])

  // Route-guard: LEADER may only see /dashboard/leader
  useEffect(() => {
    if (role !== 'LEADER') return
    const allowed = ['/dashboard/leader']
    if (!allowed.some((a) => pathname === a || pathname.startsWith(a + '/'))) {
      router.replace('/dashboard/leader')
    }
  }, [role, pathname, router])

  // Route-guard: AREA_MANAGER may ONLY access /dashboard/area-manager/petty-cash
  useEffect(() => {
    if (role !== 'AREA_MANAGER') return
    const allowed = ['/dashboard/area-manager/petty-cash']
    if (!allowed.some((a) => pathname === a || pathname.startsWith(a + '/'))) {
      router.replace('/dashboard/area-manager/petty-cash')
    }
  }, [role, pathname, router])

  if (loading || !role) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-suka-cream">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-suka-orange border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-bold text-suka-brown tracking-wide animate-pulse">Memuat Akses...</p>
        </div>
      </div>
    )
  }

  return (
    <RoleContext.Provider value={{ role, outletId, isReadOnly: role === 'MITRA' }}>
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
