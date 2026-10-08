import { validasiInputKunci, validasiScope } from './validasi'

describe('validasiInputKunci', () => {
  it('menerima input benar dan merapikannya', () => {
    expect(validasiInputKunci({ nama: '  Bot CEO ', scope: ['penjualan', 'stok', 'penjualan'], ip: [' 76.13.193.138 '] }))
      .toEqual({ ok: true, nama: 'Bot CEO', scope: ['penjualan', 'stok'], ip: ['76.13.193.138'] })
  })
  it('menolak nama pendek, scope kosong/asing, IP salah, terlalu banyak IP', () => {
    expect(validasiInputKunci({ nama: 'ab', scope: ['penjualan'], ip: ['1.1.1.1'] }).ok).toBe(false)
    expect(validasiInputKunci({ nama: 'Bot', scope: [], ip: ['1.1.1.1'] }).ok).toBe(false)
    expect(validasiInputKunci({ nama: 'Bot', scope: ['gaji'], ip: ['1.1.1.1'] }).ok).toBe(false)
    expect(validasiInputKunci({ nama: 'Bot', scope: ['penjualan'], ip: ['x'] }).ok).toBe(false)
    expect(validasiInputKunci({ nama: 'Bot', scope: ['penjualan'], ip: Array.from({ length: 11 }, (_, i) => `1.1.1.${i}`) }).ok).toBe(false)
  })
  it('IP boleh kosong (kunci dibuat dulu, IP diisi setelah terlihat di log)', () => {
    expect(validasiInputKunci({ nama: 'Bot', scope: ['penjualan'], ip: [] })).toMatchObject({ ok: true, ip: [] })
  })
})

describe('validasiScope', () => {
  it('dedup & urut sesuai DOMAIN', () => {
    expect(validasiScope(['sistem', 'penjualan', 'sistem'])).toEqual({ ok: true, scope: ['penjualan', 'sistem'] })
  })
  it('kosong, bukan array, atau nilai asing ditolak', () => {
    expect(validasiScope([]).ok).toBe(false)
    expect(validasiScope('penjualan').ok).toBe(false)
    expect(validasiScope(['gudang']).ok).toBe(false)
  })
})
