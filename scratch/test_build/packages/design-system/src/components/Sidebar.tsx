import React from 'react'
import Link from 'next/link'

export interface SidebarMenuItem {
  label: string
  href: string
}

export interface SidebarProps {
  menuItems: SidebarMenuItem[]
  currentPathname: string
}

export const Sidebar: React.FC<SidebarProps> = ({ menuItems, currentPathname }) => {
  return (
    <aside className="w-64 bg-suka-cream border-r border-suka-gray-200 p-6">
      <nav className="space-y-2">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`block px-4 py-2 rounded-md transition-colors ${
              currentPathname === item.href
                ? 'bg-suka-orange text-white'
                : 'text-suka-brown hover:bg-white'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
Sidebar.displayName = 'Sidebar'
