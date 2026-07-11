import React from 'react'
import { KorlapLayout as KorlapLayoutComponent } from '@/components/KorlapLayout'

export default function KorlapLayout({ children }: { children: React.ReactNode }) {
  return (
    <KorlapLayoutComponent>
      {children}
    </KorlapLayoutComponent>
  )
}
