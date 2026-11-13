import { describe, it, expect } from 'vitest'
import { bolehBatalCair, bolehCairkan, type KasbonMenunggu } from './kasbon'
import { itemDariKasbon, JENIS_LABEL, URUTAN_JENIS } from './hub'
import { labelRiwayat } from './riwayat'
import { JENIS_LABEL as JENIS_MUTASI_LABEL, jenisTransaksi } from '@/lib/kas/mutasiRekening'

function kasbon(over: Partial<KasbonMenunggu> = {}): KasbonMenunggu {
  return {
    id: 'k1',
    staff_id: 's1',
    staff_nama: 'Budi',
    outlet_nama: 'SUKA SHAWARMA EMPANG',
    amount: 500000,
    amount_requested: 600000,
    reason: 'Biaya berobat anak',
    installment_months: 2,
    approval_note: null,
    approved_at: '2026-11-13T03:00:00Z',
    approved_by: 'hr1',
    penyetuju_nama: 'Admin HR',
    created_at: '2026-11-12T03:00:00Z',
    ...over,
  }
}

describe('itemDariKasbon', () => {
  it('menjadi item hub jenis kasbon, menunggu sejak HR menyetujui', () => {
    const i = itemDariKasbon(kasbon())
    expect(i.jenis).toBe('kasbon')
    expect(i.key).toBe('kasbon:k1')
    expect(i.judul).toBe('Budi')
    expect(i.nominal).toBe(500000)
    expect(i.menungguSejak).toBe('2026-11-13T03:00:00Z')
    expect(i.keterangan).toContain('SUKA SHAWARMA EMPANG')
    expect(i.keterangan).toContain('2x cicilan')
  })

  it('tanpa approved_at memakai created_at', () => {
    expect(itemDariKasbon(kasbon({ approved_at: null })).menungguSejak).toBe('2026-11-12T03:00:00Z')
  })

  it('jenis kasbon berlabel dan masuk urutan setelah pengeluaran petty cash', () => {
    expect(JENIS_LABEL.kasbon).toBe('Kasbon')
    expect(URUTAN_JENIS.indexOf('kasbon')).toBe(URUTAN_JENIS.indexOf('pengeluaran_petty_cash') + 1)
  })
})

describe('bolehCairkan', () => {
  it('penyetuju HR tidak boleh mencairkan sendiri', () => {
    expect(bolehCairkan({ approved_by: 'u1' }, 'u1')).toEqual({
      boleh: false,
      alasan: 'Anda menyetujui kasbon ini di HR, pencairan harus oleh orang lain',
    })
  })
  it('orang lain boleh', () => {
    expect(bolehCairkan({ approved_by: 'u1' }, 'u2')).toEqual({ boleh: true, alasan: null })
  })
  it('kasbon lama tanpa penyetuju tercatat boleh', () => {
    expect(bolehCairkan({ approved_by: null }, 'u2')).toEqual({ boleh: true, alasan: null })
  })
})

describe('bolehBatalCair', () => {
  it('hanya kasbon aktif yang belum dipotong', () => {
    expect(bolehBatalCair({ status: 'active', amount: 500000, remaining: 500000 })).toBe(true)
    expect(bolehBatalCair({ status: 'active', amount: 500000, remaining: 300000 })).toBe(false)
    expect(bolehBatalCair({ status: 'menunggu_cair', amount: 500000, remaining: 500000 })).toBe(false)
    expect(bolehBatalCair({ status: 'paid_off', amount: 500000, remaining: 0 })).toBe(false)
  })
})

describe('riwayat & mutasi kasbon', () => {
  it('label riwayat kasbon', () => {
    expect(labelRiwayat({ jenis: 'kasbon', keputusan: 'setuju' })).toEqual({ jenis: 'Kasbon', keputusan: 'Dicairkan' })
    expect(labelRiwayat({ jenis: 'kasbon', keputusan: 'batal_cair' }).keputusan).toBe('Pencairan dibatalkan')
    expect(labelRiwayat({ jenis: 'kasbon', keputusan: 'tolak' }).keputusan).toBe('Ditolak')
  })
  it('mutasi rekening mengenali sumber kasbon', () => {
    expect(jenisTransaksi({ source_type: 'kasbon' })).toBe('kasbon')
    expect(JENIS_MUTASI_LABEL.kasbon).toBe('Kasbon')
  })
})
