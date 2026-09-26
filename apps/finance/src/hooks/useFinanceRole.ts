'use client'

import { useAuth } from '@suka/auth'

/**
 * Peran finance dari sesi login.
 * - checker: owner/admin (boleh approve, transfer, kelola rekening)
 * - maker: admin_finance (boleh submit; approve ditolak server)
 */
export function useFinanceRole() {
  const { outletStaff } = useAuth()
  const role = (outletStaff?.role as string) ?? null
  const isDeveloper = role === 'developer'
  const isChecker = role === 'owner' || role === 'admin' || isDeveloper
  const isFinance = role === 'owner' || role === 'admin' || role === 'admin_finance' || isDeveloper
  const isPurchasing = role === 'owner' || role === 'admin' || role === 'purchasing' || role === 'purchase' || isDeveloper
  const canManagePO = isPurchasing || role === 'admin_finance' || role === 'kitchen' || isDeveloper
  const canApprovePO = role === 'owner' || role === 'admin' || role === 'admin_finance' || isDeveloper
  const canVerifyPOReceipt = role === 'owner' || role === 'admin' || role === 'kitchen' || isDeveloper

  return { 
    role, 
    name: outletStaff?.name ?? null, 
    userId: outletStaff?.id ?? null,
    isChecker, 
    isFinance,
    isPurchasing,
    canManagePO,
    canApprovePO,
    canVerifyPOReceipt,
  }
}
