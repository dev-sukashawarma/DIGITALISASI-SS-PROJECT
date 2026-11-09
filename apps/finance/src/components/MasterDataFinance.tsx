'use client'

import type { ReactNode } from 'react'
import { useAuth } from '@suka/auth'
import { MasterDataProvider, peranDariStaff } from '@suka/master-data'

/** Layar master data bersama (@suka/master-data) dipasang di finance dengan rute finance. */
export function MasterDataFinance({ children }: { children: ReactNode }) {
  const { outletStaff } = useAuth()
  return (
    <MasterDataProvider
      role={peranDariStaff(outletStaff?.role as string | undefined)}
      rute={{ bahanBaku: '/pembelian/bahan-baku', supplier: '/pembelian/supplier', buatPo: '/pembelian/new' }}
    >
      {children}
    </MasterDataProvider>
  )
}
