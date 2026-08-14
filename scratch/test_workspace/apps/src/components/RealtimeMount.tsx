'use client'

import { useHrFinanceRealtime } from '@/hooks/useHrFinanceRealtime'
import { useSalesRealtime } from '@/hooks/useSalesRealtime'

export function RealtimeMount() {
  useHrFinanceRealtime()
  // Owner sales dashboard: sebelumnya useSalesRealtime tak pernah di-mount
  // (dead code), jadi angka omzet tak pernah live. Di-mount di sini agar
  // INSERT/UPDATE `orders` meng-invalidate KPI/tren/menu di detik itu.
  useSalesRealtime()
  return null
}
