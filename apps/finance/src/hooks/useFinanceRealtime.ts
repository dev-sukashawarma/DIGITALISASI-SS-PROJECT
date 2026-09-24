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
    // Gabungkan rentetan event jadi 1 refetch per queryKey.
    debounceMs: 1000,
    // Reconnect (tab bangun / jaringan putus-sambung) memicu refetch SEMUA
    // queryKey di bawah — batasi maks. sekali per menit.
    resubscribeMinIntervalMs: 60_000,
    subs: [
      { table: 'cash_transaction', queryKeys: [['cash_transaction'], ['cash_balance'], ['expected_cash']] },
      { table: 'cash_balance', queryKeys: [['cash_balance']] },
      { table: 'cash_location', queryKeys: [['cash_location']] },
      { table: 'petty_cash_topups', queryKeys: [['petty_cash_topups'], ['petty_cash_expenses_detail']] },
      { table: 'petty_cash_expenses', queryKeys: [['petty_cash_expenses_detail'], ['petty_cash_real_balances']] },
      { table: 'payroll_records', queryKeys: [['payroll_slips']] },
      { table: 'expenses', queryKeys: [['expenses']] },
      { table: 'purchase_order', queryKeys: [['po_payable'], ['po-pending-approval']] },
    ],
  })
}
