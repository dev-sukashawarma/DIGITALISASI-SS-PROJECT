'use client'

import { LayoutDashboard, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import { RoleLayout, type NavGroup } from './RoleLayout'
import { usePettyCashRequests } from '@/hooks/usePettyCash'
import { useMemo } from 'react'

export function AreaManagerLayout({ children }: { children: ReactNode }) {
  // AreaManager typically filters by Region (e.g. BOGOR). Since the layout might not know the exact region 
  // without the session, we use the same fallback 'BOGOR' as PettyCashList or omit if it relies on RLS.
  // We'll use 'BOGOR' for consistency with AreaManager PettyCashList.
  const { data: allRequests } = usePettyCashRequests(undefined, undefined, 'BOGOR')

  const reviewCount = useMemo(() => {
    if (!allRequests) return 0
    return allRequests.filter(r => 
      r.status === 'pending' ||
      r.status === 'forwarded_to_area_manager' || 
      r.status === 'approved_by_finance' || 
      r.status === 'forwarded_by_finance'
    ).length
  }, [allRequests])

  const NAV_GROUPS: NavGroup[] = [
    {
      title: 'KORLAP',
      items: [
        { href: '/area-manager', label: 'Overview', icon: LayoutDashboard },
        { href: '/area-manager/petty-cash', label: 'Petty Cash', icon: Wallet, badge: reviewCount },
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
