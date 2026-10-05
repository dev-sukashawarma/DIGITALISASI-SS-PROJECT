import { describe, it, expect } from 'vitest'
import { cariSatu, normalisasiOutlet, normalisasiBahan } from './pencarian'

const OUTLETS = ['SUKA SHAWARMA BEJI', 'SUKA SHAWARMA DEPOK SUKMAJAYA', 'MITRA CIBUBUR', 'MITRA SAWANGAN DTC', 'MITRA CIBINONG']
const cariO = (q: string) => cariSatu(q, OUTLETS, (s) => s, normalisasiOutlet)

describe('cari outlet', () => {
  it('cocok tanpa awalan merek', () => {
    expect(cariO('beji')).toEqual({ status: 'cocok', item: 'SUKA SHAWARMA BEJI' })
    expect(cariO('Mitra Cibubur')).toEqual({ status: 'cocok', item: 'MITRA CIBUBUR' })
    expect(cariO('depok')).toEqual({ status: 'cocok', item: 'SUKA SHAWARMA DEPOK SUKMAJAYA' })
    expect(cariO('sawangan')).toEqual({ status: 'cocok', item: 'MITRA SAWANGAN DTC' })
  })
  it('ambigu bila lebih dari satu kecocokan sebagian', () => {
    expect(cariO('cib')).toEqual({ status: 'ambigu', kandidat: ['MITRA CIBUBUR', 'MITRA CIBINONG'] })
  })
  it('tidak_ada', () => {
    expect(cariO('bandung')).toEqual({ status: 'tidak_ada' })
    expect(cariO('   ')).toEqual({ status: 'tidak_ada' })
  })
})

const BAHAN = ['SAOS CABE', 'SAOS CABE POUCH', 'SAPI', 'AYAM', 'KENTANG']
const cariB = (q: string) => cariSatu(q, BAHAN, (s) => s, normalisasiBahan)

describe('cari bahan', () => {
  it('nama persis menang atas kecocokan sebagian', () => {
    expect(cariB('saos cabe')).toEqual({ status: 'cocok', item: 'SAOS CABE' })
  })
  it('kata sebagian yang ambigu → tanya balik', () => {
    expect(cariB('cabe')).toEqual({ status: 'ambigu', kandidat: ['SAOS CABE', 'SAOS CABE POUCH'] })
  })
  it('huruf besar/kecil & spasi diabaikan', () => {
    expect(cariB('  Sapi ')).toEqual({ status: 'cocok', item: 'SAPI' })
  })
})
