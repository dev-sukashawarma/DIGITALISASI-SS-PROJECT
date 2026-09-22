import { describe, it, expect } from 'vitest'
import { sembunyikanKolomBesar } from './satuanOpname'

const HAND_GLOVE = { nama: 'HAND GLOVE', satuan: 'Dus', satuan_tengah: 'Box', satuan_distribusi: 'box' }

describe('sembunyikanKolomBesar', () => {
  it('outlet: disembunyikan bila dikirim per satuan tengah', () => {
    expect(sembunyikanKolomBesar(HAND_GLOVE, { isGudangPusat: false })).toBe(true)
  })
  it('bahan lain yang dikirim per satuan tengah belum ikut (masih dievaluasi)', () => {
    expect(sembunyikanKolomBesar({ nama: 'FOIL', satuan: 'Dus', satuan_tengah: 'Roll', satuan_distribusi: 'roll' }, { isGudangPusat: false })).toBe(false)
    expect(sembunyikanKolomBesar({ nama: 'KEJU', satuan: 'Dus', satuan_tengah: 'Pack', satuan_distribusi: 'pack' }, { isGudangPusat: false })).toBe(false)
  })
  it('Gudang Pusat: selalu tampil', () => {
    expect(sembunyikanKolomBesar(HAND_GLOVE, { isGudangPusat: true })).toBe(false)
  })
  it('draft yang kolom besarnya sudah terisi tetap tampil', () => {
    expect(sembunyikanKolomBesar(HAND_GLOVE, { isGudangPusat: false, nilaiBesar: '5' })).toBe(false)
    expect(sembunyikanKolomBesar(HAND_GLOVE, { isGudangPusat: false, nilaiBesar: '0' })).toBe(true)
  })
  it('dikirim per satuan kecil (CUP pcs, KERTAS STRUK roll): tetap tampil', () => {
    expect(sembunyikanKolomBesar({ satuan: 'Pack', satuan_tengah: null, satuan_distribusi: 'pcs' }, { isGudangPusat: false })).toBe(false)
    expect(sembunyikanKolomBesar({ satuan: 'Dus', satuan_tengah: 'Pack', satuan_distribusi: 'roll' }, { isGudangPusat: false })).toBe(false)
  })
  it('dikirim per satuan besar / tanpa satuan distribusi: tetap tampil', () => {
    expect(sembunyikanKolomBesar({ satuan: 'Kg', satuan_tengah: null, satuan_distribusi: 'kg' }, { isGudangPusat: false })).toBe(false)
    expect(sembunyikanKolomBesar({ ...HAND_GLOVE, satuan_distribusi: null }, { isGudangPusat: false })).toBe(false)
  })
})
