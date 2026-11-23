import { describe, it, expect } from 'vitest'
import { klasifikasiMutasi, isInboundAdjustment } from './klasifikasiMutasi'

const r = (tipe: string, qty: number, extra: Record<string, unknown> = {}) => ({ tipe, qty, ...extra })

describe('klasifikasiMutasi', () => {
  it('potongan & pembalik order -> order (dihitung neto per order di tempat lain)', () => {
    expect(klasifikasiMutasi(r('pemakaian', -10, { ref_order_id: 'o1' }), false)).toBe('order')
    expect(klasifikasiMutasi(r('adjustment', 10, { ref_order_id: 'o1' }), true)).toBe('order')
  })

  it('pemakaian tanpa order -> pakai', () => {
    expect(klasifikasiMutasi(r('pemakaian', -5), false)).toBe('pakai')
  })

  it('waste manual dihitung, waste ber-laporan diabaikan (otoritatif dari stok_waste_reports)', () => {
    expect(klasifikasiMutasi(r('waste', -3), false)).toBe('waste_manual')
    expect(klasifikasiMutasi(r('waste', -3, { ref_waste_id: 'w' }), false)).toBe('abaikan')
    expect(klasifikasiMutasi(r('adjustment', 3, { ref_waste_id: 'w' }), false)).toBe('abaikan')
  })

  it('penolakan terima drop-ship mengurangi masuk', () => {
    expect(klasifikasiMutasi(r('rejected_kiriman', -2, { ref_terima_vendor_id: 't' }), false)).toBe('tolak_vendor')
  })

  it('barang masuk: kiriman, pembelian, inbound manual', () => {
    expect(klasifikasiMutasi(r('terima_kiriman', 5), true)).toBe('masuk')
    expect(klasifikasiMutasi(r('pembelian_supplier', 5), true)).toBe('masuk')
    expect(klasifikasiMutasi(r('adjustment', 5, { catatan: 'Inbound manual purchasing' }), false)).toBe('masuk')
  })

  it('transfer_masuk = masuk untuk satu outlet, tapi mutasi internal saat konsolidasi semua outlet', () => {
    expect(klasifikasiMutasi(r('transfer_masuk', 5), false)).toBe('masuk')
    expect(klasifikasiMutasi(r('transfer_masuk', 5), true)).toBe('lain')
  })

  it('retur ke pusat & retur ke vendor mengurangi stok sistem (dulu terlewat semua cabang)', () => {
    expect(klasifikasiMutasi(r('retur_ke_pusat', -4), false)).toBe('lain')
    expect(klasifikasiMutasi(r('retur_ke_vendor', -4), false)).toBe('lain')
    expect(klasifikasiMutasi(r('terima_retur_outlet', 4), false)).toBe('lain')
  })

  it('transfer keluar & penyesuaian internal -> mutasi lain (bertanda)', () => {
    expect(klasifikasiMutasi(r('transfer_keluar', -4), false)).toBe('lain')
    expect(klasifikasiMutasi(r('adjustment', -4), false)).toBe('lain')
    expect(klasifikasiMutasi(r('adjustment', 4, { catatan: 'koreksi salah input' }), false)).toBe('lain')
  })

  it('tipe yang belum dikenal tidak pernah hilang diam-diam: tetap menggerakkan stok sistem', () => {
    expect(klasifikasiMutasi(r('tipe_baru_entah_apa', -7), false)).toBe('lain')
    expect(klasifikasiMutasi(r('rejected_kiriman', 0), false)).toBe('lain')
  })

  it('opname_selisih bukan mutasi operasional', () => {
    expect(klasifikasiMutasi(r('opname_selisih', 9), false)).toBe('abaikan')
  })
})

describe('isInboundAdjustment', () => {
  it('hanya adjustment positif tanpa rujukan & bukan catatan internal', () => {
    expect(isInboundAdjustment(r('adjustment', 5))).toBe(true)
    expect(isInboundAdjustment(r('adjustment', -5))).toBe(false)
    expect(isInboundAdjustment(r('adjustment', 5, { ref_opname_id: 'x' }))).toBe(false)
    expect(isInboundAdjustment(r('adjustment', 5, { catatan: 'Ayam matang' }))).toBe(false)
    expect(isInboundAdjustment(r('terima_kiriman', 5))).toBe(false)
  })
})
