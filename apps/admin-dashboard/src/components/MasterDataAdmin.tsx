'use client'

import type { ReactNode } from 'react'
import { MasterDataProvider } from '@suka/master-data'
import { useRole } from '@/components/layout/RoleContext'

/** Menyambungkan role admin-dashboard ke layar bersama @suka/master-data. */
export function MasterDataAdmin({ children }: { children: ReactNode }) {
  const { role } = useRole()
  return <MasterDataProvider role={role}>{children}</MasterDataProvider>
}
