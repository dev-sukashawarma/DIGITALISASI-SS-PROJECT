'use client'

import { useHrFinanceRealtime } from '@/hooks/useHrFinanceRealtime'

export function RealtimeMount() {
  useHrFinanceRealtime()
  return null
}
