'use client'

import { Button } from '@suka/design-system'
import { useAuth } from '@/context/AuthContext'

export const Header = () => {
  const { outletStaff, signOut } = useAuth()

  return (
    <header className="border-b border-suka-gray-200 bg-white px-6 py-4 flex justify-between items-center">
      <div>
        <h1 className="text-2xl font-bold text-suka-brown">Dashboard Owner</h1>
        {outletStaff && <p className="text-sm text-suka-gray-600">{outletStaff.name}</p>}
      </div>
      <Button variant="secondary" size="sm" onClick={() => signOut()}>
        Keluar
      </Button>
    </header>
  )
}
