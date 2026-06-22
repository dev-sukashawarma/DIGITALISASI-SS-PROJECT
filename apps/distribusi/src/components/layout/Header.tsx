'use client'

import { Button } from '@suka/design-system'
import { useAuth } from '@suka/auth'

export const Header = () => {
  const { outletStaff, signOut } = useAuth()

  const handleLogout = async () => {
    await signOut()
    const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com'
    let url = portalUrl
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      url = 'http://localhost:3010'
    }
    window.location.href = url
  }

  return (
    <header className="border-b border-suka-gray-200 bg-white px-6 py-4 flex justify-between items-center">
      <div>
        <h1 className="text-2xl font-bold text-suka-brown">Distribusi</h1>
        {outletStaff && <p className="text-sm text-suka-gray-600">{outletStaff.name}</p>}
      </div>
      <Button variant="secondary" size="sm" onClick={handleLogout}>
        Keluar
      </Button>
    </header>
  )
}
