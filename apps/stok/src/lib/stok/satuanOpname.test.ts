import { describe, it, expect } from 'vitest'
import { sembunyikanKolomBesar, adaSatuanKecil } from './satuanOpname'

const HAND_GLOVE = { nama: 'HAND GLOVE', satuan: 'Dus', satuan_tengah: 'Box', satuan_distribusi: 'box' }

describe('adaSatuanKecil', () => {
  it('true bila satuan_kecil terdefinisi dan berbeda dari satuan besar', () => {
    expect(adaSatuanKecil({ satuan: 'Dus', satuan_kecil: 'Pcs' })).toBe(true)
    expect(adaSatuanKecil({ satuan: 'Pack', satuan_kecil: 'Lembar' })).toBe(true)
  })
  it('false bila satuan_kecil sama dengan satuan besar (mis. Aqua Pcs/Pcs)', () => {
    expect(adaSatuanKecil({ satuan: 'Pcs', satuan_kecil: 'Pcs' })).toBe(false)
    expect(adaSatuanKecil({ satuan: 'pcs', satuan_kecil: 'PCS' })).toBe(false)
  })
  it('false bila satuan_kecil null atau kosong', () => {
    expect(adaSatuanKecil({ satuan: 'Pcs', satuan_kecil: null })).toBe(false)
    expect(adaSatuanKecil({ satuan: 'Pcs', satuan_kecil: '' })).toBe(false)
  })
})


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
