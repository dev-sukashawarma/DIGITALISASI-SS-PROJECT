import { describe, it, expect } from 'vitest'
import { matchesReceiptFilter, receiptPrintTimeline, receiptReprintLabels, receiptStatusLabels, toReceiptFilter } from './receiptReprint'

describe('receiptReprintLabels', () => {
  it('tidak berlabel bila struk dicetak sekali atau belum tercatat', () => {
    expect(receiptReprintLabels({ customer_receipt_print_count: 1, kitchen_receipt_print_count: 1 })).toEqual([])
    expect(receiptReprintLabels({ customer_receipt_print_count: 0, kitchen_receipt_print_count: 0 })).toEqual([])
    expect(receiptReprintLabels({})).toEqual([])
    expect(receiptReprintLabels({ customer_receipt_print_count: null, kitchen_receipt_print_count: null })).toEqual([])
  })

  it('menampilkan jumlah cetak untuk struk yang dicetak lebih dari sekali', () => {
    expect(receiptReprintLabels({ customer_receipt_print_count: 3, kitchen_receipt_print_count: 1 })).toEqual([
      { kind: 'customer', count: 3, text: 'Struk customer dicetak 3x' },
    ])
    expect(receiptReprintLabels({ customer_receipt_print_count: 2, kitchen_receipt_print_count: 2 }).map((l) => l.text)).toEqual([
      'Struk customer dicetak 2x',
      'Struk dapur dicetak 2x',
    ])
  })
})

describe('receiptStatusLabels', () => {
  it('order lama / APK lama yang belum tercatat apa pun tidak berlabel', () => {
    expect(receiptStatusLabels({})).toEqual([])
    expect(receiptStatusLabels({
      customer_receipt_print_count: 0, kitchen_receipt_print_count: 0,
      customer_receipt_skipped: false, kitchen_receipt_skipped: false,
    })).toEqual([])
  })

  it('semua struk tercetak normal', () => {
    expect(receiptStatusLabels({ customer_receipt_print_count: 1, kitchen_receipt_print_count: 1 })).toEqual([
      { tone: 'ok', text: 'Struk tercetak' },
    ])
  })

  it('crew melewati semua struk di layar Order Berhasil', () => {
    expect(receiptStatusLabels({ customer_receipt_skipped: true, kitchen_receipt_skipped: true })).toEqual([
      { tone: 'skipped', text: 'Struk tidak dicetak' },
    ])
  })

  it('struk dapur tercetak tapi struk customer dilewati', () => {
    expect(receiptStatusLabels({ kitchen_receipt_print_count: 1, customer_receipt_skipped: true })).toEqual([
      { tone: 'skipped', text: 'Struk customer tidak dicetak' },
    ])
  })

  it('struk yang dilewati lalu dicetak dari kartu order ditandai susulan', () => {
    expect(receiptStatusLabels({
      kitchen_receipt_print_count: 1, customer_receipt_print_count: 1, customer_receipt_skipped: true,
    })).toEqual([{ tone: 'late', text: 'Struk customer dicetak susulan' }])
    expect(receiptStatusLabels({
      kitchen_receipt_print_count: 1, kitchen_receipt_skipped: true, customer_receipt_skipped: true,
    })).toEqual([
      { tone: 'skipped', text: 'Struk customer tidak dicetak' },
      { tone: 'late', text: 'Struk dapur dicetak susulan' },
    ])
  })
})

describe('matchesReceiptFilter', () => {
  const normal = { customer_receipt_print_count: 1, kitchen_receipt_print_count: 1 }
  const lewati = { kitchen_receipt_print_count: 1, customer_receipt_skipped: true }
  const susulan = { kitchen_receipt_print_count: 1, customer_receipt_print_count: 1, customer_receipt_skipped: true }
  const cetakUlang = { customer_receipt_print_count: 3, kitchen_receipt_print_count: 1 }
  const lama = {}

  it('tidak cetak struk: hanya order yang struknya dilewati dan belum pernah dicetak', () => {
    const hasil = [normal, lewati, susulan, cetakUlang, lama].map((o) => matchesReceiptFilter(o, 'not_printed'))
    expect(hasil).toEqual([false, true, false, false, false])
  })

  it('cetak lebih dari 1x: hanya order dengan struk dicetak berulang', () => {
    const hasil = [normal, lewati, susulan, cetakUlang, lama].map((o) => matchesReceiptFilter(o, 'reprinted'))
    expect(hasil).toEqual([false, false, false, true, false])
  })

  it('nilai filter tak dikenal diperlakukan sebagai semua', () => {
    expect(toReceiptFilter('reprinted')).toBe('reprinted')
    expect(toReceiptFilter('hapus_semua')).toBe('all')
    expect(toReceiptFilter(undefined)).toBe('all')
    expect(matchesReceiptFilter(lewati, 'all')).toBe(true)
  })
})

describe('receiptPrintTimeline', () => {
  const logs = [
    { kind: 'customer' as const, printed_at: '2026-10-17T04:20:00+00:00', printed_by_name: 'Sari' },
    { kind: 'kitchen' as const, printed_at: '2026-10-17T04:00:00+00:00', printed_by_name: 'Sari' },
    { kind: 'customer' as const, printed_at: '2026-10-17T04:00:30+00:00', printed_by_name: 'Budi' },
  ]

  it('mengurutkan cetak satu jenis struk dan memberi nomor ke-N', () => {
    expect(receiptPrintTimeline(logs, 'customer', 2)).toEqual({
      untracked: 0,
      entries: [
        { nth: 1, printedAt: '2026-10-17T04:00:30+00:00', by: 'Budi' },
        { nth: 2, printedAt: '2026-10-17T04:20:00+00:00', by: 'Sari' },
      ],
    })
  })

  it('cetakan sebelum log ada dihitung sebagai cetak paling awal tanpa waktu', () => {
    const t = receiptPrintTimeline(logs, 'customer', 7)
    expect(t.untracked).toBe(5)
    expect(t.entries.map((e) => e.nth)).toEqual([6, 7])
  })
})
