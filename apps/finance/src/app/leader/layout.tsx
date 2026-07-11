import React from 'react'
import { Sidebar } from '@suka/design-system'
import { headers } from 'next/headers'

export default async function LeaderLayout({ children }: { children: React.ReactNode }) {
  const currentPathname = (await headers()).get('x-invoke-path') || '/leader'
  
  const menuItems = [
    { label: 'Overview', href: '/leader' },
    { label: 'Petty Cash', href: '/leader/petty-cash' },
  ]

  return (
    <div className="flex min-h-screen bg-suka-gray-50">
      {/* Sidebar untuk navigasi desktop/tablet */}
      <Sidebar menuItems={menuItems} currentPathname={currentPathname} />
      
      {/* Konten Utama */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
