import React from 'react'
import { AreaManagerLayout as AreaManagerLayoutComponent } from '@/components/AreaManagerLayout'

export default function AreaManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <AreaManagerLayoutComponent>
      {children}
    </AreaManagerLayoutComponent>
  )
}
