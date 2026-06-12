import React from 'react'
import { Button } from './Button'

export interface HeaderProps {
  title: string
  outletStaffName?: string | null
  onSignOut: () => void
}

export const Header: React.FC<HeaderProps> = ({ title, outletStaffName, onSignOut }) => {
  return (
    <header className="border-b border-suka-gray-200 bg-white px-6 py-4 flex justify-between items-center">
      <div>
        <h1 className="text-2xl font-bold text-suka-brown">{title}</h1>
        {outletStaffName && <p className="text-sm text-suka-gray-600">{outletStaffName}</p>}
      </div>
      <Button variant="secondary" size="sm" onClick={onSignOut}>
        Keluar
      </Button>
    </header>
  )
}
Header.displayName = 'Header'
