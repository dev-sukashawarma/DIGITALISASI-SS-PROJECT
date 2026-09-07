import { describe, expect, it } from 'vitest'
import { bukuKasHref, BUKU_KAS_PARAMS } from './bukuKasLink'

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
    expect(BUKU_KAS_PARAMS).toEqual({ from: 'from', to: 'to', outlet: 'outlet' })
    const href = bukuKasHref({ from: '2026-01-01', to: '2026-01-31', outletId: 'x' })
    const q = new URLSearchParams(href.split('?')[1])
    expect(q.get(BUKU_KAS_PARAMS.from)).toBe('2026-01-01')
    expect(q.get(BUKU_KAS_PARAMS.to)).toBe('2026-01-31')
    expect(q.get(BUKU_KAS_PARAMS.outlet)).toBe('x')
  })
})
