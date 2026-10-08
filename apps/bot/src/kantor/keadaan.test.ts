import { tentukanKeadaan, keMeja, type BarisStatus } from '@/kantor/keadaan'

// 2026-10-07 10:00 WIB = 03:00Z
const SIANG = new Date('2026-10-07T03:00:00Z')
const baris = (ubah: Partial<BarisStatus> = {}): BarisStatus => ({
  id: 'k1', nama: 'Bot HRD', scope: ['absensi'], dibuat_at: '2026-10-01T00:00:00Z',
  terakhir_at: null, status_terakhir: null, alat_terakhir: null, panggilan_hari_ini: 0, ...ubah,
})
const mundur = (d: Date, dtk: number) => new Date(d.getTime() - dtk * 1000).toISOString()

describe('tentukanKeadaan', () => {
  it('tanpa log hari ini → tidur', () => {
    expect(tentukanKeadaan(baris(), SIANG)).toBe('tidur')
  })
  it('ok tepat 60 dtk lalu → bekerja', () => {
    expect(tentukanKeadaan(baris({ terakhir_at: mundur(SIANG, 60), status_terakhir: 'ok', panggilan_hari_ini: 1 }), SIANG)).toBe('bekerja')
  })
  it('ok 61 dtk lalu, ada panggilan hari ini → siaga', () => {
    expect(tentukanKeadaan(baris({ terakhir_at: mundur(SIANG, 61), status_terakhir: 'ok', panggilan_hari_ini: 3 }), SIANG)).toBe('siaga')
  })
  it('galat tepat 10 mnt lalu → galat', () => {
    expect(tentukanKeadaan(baris({ terakhir_at: mundur(SIANG, 600), status_terakhir: 'galat', panggilan_hari_ini: 1 }), SIANG)).toBe('galat')
  })
  it('ditolak 10 mnt + 1 dtk lalu → jatuh ke siaga', () => {
    expect(tentukanKeadaan(baris({ terakhir_at: mundur(SIANG, 601), status_terakhir: 'ditolak', panggilan_hari_ini: 1 }), SIANG)).toBe('siaga')
  })
  it('galat baru menang atas aturan lain, juga di malam hari', () => {
    const malam = new Date('2026-10-07T16:30:00Z') // 23:30 WIB
    expect(tentukanKeadaan(baris({ terakhir_at: mundur(malam, 5), status_terakhir: 'ditolak', panggilan_hari_ini: 1 }), malam)).toBe('galat')
  })
  it('bekerja di 23:30 WIB tetap bekerja', () => {
    const malam = new Date('2026-10-07T16:30:00Z')
    expect(tentukanKeadaan(baris({ terakhir_at: mundur(malam, 10), status_terakhir: 'ok', panggilan_hari_ini: 1 }), malam)).toBe('bekerja')
  })
  it('jam tidur: 06:59 WIB tidur, 07:00 WIB siaga', () => {
    const b = baris({ terakhir_at: '2026-10-06T10:00:00Z', status_terakhir: 'ok', panggilan_hari_ini: 2 })
    expect(tentukanKeadaan(b, new Date('2026-10-06T23:59:00Z'))).toBe('tidur') // 06:59 WIB
    expect(tentukanKeadaan(b, new Date('2026-10-07T00:00:00Z'))).toBe('siaga') // 07:00 WIB
  })
  it('jam tidur: 22:59 WIB siaga, 23:00 WIB tidur', () => {
    const b = baris({ terakhir_at: '2026-10-07T05:00:00Z', status_terakhir: 'ok', panggilan_hari_ini: 2 })
    expect(tentukanKeadaan(b, new Date('2026-10-07T15:59:00Z'))).toBe('siaga')
    expect(tentukanKeadaan(b, new Date('2026-10-07T16:00:00Z'))).toBe('tidur')
  })
})

describe('keMeja', () => {
  it('memetakan kolom & menghitung keadaan', () => {
    const b = baris({ terakhir_at: mundur(SIANG, 5), status_terakhir: 'ok', alat_terakhir: 'rekap_absensi', panggilan_hari_ini: 1 })
    expect(keMeja(b, SIANG)).toEqual({
      id: 'k1', nama: 'Bot HRD', scope: ['absensi'], keadaan: 'bekerja',
      alatTerakhir: 'rekap_absensi', terakhirAt: b.terakhir_at,
    })
  })
})
