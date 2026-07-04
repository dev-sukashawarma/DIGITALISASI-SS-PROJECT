import { describe, it, expect } from 'vitest'
import { transaksiLabel } from '../LedgerList'
import type { LedgerTransaksiSummary } from '@/types/stok'

function makeSummary(overrides: Partial<LedgerTransaksiSummary>): LedgerTransaksiSummary {
  return {
    transaksi_key: 'x', outlet_id: 'o1', created_at: '2026-07-04T10:00:00Z',
    jumlah_bahan: 1, ref_order_id: null, ref_opname_id: null,
    ref_shipment_id: null, ref_transfer_id: null,
    single_bahan_baku_id: null, single_tipe: null, single_qty: null,
    single_catatan: null, single_saldo_sesudah: null,
    ...overrides,
  }
}

describe('transaksiLabel', () => {
  it('order -> label Order Selesai + nomor order', () => {
    const t = makeSummary({ ref_order_id: 'ord-1', order_number: 123, jumlah_bahan: 12 })
    expect(transaksiLabel(t)).toEqual({ title: 'Order Selesai', subtitle: 'Order #123' })
  })

  it('opname -> label Opname + tanggal', () => {
    const t = makeSummary({ ref_opname_id: 'op-1', opname_tanggal: '2026-07-04', opname_tipe: 'harian', jumlah_bahan: 5 })
    expect(transaksiLabel(t).title).toBe('Opname')
    expect(transaksiLabel(t).subtitle).toContain('harian')
  })

  it('manual (tanpa ref) -> label dari single_tipe', () => {
    const t = makeSummary({ single_tipe: 'waste' })
    expect(transaksiLabel(t)).toEqual({ title: 'Waste', subtitle: null })
  })

  it('shipment -> label Terima Kiriman tanpa subtitle', () => {
    const t = makeSummary({ ref_shipment_id: 'sh-1', jumlah_bahan: 3 })
    expect(transaksiLabel(t)).toEqual({ title: 'Terima Kiriman', subtitle: null })
  })
})
