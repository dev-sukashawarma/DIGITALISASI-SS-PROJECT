import { describe, it, expect } from 'vitest'
import { idsDariKiosk, terapkanKetersediaanOutlet, PUSAT_OUTLET_ID } from './menuHabisOutlet'

const O = 'outlet-a'
const item = (id: string, ubah: Record<string, unknown> = {}) => ({ id, is_available: true, available_outlets: null, ...ubah })

describe('idsDariKiosk', () => {
  it('baris outlet sendiri menang atas PUSAT', () => {
    const b = [
      { outlet_id: PUSAT_OUTLET_ID, key: 'unavailable_menu_ids', value: '["x"]' },
      { outlet_id: O, key: 'unavailable_menu_ids', value: '["y"]' },
    ]
    expect(idsDariKiosk(b, O, 'unavailable_menu_ids')).toEqual(['y'])
  })
  it('tanpa baris outlet, jatuh ke PUSAT (perilaku POS)', () => {
    const b = [{ outlet_id: PUSAT_OUTLET_ID, key: 'unavailable_menu_ids', value: '["x"]' }]
    expect(idsDariKiosk(b, O, 'unavailable_menu_ids')).toEqual(['x'])
  })
  it('nilai rusak atau bukan array -> kosong, tidak melempar', () => {
    expect(idsDariKiosk([{ outlet_id: O, key: 'k', value: 'bukan json' }], O, 'k')).toEqual([])
    expect(idsDariKiosk([{ outlet_id: O, key: 'k', value: '{"a":1}' }], O, 'k')).toEqual([])
  })
})

describe('terapkanKetersediaanOutlet', () => {
  it('buang item yang available_outlets tak memuat outlet ini', () => {
    const hasil = terapkanKetersediaanOutlet([item('a', { available_outlets: ['lain'] }), item('b')], O, [])
    expect(hasil.map((i) => i.id)).toEqual(['b'])
  })
  it('available_outlets kosong [] berarti semua outlet (sama dengan POS)', () => {
    expect(terapkanKetersediaanOutlet([item('a', { available_outlets: [] })], O, []).length).toBe(1)
  })
  it('unavailable menandai habis, item tetap dikirim', () => {
    const kiosk = [{ outlet_id: O, key: 'unavailable_menu_ids', value: '["a"]' }]
    const hasil = terapkanKetersediaanOutlet([item('a')], O, kiosk)
    expect(hasil).toHaveLength(1)
    expect(hasil[0].is_available).toBe(false)
  })
  it('auto_unavailable dikalahkan force_available; manual unavailable tidak', () => {
    const kiosk = [
      { outlet_id: O, key: 'auto_unavailable_menu_ids', value: '["a","b"]' },
      { outlet_id: O, key: 'force_available_menu_ids', value: '["a","c"]' },
      { outlet_id: O, key: 'unavailable_menu_ids', value: '["c"]' },
    ]
    const hasil = terapkanKetersediaanOutlet([item('a'), item('b'), item('c')], O, kiosk)
    expect(hasil.map((i) => [i.id, i.is_available])).toEqual([['a', true], ['b', false], ['c', false]])
  })
  it('tak pernah menyalakan item yang is_available=false secara global', () => {
    const kiosk = [{ outlet_id: O, key: 'force_available_menu_ids', value: '["a"]' }]
    expect(terapkanKetersediaanOutlet([item('a', { is_available: false })], O, kiosk)[0].is_available).toBe(false)
  })
})
