import { describe, it, expect } from 'vitest'
import { alpaVirtual, jumlahHariRekap, alpaDariHariHadir, type BarisHadir } from './rekap'

const staff = [{ id: 'a', name: 'Andi' }, { id: 'b', name: 'Budi' }]
const baris: BarisHadir[] = [
  { outlet_staff_id: 'a', ts_server: '2026-10-05T13:00:00+07:00', status: 'tepat' },
  { outlet_staff_id: 'a', ts_server: '2026-10-06T13:20:00+07:00', status: 'telat' },
  { outlet_staff_id: 'b', ts_server: '2026-10-06T13:00:00+07:00', status: 'alpha' }, // alpha tersimpan tak dihitung hadir
  { outlet_staff_id: 'b', ts_server: '2026-10-05T23:30:00+07:00', status: 'tepat' },
]

describe('alpa virtual (aturan layar Rekap)', () => {
  it('staf tanpa absen non-alpha pada suatu hari WIB = alpa; hari depan dilewati', () => {
    const hasil = alpaVirtual(staff, baris, '2026-10-05', '2026-10-09', '2026-10-07')
    expect(hasil).toEqual([
      { staffId: 'b', nama: 'Budi', tanggal: '2026-10-06' },
      { staffId: 'a', nama: 'Andi', tanggal: '2026-10-07' },
      { staffId: 'b', nama: 'Budi', tanggal: '2026-10-07' },
    ])
  })
  it('jumlah hari dipotong di hari ini; alpa = hari − hari hadir, setara alpaVirtual', () => {
    expect(jumlahHariRekap('2026-10-05', '2026-10-09', '2026-10-07')).toBe(3)
    expect(alpaDariHariHadir('2026-10-05', '2026-10-09', '2026-10-07', 2)).toBe(1)
    const perStaf = (id: string) => alpaVirtual(staff, baris, '2026-10-05', '2026-10-09', '2026-10-07').filter((x) => x.staffId === id).length
    expect(perStaf('a')).toBe(alpaDariHariHadir('2026-10-05', '2026-10-09', '2026-10-07', 2))
    expect(perStaf('b')).toBe(alpaDariHariHadir('2026-10-05', '2026-10-09', '2026-10-07', 1))
  })
  it('hari hadir tak pernah membuat alpa negatif', () => {
    expect(alpaDariHariHadir('2026-10-05', '2026-10-05', '2026-10-07', 3)).toBe(0)
  })
})

describe('pengecualian rekap', () => {
  it('alpaVirtual melewati (staf, tanggal) yang dikecualikan', () => {
    const hasil = alpaVirtual(staff, baris, '2026-10-05', '2026-10-07', '2026-10-07', (id, t) => id === 'b' && t === '2026-10-06')
    expect(hasil).toEqual([
      { staffId: 'a', nama: 'Andi', tanggal: '2026-10-07' },
      { staffId: 'b', nama: 'Budi', tanggal: '2026-10-07' },
    ])
  })
  it('alpaDariHariHadir mengurangi hari dikecualikan, tak negatif', () => {
    expect(alpaDariHariHadir('2026-10-01', '2026-10-07', '2026-10-07', 3, 2)).toBe(2)
    expect(alpaDariHariHadir('2026-10-01', '2026-10-07', '2026-10-07', 3, 99)).toBe(0)
  })
})
