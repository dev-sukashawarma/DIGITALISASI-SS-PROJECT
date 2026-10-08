import { describe, it, expect } from 'vitest'
import { buatKonteksMarcomPalsu } from './fixture'
import { hitungEndorsement } from './endorsement'

describe('marcom_endorsement', () => {
  it('menghitung ringkasan endorsement dengan benar', async () => {
    const konteks = buatKonteksMarcomPalsu()
    const hasil = await hitungEndorsement(konteks, {})

    expect(hasil.ringkasan).toEqual({
      total: 4,
      visit_pending: 1, // Budi Kuliner
      draft_pending: 3, // Jessica Foodie (PENDING), Budi Kuliner (PENDING), Doni Makan (REVISION)
      belum_posting: 3, // Jessica Foodie (DRAFT), Budi Kuliner (OFF), Doni Makan (OFF)
      belum_bayar: 3, // Jessica Foodie (UNPAID), Budi Kuliner (DOWN_PAYMENT), Doni Makan (UNPAID)
      total_biaya: 5300000,
    })
    expect(hasil.daftar).toHaveLength(4)
  })

  it('memfilter endorsement berdasarkan status PENDING_DRAFT', async () => {
    const konteks = buatKonteksMarcomPalsu()
    const hasil = await hitungEndorsement(konteks, { status: 'PENDING_DRAFT' })

    expect(hasil.daftar).toHaveLength(2)
    const kolNames = hasil.daftar.map((d) => d.kol_nama)
    expect(kolNames).toContain('Jessica Foodie')
    expect(kolNames).toContain('Budi Kuliner')
  })

  it('memfilter endorsement berdasarkan status UNPAID', async () => {
    const konteks = buatKonteksMarcomPalsu()
    const hasil = await hitungEndorsement(konteks, { status: 'UNPAID' })

    expect(hasil.daftar).toHaveLength(2)
    const kolNames = hasil.daftar.map((d) => d.kol_nama)
    expect(kolNames).toContain('Jessica Foodie')
    expect(kolNames).toContain('Doni Makan')
  })

  it('memfilter endorsement berdasarkan nama outlet', async () => {
    const konteks = buatKonteksMarcomPalsu()
    const hasil = await hitungEndorsement(konteks, { outlet: 'Solo Baru' })

    expect(hasil.daftar).toHaveLength(1)
    expect(hasil.daftar[0].kol_nama).toBe('Budi Kuliner')
    expect(hasil.daftar[0].outlet_nama).toBe('SS Solo Baru')
  })

  it('memfilter endorsement berdasarkan nama KOL', async () => {
    const konteks = buatKonteksMarcomPalsu()
    const hasil = await hitungEndorsement(konteks, { kol_nama: 'Rina' })

    expect(hasil.daftar).toHaveLength(1)
    expect(hasil.daftar[0].kol_nama).toBe('Rina Mukbang')
    expect(hasil.daftar[0].post_status).toBe('POSTED')
  })

  it('tidak membocorkan data rekening bank atau rahasia sensitif', async () => {
    const konteks = buatKonteksMarcomPalsu()
    const hasil = await hitungEndorsement(konteks, {})

    const teksJson = JSON.stringify(hasil)
    expect(teksJson).not.toMatch(/rekening|bank_account|account_number|password|secret/i)
  })
})
