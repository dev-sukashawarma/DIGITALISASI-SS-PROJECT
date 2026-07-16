'use client'

import { useRealtimeInvalidate } from '@suka/realtime'

/**
 * Pengganti scoped untuk invalidasi yang sebelumnya numpang firehose.
 * Tabel dasar → queryKey React Query yang dipakai hooks admin-dashboard.
 */
export function useHrFinanceRealtime() {
  useRealtimeInvalidate({
    channelName: 'admin-hr-finance',
    subs: [
      { table: 'expenses', queryKeys: [['expenses']] },
      { table: 'payroll_records', queryKeys: [['payroll']] },
      { table: 'outlet_staff', queryKeys: [['staff']] },
      { table: 'cash_advances', queryKeys: [['cash-advances']] },
    ],
  })
}
