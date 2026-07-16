'use client'

import { useRealtimeInvalidate } from '@suka/realtime'

/**
 * Realtime finance (menggantikan firehose GlobalRealtimeProvider).
 * Semua update lintas-sesi (setoran, pencairan, approval petty cash,
 * settlement supplier) di-invalidate scoped ke queryKey React Query.
 *
 * Catatan po_payable: realtime postgres_changes tidak emit untuk VIEW
 * (po_payable_spv). Subscribe ke base table purchase_order — kolom
 * payment_status/paid_at/cash_transaction_id di-UPDATE langsung oleh
 * settle_purchase_order() dan trigger sync_supplier_payment() saat
 * settlement/konfirmasi pembayaran (lihat migration
 * 20260711120000_finance_supplier_settlement.sql).
 */
export function useFinanceRealtime() {
  useRealtimeInvalidate({
    channelName: 'finance-global',
    subs: [
      { table: 'cash_transaction', queryKeys: [['cash_transaction'], ['cash_balance'], ['expected_cash']] },
      { table: 'cash_balance', queryKeys: [['cash_balance']] },
      { table: 'cash_location', queryKeys: [['cash_location']] },
      { table: 'petty_cash_topups', queryKeys: [['petty_cash_topups']] },
      { table: 'petty_cash_expenses', queryKeys: [['petty_cash_topups']] },
      { table: 'payroll_records', queryKeys: [['payroll_slips'], ['payroll']] },
      { table: 'expenses', queryKeys: [['expenses']] },
      { table: 'purchase_order', queryKeys: [['po_payable']] },
    ],
  })
}
