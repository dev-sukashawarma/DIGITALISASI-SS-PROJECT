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
  const isFinance = isChecker || role === 'admin_finance'
  return { role, name: outletStaff?.name ?? null, isChecker, isFinance }
}
