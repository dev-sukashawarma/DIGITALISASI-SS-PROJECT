'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from '@suka/auth'

type Role = 'ADMIN_HR' | 'OWNER' | 'ADMIN'

interface RoleContextType {
  role: Role
}

const RoleContext = createContext<RoleContextType | undefined>(undefined)

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const { outletStaff } = useAuth()
  const [role, setRole] = useState<Role>('ADMIN_HR')
  
  useEffect(() => {
    if (outletStaff?.role) {
      const mappedRole = outletStaff.role.toUpperCase() as Role
      if (['OWNER', 'ADMIN', 'ADMIN_HR'].includes(mappedRole)) {
        setRole(mappedRole)
      }
    }
  }, [outletStaff])

  return (
    <RoleContext.Provider value={{ role }}>
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
