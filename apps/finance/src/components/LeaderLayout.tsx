'use client'

import { LayoutDashboard, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import { RoleLayout, type NavGroup } from './RoleLayout'
import { usePettyCashRequests } from '@/hooks/usePettyCash'
import { useMemo } from 'react'

export function LeaderLayout({ children }: { children: ReactNode }) {
  const { data: allRequests } = usePettyCashRequests()

  const reviewCount = useMemo(() => {
    if (!allRequests) return 0
    return allRequests.filter(r => 
      r.status === 'pending' || 
      r.status === 'forwarded_to_area_manager' || 
      r.status === 'forwarded_by_area_manager'
    ).length
  }, [allRequests])

  const NAV_GROUPS: NavGroup[] = [
    {
      title: 'LEADER',
      items: [
        { href: '/leader', label: 'Overview', icon: LayoutDashboard },
        { href: '/leader/petty-cash', label: 'Petty Cash', icon: Wallet, badge: reviewCount },
      ],
    },
  ]

  return (
    <RoleLayout
      brand="Suka"
      brandAccent="Leader"
      navGroups={NAV_GROUPS}
      homePath="/leader"
      defaultTitle="Dashboard Leader"
    >
      {children}
    </RoleLayout>
  )
}
