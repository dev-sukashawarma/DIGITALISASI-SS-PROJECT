'use client'
import { useAuth } from '@suka/auth'
import { Avatar } from '@suka/design-system'

export function Header() {
  const { outletStaff, signOut } = useAuth()
  return (
    <header className="flex items-center justify-between border-b border-suka-gray-200 bg-white px-4 py-3">
      <h1 className="text-sm font-bold text-suka-ink">Dashboard Administrasi</h1>
      <div className="flex items-center gap-3">
        {outletStaff && (
          <div className="flex items-center gap-2">
            <Avatar name={outletStaff.name} size={32} />
            <span className="text-sm font-medium text-suka-ink">{outletStaff.name}</span>
          </div>
        )}
        <button onClick={() => signOut()} className="text-sm font-medium text-red-600 hover:underline">Keluar</button>
      </div>
    </header>
  )
}
