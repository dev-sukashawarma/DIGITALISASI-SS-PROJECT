'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

type Role = 'HR' | 'ADMIN_HR' | 'OWNER' | 'ADMIN'

interface RoleContextType {
  role: Role
  setRole: (role: Role) => void
}

const RoleContext = createContext<RoleContextType | undefined>(undefined)

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role>('HR')
  
  // Load initial role from localStorage if available
  useEffect(() => {
    const saved = localStorage.getItem('admin_simulated_role') as Role
    if (saved && ['HR', 'ADMIN_HR', 'OWNER', 'ADMIN'].includes(saved)) {
      setRoleState(saved)
    }
  }, [])

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
