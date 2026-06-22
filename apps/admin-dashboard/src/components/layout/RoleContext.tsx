'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from '@suka/auth'

type Role = 'HR' | 'ADMIN_HR' | 'OWNER' | 'ADMIN'

interface RoleContextType {
  role: Role
  setRole: (role: Role) => void
}

const RoleContext = createContext<RoleContextType | undefined>(undefined)

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const { outletStaff } = useAuth()
  const [role, setRoleState] = useState<Role>('HR')
  
  // Load initial role from localStorage if available, or fallback to authenticated profile role
  useEffect(() => {
    const saved = localStorage.getItem('admin_simulated_role') as Role
    if (saved && ['HR', 'ADMIN_HR', 'OWNER', 'ADMIN'].includes(saved)) {
      setRoleState(saved)
      return
    }

    if (outletStaff?.role) {
      const mappedRole = outletStaff.role.toUpperCase() as Role
      if (['OWNER', 'ADMIN', 'ADMIN_HR'].includes(mappedRole)) {
        setRoleState(mappedRole)
      }
    }
  }, [outletStaff])

  const setRole = (newRole: Role) => {
    setRoleState(newRole)
    localStorage.setItem('admin_simulated_role', newRole)
  }

  return (
    <RoleContext.Provider value={{ role, setRole }}>
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
