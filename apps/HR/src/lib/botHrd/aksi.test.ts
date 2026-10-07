import { describe, expect, it } from 'vitest'
import { SkemaBlokUi, uraiPesan } from './uraiPesan'
import {
  bangunUrl,
  bolehJalankanAksi,
  kunciAksi,
  MAKS_AKSI,
  melebihiBatas,
  nomorUrutAksi,
  pathDiizinkan,
  tanggalSah,
} from './aksi'

const fence = (o: unknown) => '```suka-ui\n' + JSON.stringify(o) + '\n```'
const A = { jenis: 'aksi', label: 'x' }

describe('skema aksi', () => {
  it('menerima setiap aksi sah', () => {
    const sah = [
      { ...A, aksi: 'setujui_cuti', id: 'a' },
      { ...A, aksi: 'tolak_cuti', id: 'a', alasan: 'kuota habis' },
      { ...A, aksi: 'setujui_kasbon', id: 'a' },
      { ...A, aksi: 'tolak_kasbon', id: 'a' },
      { ...A, aksi: 'tolak_kasbon', id: 'a', alasan: 'x' },
      { ...A, aksi: 'tinjau_ceklist', id: 'a', tanggapan: 'ok' },
      { ...A, aksi: 'buka_halaman', path: '/attendance', query: { a: 'b' } },
      { ...A, aksi: 'unduh_rekap_absensi', dari: '2026-10-01', sampai: '2026-10-07', outlet_id: 'o1' },
    ]
    for (const s of sah) expect(SkemaBlokUi.safeParse(s).success, JSON.stringify(s)).toBe(true)
  })
  it('menolak yang tidak sah', () => {
    const buruk = [
      { ...A, aksi: 'tolak_cuti', id: 'a' },
      { ...A, aksi: 'tolak_cuti', id: 'a', alasan: 'ab' },
      { ...A, aksi: 'setujui_cuti' },
      { ...A, aksi: 'setujui_cuti', id: 'a', label: '' },
      { ...A, aksi: 'hapus_semua', id: 'a' },
      { ...A, aksi: 'buka_halaman', path: 'attendance' },
      { ...A, aksi: 'buka_halaman', path: '//evil.com' },
      { ...A, aksi: 'buka_halaman', path: '/x:y' },
      { ...A, aksi: 'unduh_rekap_absensi', dari: '2026-10-09', sampai: '2026-10-01' },
      { ...A, aksi: 'unduh_rekap_absensi', dari: '2026-13-01', sampai: '2026-13-02' },
    ]
    for (const s of buruk) expect(SkemaBlokUi.safeParse(s).success, JSON.stringify(s)).toBe(false)
  })
  it('uraiPesan: aksi sah -> ui, rusak -> ui_rusak', () => {
    const r = uraiPesan(fence({ ...A, aksi: 'setujui_cuti', id: 'a' }) + '\n' + fence({ ...A, aksi: 'tolak_cuti', id: 'a' }))
    expect(r.map((b) => b.jenis)).toEqual(['ui', 'ui_rusak'])
  })
})

describe('skema tawaran', () => {
  const T = { jenis: 'tawaran', teks: 'Mau?', pilihan: [{ label: 'Ya', pesan: 'Ya' }, { label: 'Tidak', pesan: 'Tidak usah' }] }
  it('sah', () => {
    expect(SkemaBlokUi.safeParse(T).success).toBe(true)
    expect(uraiPesan(fence(T))[0]).toMatchObject({ jenis: 'ui', blok: { jenis: 'tawaran' } })
  })
  it('batas', () => {
    expect(SkemaBlokUi.safeParse({ ...T, pilihan: [] }).success).toBe(false)
    expect(SkemaBlokUi.safeParse({ ...T, pilihan: Array(5).fill({ label: 'a', pesan: 'b' }) }).success).toBe(false)
    expect(SkemaBlokUi.safeParse({ ...T, teks: '' }).success).toBe(false)
    expect(SkemaBlokUi.safeParse({ ...T, teks: 'x'.repeat(301) }).success).toBe(false)
    expect(SkemaBlokUi.safeParse({ ...T, pilihan: [{ label: 'x'.repeat(41), pesan: 'b' }] }).success).toBe(false)
    expect(SkemaBlokUi.safeParse({ ...T, pilihan: [{ label: 'a', pesan: '' }] }).success).toBe(false)
  })
})

describe('helper aksi', () => {
  it('pathDiizinkan', () => {
    const nav = ['/', '/attendance', '/perizinan/izin']
    expect(pathDiizinkan('/attendance', nav)).toBe(true)
    expect(pathDiizinkan('/attendance/detail?x=1', nav)).toBe(true)
    expect(pathDiizinkan('/', nav)).toBe(true)
    expect(pathDiizinkan('/admin', nav)).toBe(false)
    expect(pathDiizinkan('/attendancex', nav)).toBe(false)
    expect(pathDiizinkan('//attendance', nav)).toBe(false)
    expect(pathDiizinkan('attendance', nav)).toBe(false)
  })
  it('bangunUrl', () => {
    expect(bangunUrl('/attendance', { a: '1', b: 'x y' })).toBe('/attendance?a=1&b=x+y')
    expect(bangunUrl('/attendance?z=1')).toBe('/attendance')
  })
  it('kunciAksi', () => {
    expect(kunciAksi('p1', 3, 2)).toBe('p1:3:2')
    expect(kunciAksi(null, 1, 0)).toBe('baru:1:0')
  })
  it('nomorUrutAksi & batas 5', () => {
    const b = [
      { jenis: 'teks' },
      ...Array.from({ length: 7 }, () => ({ jenis: 'ui', blok: { jenis: 'aksi' } })),
      { jenis: 'ui', blok: { jenis: 'tabel' } },
    ]
    const n = nomorUrutAksi(b)
    expect(n[0]).toBeNull()
    expect(n[8]).toBeNull()
    expect(n.filter((x) => x !== null && !melebihiBatas(x))).toHaveLength(MAKS_AKSI)
    expect(melebihiBatas(5)).toBe(true)
    expect(melebihiBatas(4)).toBe(false)
  })
  it('role & tanggal', () => {
    expect(bolehJalankanAksi('ADMIN_HR')).toBe(true)
    expect(bolehJalankanAksi('developer')).toBe(true)
    expect(bolehJalankanAksi('CREW')).toBe(false)
    expect(bolehJalankanAksi(null)).toBe(false)
    expect(tanggalSah('2026-02-30')).toBe(false)
    expect(tanggalSah('2026-10-07')).toBe(true)
  })
})
