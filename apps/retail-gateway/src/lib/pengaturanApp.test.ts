import { describe, it, expect } from 'vitest'
import { petakanPengaturan, PENGATURAN_BAWAAN } from './pengaturanApp'

describe('petakanPengaturan', () => {
  it('memetakan baris DB', () => {
    expect(petakanPengaturan({
      menit_pesan_terakhir: 45, estimasi_siap: '10 menit', wa_cs: '6281234567890',
      versi_minimum_android: 3, url_syarat: 'https://a', url_privasi: null,
    })).toEqual({
      menitPesanTerakhir: 45, estimasiSiap: '10 menit', waCs: '6281234567890',
      versiMinimumAndroid: 3, urlSyarat: 'https://a', urlPrivasi: null,
    })
  })
  it('baris kosong / rusak -> bawaan, bukan buka 24 jam', () => {
    expect(petakanPengaturan(null)).toEqual(PENGATURAN_BAWAAN)
    expect(petakanPengaturan({ menit_pesan_terakhir: 'abc' }).menitPesanTerakhir).toBe(30)
  })
})
