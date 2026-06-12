'use client'

import { Header as SharedHeader } from '@suka/design-system'
import { useAuth } from '@/context/AuthContext'

export const Header = () => {
  const { outletStaff, signOut } = useAuth()

  return (
    <SharedHeader
      title="Stok Bahan Baku"
      outletStaffName={outletStaff?.name}
      onSignOut={signOut}
    />
  )
}
