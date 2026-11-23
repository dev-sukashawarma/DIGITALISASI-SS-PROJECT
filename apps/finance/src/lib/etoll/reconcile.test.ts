import { describe, it, expect } from 'vitest'
import {
  buildChipTxDedupKey,
  computeUntrackedGap,
  formatCardNumber,
  matchPendingTopups,
  normalizeCardNumber,
  prepareNewChipTransactions,
  resolveTerminalDictionary,
} from './reconcile'

describe('etoll reconcile domain logic', () => {
  it('normalizes and formats card numbers consistently', () => {
    expect(normalizeCardNumber('6032-9820 1234 5678')).toBe('6032982012345678')
    expect(formatCardNumber('6032982012345678')).toBe('6032 9820 1234 5678')
  })

  it('produces identical dedup keys across timezone representations', () => {
    const k1 = buildChipTxDedupKey({
      tx_type: 'debit',
      occurred_at: '2026-11-23T08:15:30+07:00',
      amount: 15000,
      balance_after: 85000,
      terminal_code: '01ab 23',
    })
    const k2 = buildChipTxDedupKey({
      tx_type: 'debit',
      occurred_at: '2026-11-23T01:15:30.000Z',
      amount: 15000,
      balance_after: 85000,
      terminal_code: '01AB23',
    })
    expect(k1).toBe(k2)
  })

  it('resolves terminal dictionary preferring issuer-specific match over all', () => {
    const dict = [
      { issuer: 'all' as const, terminal_code: 'GT001', merchant_name: 'GT Umum', default_category: 'tol' as const },
      { issuer: 'mandiri_emoney' as const, terminal_code: 'GT001', merchant_name: 'GT Cikarang Barat', default_category: 'tol' as const },
    ]
    const hitMandiri = resolveTerminalDictionary('mandiri_emoney', 'gt001', dict)
    expect(hitMandiri?.merchant_label).toBe('GT Cikarang Barat')

    const hitFlazz = resolveTerminalDictionary('bca_flazz', 'GT001', dict)
    expect(hitFlazz?.merchant_label).toBe('GT Umum')
  })

  it('deduplicates chip transactions against existing DB keys and applies dictionary', () => {
    const existing = new Set([
      buildChipTxDedupKey({
        tx_type: 'debit',
        occurred_at: '2026-11-22T09:00:00+07:00',
        amount: 20000,
        balance_after: 180000,
        terminal_code: 'A1B2',
      }),
    ])

    const prepared = prepareNewChipTransactions({
      issuer: 'mandiri_emoney',
      existingDedupKeys: existing,
      dictionary: [
        { issuer: 'mandiri_emoney', terminal_code: 'C3D4', merchant_name: 'GT Bekasi Barat', default_category: 'tol' },
      ],
      incoming: [
        // Sudah ada -> harus di-skip
        { tx_type: 'debit', occurred_at: '2026-11-22T09:00:00+07:00', amount: 20000, balance_after: 180000, terminal_code: 'A1B2' },
        // Baru & ada di kamus
        { tx_type: 'debit', occurred_at: '2026-11-23T07:30:00+07:00', amount: 15000, balance_after: 165000, terminal_code: 'c3d4' },
        // Duplikat dalam batch yang sama -> harus di-skip
        { tx_type: 'debit', occurred_at: '2026-11-23T07:30:00+07:00', amount: 15000, balance_after: 165000, terminal_code: 'C3D4' },
        // Baru & tidak ada di kamus
        { tx_type: 'debit', occurred_at: '2026-11-23T08:00:00+07:00', amount: 5000, balance_after: 160000, terminal_code: '99FF' },
      ],
    })

    expect(prepared).toHaveLength(2)
    expect(prepared[0].merchant_label).toBe('GT Bekasi Barat')
    expect(prepared[0].category).toBe('tol')
    expect(prepared[1].merchant_label).toBe('Terminal 99FF')
    expect(prepared[1].category).toBe('belum_dikategorikan')
  })

  it('computes zero gap on first scan even if balance > 0', () => {
    const gap = computeUntrackedGap({
      hasPriorScan: false,
      previousBalance: 0,
      currentBalance: 150000,
      newChipTransactions: [],
    })
    expect(gap.gapAmount).toBe(0)
    expect(gap.syntheticTransaction).toBeNull()
  })

  it('detects untracked debit gap when >10 transactions rolled off the chip', () => {
    // Scan lalu saldo 200.000. Sekarang saldo 75.000.
    // Chip hanya melaporkan 2 debit total 80.000 -> ada 45.000 keluar tak terlacak!
    const gap = computeUntrackedGap({
      hasPriorScan: true,
      previousBalance: 200000,
      currentBalance: 75000,
      newChipTransactions: [
        { tx_type: 'debit', amount: 50000 },
        { tx_type: 'debit', amount: 30000 },
      ],
    })
    expect(gap.gapAmount).toBe(45000)
    expect(gap.syntheticTransaction?.tx_type).toBe('debit')
    expect(gap.syntheticTransaction?.amount).toBe(45000)
    expect(gap.syntheticTransaction?.category).toBe('untracked_gap')
  })

  it('detects untracked topup when balance rises without chip topup log (e.g. BRI Brizzi)', () => {
    const gap = computeUntrackedGap({
      hasPriorScan: true,
      previousBalance: 50000,
      currentBalance: 250000,
      newChipTransactions: [],
    })
    expect(gap.gapAmount).toBe(-200000)
    expect(gap.syntheticTransaction?.tx_type).toBe('topup')
    expect(gap.syntheticTransaction?.amount).toBe(200000)
    expect(gap.syntheticTransaction?.category).toBe('topup')
  })

  it('matches pending finance top-ups with chip top-up transactions by amount and date window', () => {
    const pairs = matchPendingTopups(
      [
        { id: 'tu-1', topup_date: '2026-11-20', amount: 200000 },
        { id: 'tu-2', topup_date: '2026-11-22', amount: 200000 },
        { id: 'tu-3', topup_date: '2026-11-22', amount: 500000 },
      ],
      [
        { id: 'tx-a', occurred_at: '2026-11-20T14:00:00+07:00', amount: 200000 },
        { id: 'tx-b', occurred_at: '2026-11-23T08:00:00+07:00', amount: 200000 },
        // Di luar window (>14 hari)
        { id: 'tx-c', occurred_at: '2026-12-20T08:00:00+07:00', amount: 500000 },
      ],
    )

    expect(pairs).toEqual([
      { topupId: 'tu-1', transactionId: 'tx-a' },
      { topupId: 'tu-2', transactionId: 'tx-b' },
    ])
  })
})
