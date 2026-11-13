import { describe, expect, it } from 'vitest'
import { hitungMundur, petakanStatusPersiapan, ringkasLangkahWajib, tanggalGoLiveBawaan } from './petakan'

const mentah = {
  outlet_id: 'o1',
  nama: 'MITRA BEKASI TIMUR',
  jenis: 'mitra',
  status: 'pending',
  tanggal_grand_opening: '2026-12-01',
  siap_go_live: false,
  langkah: [
    { kunci: 'data_outlet', label: 'Data outlet, peta, jam buka', penanggung_jawab: 'Admin', wajib: true, selesai: true, info: null },
    { kunci: 'stok_awal', label: 'Stok awal dikirim & diverifikasi', penanggung_jawab: 'Kitchen', wajib: true, selesai: false, info: 'Belum ada surat jalan' },
    { kunci: 'leader', label: 'Leader ditautkan', penanggung_jawab: 'Admin / HR', wajib: false, selesai: false, info: null },
  ],
}

describe('petakanStatusPersiapan', () => {
  it('memetakan jsonb RPC ke bentuk camelCase', () => {
    const s = petakanStatusPersiapan(mentah)
    expect(s.outletId).toBe('o1')
    expect(s.tanggalGrandOpening).toBe('2026-12-01')
    expect(s.siapGoLive).toBe(false)
    expect(s.langkah[1]).toEqual({
      kunci: 'stok_awal', label: 'Stok awal dikirim & diverifikasi', penanggungJawab: 'Kitchen',
      wajib: true, selesai: false, info: 'Belum ada surat jalan',
    })
  })
})

describe('ringkasLangkahWajib', () => {
  it('menghitung wajib selesai dan menyebut wajib pertama yang tertahan', () => {
    expect(ringkasLangkahWajib(petakanStatusPersiapan(mentah).langkah)).toEqual({
      selesai: 1, total: 2, tertahan: 'Stok awal dikirim & diverifikasi',
    })
  })
})

describe('hitungMundur', () => {
  it('H-n sebelum grand opening', () => {
    expect(hitungMundur('2026-12-01', '2026-11-26')).toBe('H-5')
  })
  it('hari H', () => {
    expect(hitungMundur('2026-12-01', '2026-12-01')).toBe('Hari H')
  })
  it('lewat tanggal', () => {
    expect(hitungMundur('2026-12-01', '2026-12-03')).toBe('Lewat 2 hari')
  })
  it('tanpa tanggal', () => {
    expect(hitungMundur(null, '2026-12-03')).toBe('Belum ditentukan')
  })
})

describe('tanggalGoLiveBawaan', () => {
  it('memakai tanggal grand opening bila masih dalam 7 hari', () => {
    expect(tanggalGoLiveBawaan('2026-12-01', '2026-11-28')).toBe('2026-12-01')
    expect(tanggalGoLiveBawaan('2026-12-01', '2026-12-05')).toBe('2026-12-01')
  })
  it('jatuh ke hari ini bila grand opening jauh atau kosong', () => {
    expect(tanggalGoLiveBawaan('2026-12-20', '2026-12-01')).toBe('2026-12-01')
    expect(tanggalGoLiveBawaan(null, '2026-12-01')).toBe('2026-12-01')
  })
})
