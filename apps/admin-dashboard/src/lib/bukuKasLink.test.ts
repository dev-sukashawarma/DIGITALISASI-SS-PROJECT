import { describe, expect, it } from 'vitest'
import { bukuKasHref, bukuKasHrefKartu, BUKU_KAS_PARAMS, pettyCashHref, PETTY_CASH_PARAMS } from './bukuKasLink'

describe('bukuKasHref', () => {
  it('membawa periode dan outlet yang sedang dipilih', () => {
    const href = bukuKasHref({ from: '2026-09-01', to: '2026-09-07', outletId: 'outlet-1' })
    expect(href).toBe('/dashboard/reports/input-pengeluaran?from=2026-09-01&to=2026-09-07&outlet=outlet-1')
  })

  it('meneruskan "all" apa adanya', () => {
    expect(bukuKasHref({ from: '2026-09-01', to: '2026-09-07', outletId: 'all' })).toContain('outlet=all')
  })

  it('menghilangkan tanggal yang kosong ketimbang mengirim string kosong', () => {
    const href = bukuKasHref({ from: '', to: '', outletId: 'all' })
    expect(href).toBe('/dashboard/reports/input-pengeluaran?outlet=all')
  })

  it('nama parameternya satu sumber, dipakai pengirim maupun penerima', () => {
    // Halaman Buku Kas membaca URL memakai konstanta yang sama. Kalau ada yang
    // mengganti nama parameter di satu sisi saja, test ini yang merah duluan.
    expect(BUKU_KAS_PARAMS).toEqual({ from: 'from', to: 'to', outlet: 'outlet', source: 'sumber', category: 'kategori' })
    const href = bukuKasHref({ from: '2026-01-01', to: '2026-01-31', outletId: 'x' })
    const q = new URLSearchParams(href.split('?')[1])
    expect(q.get(BUKU_KAS_PARAMS.from)).toBe('2026-01-01')
    expect(q.get(BUKU_KAS_PARAMS.to)).toBe('2026-01-31')
    expect(q.get(BUKU_KAS_PARAMS.outlet)).toBe('x')
  })
})

describe('bukuKasHref dengan tab Laba Rugi', () => {
  const f = { from: '2026-10-01', to: '2026-10-13', outletId: 'all' }
  it('tab Mitra/Internal dengan semua outlet membuka kelompok yang sama di Buku Kas', () => {
    expect(bukuKasHref(f, 'mitra')).toContain('outlet=MITRA_OUTLETS')
    expect(bukuKasHref(f, 'internal')).toContain('outlet=INTERNAL_OUTLETS')
    expect(bukuKasHref(f, 'all')).toContain('outlet=all')
  })
  it('satu outlet terpilih tetap membawa outlet itu', () => {
    expect(bukuKasHref({ ...f, outletId: 'outlet-1' }, 'mitra')).toContain('outlet=outlet-1')
  })
})

describe('bukuKasHrefKartu', () => {
  const f = { from: '2026-10-01', to: '2026-10-13', outletId: 'all' }
  const p = (href: string) => new URLSearchParams(href.split('?')[1])
  it('kartu bulanan & kas kecil membawa sumber, lembur membawa kategori', () => {
    expect(p(bukuKasHrefKartu(f, 'internal', 'bulanan')).get('sumber')).toBe('monthly')
    expect(p(bukuKasHrefKartu(f, 'internal', 'bulanan')).get('outlet')).toBe('INTERNAL_OUTLETS')
    expect(p(bukuKasHrefKartu(f, 'mitra', 'kasKecil')).get('sumber')).toBe('petty_cash')
    expect(p(bukuKasHrefKartu(f, 'mitra', 'kasKecil')).get('outlet')).toBe('MITRA_OUTLETS')
    expect(p(bukuKasHrefKartu(f, 'all', 'lembur')).get('kategori')).toBe('lembur')
    expect(p(bukuKasHrefKartu(f, 'all', 'lembur')).get('outlet')).toBe('ALL_OUTLETS')
  })
  it('kartu pusat membuka Kantor Pusat; total membuka cakupan penuh tab', () => {
    expect(p(bukuKasHrefKartu(f, 'internal', 'pusat')).get('outlet')).toBe('PUSAT')
    expect(p(bukuKasHrefKartu(f, 'internal', 'total')).get('outlet')).toBe('INTERNAL_PUSAT')
    expect(p(bukuKasHrefKartu(f, 'mitra', 'total')).get('outlet')).toBe('MITRA_OUTLETS')
    expect(p(bukuKasHrefKartu(f, 'all', 'total')).get('outlet')).toBe('all')
  })
  it('satu outlet terpilih tetap membawa outlet itu', () => {
    expect(p(bukuKasHrefKartu({ ...f, outletId: 'o-1' }, 'internal', 'bulanan')).get('outlet')).toBe('o-1')
    expect(p(bukuKasHrefKartu({ ...f, outletId: 'o-1' }, 'internal', 'total')).get('outlet')).toBe('o-1')
  })
})

describe('pettyCashHref', () => {
  it('membawa periode dan outlet yang sedang dipilih ke halaman petty cash', () => {
    const href = pettyCashHref({ from: '2026-09-01', to: '2026-09-07', outletId: 'outlet-1' })
    expect(href).toBe('/dashboard/owner/petty-cash?from=2026-09-01&to=2026-09-07&outletId=outlet-1')
  })

  it('meneruskan "all" apa adanya', () => {
    expect(pettyCashHref({ from: '2026-09-01', to: '2026-09-07', outletId: 'all' })).toContain('outletId=all')
  })

  it('nama parameternya konsisten dengan PettyCashOwnerPage', () => {
    expect(PETTY_CASH_PARAMS).toEqual({ from: 'from', to: 'to', outletId: 'outletId' })
    const href = pettyCashHref({ from: '2026-01-01', to: '2026-01-31', outletId: 'x' })
    const q = new URLSearchParams(href.split('?')[1])
    expect(q.get(PETTY_CASH_PARAMS.from)).toBe('2026-01-01')
    expect(q.get(PETTY_CASH_PARAMS.to)).toBe('2026-01-31')
    expect(q.get(PETTY_CASH_PARAMS.outletId)).toBe('x')
  })
})
