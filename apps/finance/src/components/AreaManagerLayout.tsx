'use client'

import { LayoutDashboard, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import { RoleLayout, type NavGroup } from './RoleLayout'

export function AreaManagerLayout({ children }: { children: ReactNode }) {
  // Area Manager hanya memantau petty cash sejak 25 Nov 2026: tidak ada badge antrean.
  const NAV_GROUPS: NavGroup[] = [
    {
      title: 'KORLAP',
      items: [
        { href: '/area-manager', label: 'Overview', icon: LayoutDashboard },
        { href: '/area-manager/petty-cash', label: 'Petty Cash', icon: Wallet },
      ],
    },
  ]

  return (
    <RoleLayout
      brand="Suka"
      brandAccent="Area Manager"
      navGroups={NAV_GROUPS}
      homePath="/area-manager"
      defaultTitle="Dashboard Area Manager"
    >
      {children}
    </RoleLayout>
  )
}
