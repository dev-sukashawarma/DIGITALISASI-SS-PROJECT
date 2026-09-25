import { describe, it, expect } from 'vitest'
import {
  tanggalWib,
  indeksRiwayat,
  nilaiHppPada,
  buatPenerapRiwayat,
  type BarisRiwayatHpp,
} from './riwayatHpp'

const AWAL = '2000-01-01'
const baris = (menu_item_id: string, kunci: string, nilai: number | null, berlaku_mulai: string): BarisRiwayatHpp =>
  ({ menu_item_id, kunci, nilai, berlaku_mulai })

describe('tanggalWib', () => {
  it('memakai zona Asia/Jakarta, bukan UTC', () => {
    expect(tanggalWib('2026-09-18T16:59:59Z')).toBe('2026-09-18')
    expect(tanggalWib('2026-09-18T17:00:00Z')).toBe('2026-09-19')
    expect(tanggalWib(new Date('2026-09-18T23:30:00+07:00'))).toBe('2026-09-18')
  })
})

describe('nilaiHppPada', () => {
  const indeks = indeksRiwayat([
    baris('m1', 'hpp_override', 20000, AWAL),
    baris('m1', 'hpp_override', 22000, '2026-09-19'),
    baris('m1', 'ss_online', 25000, AWAL),
    baris('m1', 'gofood', 30000, '2026-09-22'),
    baris('m1', 'ss_online', null, '2026-09-23'),
  ])

  it('memakai nilai terakhir yang berlaku pada tanggal itu', () => {
    expect(nilaiHppPada(indeks, 'm1', '2026-09-18')?.hpp_override).toBe(20000)
    expect(nilaiHppPada(indeks, 'm1', '2026-09-19')?.hpp_override).toBe(22000)
    expect(nilaiHppPada(indeks, 'm1', '2026-09-30')?.hpp_override).toBe(22000)
  })

  it('kunci kanal yang baru ditambah tidak berlaku mundur', () => {
    expect(nilaiHppPada(indeks, 'm1', '2026-09-21')?.channel_hpp).toEqual({ ss_online: 25000 })
    expect(nilaiHppPada(indeks, 'm1', '2026-09-22')?.channel_hpp).toEqual({ ss_online: 25000, gofood: 30000 })
  })

  it('kunci yang direset (null) hilang sejak tanggal berlakunya', () => {
    expect(nilaiHppPada(indeks, 'm1', '2026-09-23')?.channel_hpp).toEqual({ gofood: 30000 })
  })

  it('perubahan satu kunci tidak menghidupkan lagi nilai lama kunci lain', () => {
    expect(nilaiHppPada(indeks, 'm1', '2026-09-22')?.hpp_override).toBe(22000)
  })

  it('menu tanpa riwayat → null', () => {
    expect(nilaiHppPada(indeks, 'tidak-ada', '2026-09-22')).toBeNull()
  })

  it('nilai teks dari PostgREST dikonversi ke angka', () => {
    const i = indeksRiwayat([{ menu_item_id: 'm2', kunci: 'hpp_override', nilai: '15000', berlaku_mulai: AWAL }])
    expect(nilaiHppPada(i, 'm2', '2026-09-01')?.hpp_override).toBe(15000)
  })
})

describe('buatPenerapRiwayat', () => {
  const komponen = { id: 'c1', hpp_override: 5000, channel_hpp: {} }
  const paket = {
    id: 'p1', name: 'Paket Duo', hpp_override: null, channel_hpp: {}, is_package: true,
    package_items: [{ quantity: 2, component: komponen }],
  }
  const menu = { id: 'm1', name: 'Original Sapi Jumbo', hpp_override: 20000, channel_hpp: {}, is_package: false }
  const rows = [
    baris('m1', 'hpp_override', 20000, AWAL),
    baris('m1', 'hpp_override', 22000, '2026-09-19'),
    baris('c1', 'hpp_override', 5000, AWAL),
    baris('c1', 'hpp_override', 6000, '2026-09-19'),
    baris('p1', 'hpp_override', null, AWAL),
  ]
  const penerap = buatPenerapRiwayat([menu, paket, komponen], rows, (n) => n.toLowerCase())

  it('menimpa nilai HPP menu dengan nilai pada tanggal', () => {
    expect(penerap.untuk('2026-09-18').byId.get('m1').hpp_override).toBe(20000)
    expect(penerap.untuk('2026-09-19').byId.get('m1').hpp_override).toBe(22000)
  })

  it('komponen paket ikut ditimpa per tanggal', () => {
    const p18 = penerap.untuk('2026-09-18').byId.get('p1')
    const p19 = penerap.untuk('2026-09-19').byId.get('p1')
    expect(p18.package_items[0].component.hpp_override).toBe(5000)
    expect(p19.package_items[0].component.hpp_override).toBe(6000)
    expect(p19.package_items[0].quantity).toBe(2)
  })

  it('byName memakai kunci nama yang diberikan', () => {
    expect(penerap.untuk('2026-09-19').byName.get('original sapi jumbo').hpp_override).toBe(22000)
  })

  it('terapkan objek hasil join lain (bukan dari daftar menu) tetap ditimpa lewat id', () => {
    const hasilJoin = { id: 'm1', hpp_override: 20000, channel_hpp: {} }
    expect(penerap.untuk('2026-09-19').terapkan(hasilJoin).hpp_override).toBe(22000)
    expect(hasilJoin.hpp_override).toBe(20000) // tidak memutasi objek asal
  })

  it('objek tanpa id atau tanpa riwayat dikembalikan dengan nilai apa adanya', () => {
    const tanpaId = { hpp_override: 1234 }
    expect(penerap.untuk('2026-09-19').terapkan(tanpaId).hpp_override).toBe(1234)
    const tanpaRiwayat = { id: 'lain', hpp_override: 999, channel_hpp: {} }
    expect(penerap.untuk('2026-09-19').terapkan(tanpaRiwayat).hpp_override).toBe(999)
    expect(penerap.untuk('2026-09-19').terapkan(null)).toBeNull()
  })

  it('hasil per tanggal di-cache', () => {
    expect(penerap.untuk('2026-09-19')).toBe(penerap.untuk('2026-09-19'))
  })

  it('objek dari daftar menu diambil dari cache byId (identik)', () => {
    const p = penerap.untuk('2026-09-19')
    expect(p.terapkan(menu)).toBe(p.byId.get('m1'))
  })
})
