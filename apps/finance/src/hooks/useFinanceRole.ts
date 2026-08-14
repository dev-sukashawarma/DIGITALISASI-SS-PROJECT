'use client'

import { useAuth } from '@suka/auth'

/**
 * Peran finance dari sesi login.
 * - checker: owner/admin (boleh approve, transfer, kelola rekening)
 * - maker: admin_finance (boleh submit; approve ditolak server)
 */
export function useFinanceRole() {
  const { outletStaff } = useAuth()
  const role = outletStaff?.role ?? null
  const isChecker = role === 'owner' || role === 'admin'
  const isFinance = role === 'owner' || role === 'admin' || role === 'admin_finance'
  const isPurchasing = role === 'owner' || role === 'admin' || role === 'purchasing' || role === 'purchase'
  const canManagePO = isPurchasing || role === 'admin_finance' || role === 'kitchen'
  const canApprovePO = role === 'owner' || role === 'admin' || role === 'admin_finance'

  return { 
    role, 
    name: outletStaff?.name ?? null, 
    userId: outletStaff?.id ?? null,
    isChecker, 
    isFinance,
    isPurchasing,
    canManagePO,
    canApprovePO,
  }
}
