import { describe, expect, it } from 'vitest'
import { isIgnoredAMStaffName, petaAmAktif } from './petaAm'

const am = (name: string, extra: Partial<{ role: string; status: string }> = {}) => ({
  name,
  role: extra.role ?? 'area_manager',
  status: extra.status ?? 'active',
})

describe('petaAmAktif', () => {
  it('memakai penugasan yang berlaku pada tanggal', () => {
    const peta = petaAmAktif(
      [
        { outlet_id: 'o1', effective_from: '2026-01-01', effective_to: '2026-10-31', outlet_staff: am('AM Lama') },
        { outlet_id: 'o1', effective_from: '2026-11-01', effective_to: null, outlet_staff: am('AM Baru') },
      ],
      '2026-11-13',
    )
    expect(peta.get('o1')).toBe('AM Baru')
  })

  it('mengabaikan penugasan yang belum mulai', () => {
    const peta = petaAmAktif(
      [{ outlet_id: 'o1', effective_from: '2026-12-01', effective_to: null, outlet_staff: am('AM Nanti') }],
      '2026-11-13',
    )
    expect(peta.has('o1')).toBe(false)
  })

  it('mengabaikan staf nonaktif dan role selain area_manager', () => {
    const peta = petaAmAktif(
      [
        { outlet_id: 'o1', effective_from: '2026-01-01', effective_to: null, outlet_staff: am('Mantan AM', { status: 'inactive' }) },
        { outlet_id: 'o2', effective_from: '2026-01-01', effective_to: null, outlet_staff: am('Si Leader', { role: 'leader' }) },
        { outlet_id: 'o3', effective_from: '2026-01-01', effective_to: null, outlet_staff: null },
      ],
      '2026-11-13',
    )
    expect(peta.size).toBe(0)
  })

  it('mengabaikan nama AM dummy', () => {
    const peta = petaAmAktif(
      [{ outlet_id: 'o1', effective_from: '2026-01-01', effective_to: null, outlet_staff: am('Area Manager Test') }],
      '2026-11-13',
    )
    expect(peta.has('o1')).toBe(false)
    expect(isIgnoredAMStaffName('Lainnya')).toBe(true)
    expect(isIgnoredAMStaffName('Tri Rizky')).toBe(false)
  })
})
