import { describe, it, expect } from 'vitest'
import { batasAwalBerlaku } from './batasBerlakuHpp'

describe('batasAwalBerlaku', () => {
  it('tanggal 1–10: boleh mundur ke tanggal 1 bulan lalu', () => {
    expect(batasAwalBerlaku('2026-10-10')).toBe('2026-09-01')
    expect(batasAwalBerlaku('2026-10-01')).toBe('2026-09-01')
  })
  it('setelah tanggal 10: hanya bulan berjalan', () => {
    expect(batasAwalBerlaku('2026-10-11')).toBe('2026-10-01')
    expect(batasAwalBerlaku('2026-09-25')).toBe('2026-09-01')
  })
  it('Januari mundur ke Desember tahun lalu', () => {
    expect(batasAwalBerlaku('2027-01-05')).toBe('2026-12-01')
  })
})
