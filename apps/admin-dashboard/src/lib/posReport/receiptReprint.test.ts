import { describe, it, expect } from 'vitest'
import { matchesReceiptFilter, receiptReprintLabels, receiptStatusLabels, toReceiptFilter } from './receiptReprint'

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
