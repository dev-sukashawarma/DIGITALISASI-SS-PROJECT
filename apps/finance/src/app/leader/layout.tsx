import React from 'react'
import { LeaderLayout as LeaderLayoutComponent } from '@/components/LeaderLayout'

export default function LeaderLayout({ children }: { children: React.ReactNode }) {
  return (
    <LeaderLayoutComponent>
      {children}
    </LeaderLayoutComponent>
  )
}
