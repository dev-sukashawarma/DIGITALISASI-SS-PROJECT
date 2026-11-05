import { describe, expect, it } from 'vitest'
import { lokasiGrup, ringkasGrup, GRUP_LABEL } from './grupKas'
import { hitungSetorBank } from './setorBank'
import { INCOME_KATEGORI, validasiIncome } from './incomeLainnya'
import type { LocationWithBalance } from '../types'

const loc = (p: Partial<LocationWithBalance>): LocationWithBalance => ({
  id: p.id ?? 'x', label: p.label ?? 'x', kind: p.kind ?? 'cash', bank_name: null, account_no: null,
  holder_name: null, scope: 'pusat', outlet_id: null, is_active: p.is_active ?? true, opening_balance: 0,
  opening_date: '2026-11-01', created_at: '', grup: p.grup ?? null, saldo: p.saldo ?? 0,
})

const LOKASI = [
  loc({ id: 'rs', kind: 'bank', grup: 'setoran_outlet', saldo: 1000 }),
  loc({ id: 'ts', kind: 'cash', grup: 'setoran_outlet', saldo: 200 }),
  loc({ id: 'ro', kind: 'bank', grup: 'office', saldo: 30 }),
  loc({ id: 'to', kind: 'cash', grup: 'office', saldo: 4 }),
  loc({ id: 'lama', kind: 'bank', grup: null, is_active: false, saldo: 999999 }),
  loc({ id: 'kecil', kind: 'cash', grup: null, saldo: 77 }),
]

describe('grupKas', () => {
  it('label grup', () => {
    expect(GRUP_LABEL).toEqual({ setoran_outlet: 'Kas Setoran Outlet', office: 'Kas Office' })
  })
  it('lokasiGrup hanya lokasi aktif ber-grup & kind', () => {
    expect(lokasiGrup(LOKASI, 'office', 'cash').map((l) => l.id)).toEqual(['to'])
    expect(lokasiGrup(LOKASI, 'setoran_outlet').map((l) => l.id)).toEqual(['rs', 'ts'])
  })
  it('ringkasGrup abaikan nonaktif & tanpa grup', () => {
    expect(ringkasGrup(LOKASI)).toEqual({
      setoran_outlet: { bank: 1000, tunai: 200, total: 1200 },
      office: { bank: 30, tunai: 4, total: 34 },
    })
  })
})

describe('hitungSetorBank', () => {
  it('receh = diambil - ke bank', () => {
    expect(hitungSetorBank({ saldoTunai: 6_287_500, diambil: 6_287_500, keBank: 6_250_000 }))
      .toEqual({ receh: 37_500, galat: null })
  })
  it('tolak bukan kelipatan 50.000', () => {
    expect(hitungSetorBank({ saldoTunai: 6_287_500, diambil: 6_287_500, keBank: 6_225_000 }).galat)
      .toBe('Nominal ke bank harus kelipatan Rp 50.000')
  })
  it('tolak diambil > saldo', () => {
    expect(hitungSetorBank({ saldoTunai: 100_000, diambil: 150_000, keBank: 100_000 }).galat)
      .toBe('Uang yang diambil melebihi saldo Kas Setoran Tunai')
  })
  it('tolak ke bank > diambil', () => {
    expect(hitungSetorBank({ saldoTunai: 500_000, diambil: 50_000, keBank: 100_000 }).galat)
      .toBe('Nominal ke bank tidak boleh melebihi uang yang diambil')
  })
  it('tolak ke bank 0', () => {
    expect(hitungSetorBank({ saldoTunai: 500_000, diambil: 50_000, keBank: 0 }).galat)
      .toBe('Nominal ke bank harus lebih dari 0')
  })
})

describe('incomeLainnya', () => {
  const dasar = { kategori: 'kardus_bekas' as const, keterangan: '', pembeli: 'Pengepul', amount: 150_000, adaBukti: true }
  it('5 kategori dengan label', () => {
    expect(INCOME_KATEGORI.map((k) => k.label)).toEqual([
      'Minyak Jelantah', 'Kardus Bekas', 'Kompan/Jerigen Bekas', 'Equipment Bekas', 'Lainnya',
    ])
  })
  it('valid', () => expect(validasiIncome(dasar)).toBeNull())
  it('lainnya wajib keterangan', () => {
    expect(validasiIncome({ ...dasar, kategori: 'lainnya', keterangan: '  ' }))
      .toBe('Keterangan wajib diisi untuk kategori Lainnya')
  })
  it('nominal > 0', () => expect(validasiIncome({ ...dasar, amount: 0 })).toBe('Nominal harus lebih dari 0'))
  it('pembeli wajib', () => expect(validasiIncome({ ...dasar, pembeli: ' ' })).toBe('Nama pembeli wajib diisi'))
  it('bukti wajib', () => expect(validasiIncome({ ...dasar, adaBukti: false })).toBe('Bukti wajib dilampirkan'))
})
