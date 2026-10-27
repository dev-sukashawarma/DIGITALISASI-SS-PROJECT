import { describe, expect, it } from 'vitest'
import { formatJarak, kalimatOutlet, kesegaranLokasi, labelStop } from './statusStop'
import type { StatusAntarSj, StopRow } from './types'

// 10:12 WIB = 03:12 UTC
const TIBA = '2026-10-27T03:12:00Z'

const stop = (s: Partial<StopRow>): StopRow => ({
  id: 's1', perjalanan_id: 'p1', surat_jalan_id: 'sj1', outlet_id: 'o1', urutan: 1,
  status: 'menunggu', tiba_at: null, tiba_sumber: null, tiba_lat: null, tiba_lng: null,
  tiba_akurasi_m: null, tiba_jarak_m: null, ...s,
})

describe('formatJarak', () => {
  it('meter di bawah 1 km, km satu desimal koma di atasnya', () => {
    expect(formatJarak(35.4)).toBe('35 m')
    expect(formatJarak(999)).toBe('999 m')
    expect(formatJarak(4200)).toBe('4,2 km')
  })
})

describe('labelStop', () => {
  it('tiba oleh driver dekat outlet', () => {
    expect(labelStop(stop({ status: 'tiba', tiba_at: TIBA, tiba_sumber: 'driver', tiba_jarak_m: 35 })))
      .toEqual({ teks: '✓ 10:12 · 35 m', nada: 'ok' })
  })
  it('batas 500 m: 500 ok, 501 peringatan', () => {
    expect(labelStop(stop({ status: 'tiba', tiba_at: TIBA, tiba_sumber: 'driver', tiba_jarak_m: 500 })).nada).toBe('ok')
    expect(labelStop(stop({ status: 'tiba', tiba_at: TIBA, tiba_sumber: 'driver', tiba_jarak_m: 501 })).nada).toBe('peringatan')
  })
  it('jauh dari outlet', () => {
    expect(labelStop(stop({ status: 'tiba', tiba_at: TIBA, tiba_sumber: 'driver', tiba_jarak_m: 4200 })))
      .toEqual({ teks: '⚠ 10:12 · ditekan 4,2 km dari outlet', nada: 'peringatan' })
  })
  it('outlet tanpa koordinat: jarak tidak diketahui, bukan 0 m', () => {
    expect(labelStop(stop({ status: 'tiba', tiba_at: TIBA, tiba_sumber: 'driver', tiba_jarak_m: null })))
      .toEqual({ teks: '✓ 10:12 · jarak tidak diketahui', nada: 'ok' })
  })
  it('tiba dari verifikasi outlet', () => {
    expect(labelStop(stop({ status: 'tiba', tiba_at: TIBA, tiba_sumber: 'verifikasi_outlet' })))
      .toEqual({ teks: '✓ 10:12 · dari verifikasi outlet', nada: 'ok' })
  })
  it('menunggu, tidak ditandai, dibatalkan', () => {
    expect(labelStop(stop({ status: 'menunggu' }))).toEqual({ teks: '○ menunggu', nada: 'netral' })
    expect(labelStop(stop({ status: 'tidak_ditandai' }))).toEqual({ teks: '✗ tidak ditandai tiba', nada: 'buruk' })
    expect(labelStop(stop({ status: 'dibatalkan' }))).toEqual({ teks: '— dibatalkan', nada: 'netral' })
  })
})

describe('kesegaranLokasi', () => {
  const now = new Date('2026-10-27T03:30:00Z')
  const lalu = (detik: number) => new Date(now.getTime() - detik * 1000).toISOString()
  it('ambang 120 dan 600 detik', () => {
    expect(kesegaranLokasi(lalu(119), now).nada).toBe('ok')
    expect(kesegaranLokasi(lalu(120), now).nada).toBe('peringatan')
    expect(kesegaranLokasi(lalu(600), now).nada).toBe('peringatan')
    expect(kesegaranLokasi(lalu(601), now).nada).toBe('buruk')
  })
  it('teks detik, menit, jam', () => {
    expect(kesegaranLokasi(lalu(20), now).teks).toBe('diperbarui 20 dtk lalu')
    expect(kesegaranLokasi(lalu(300), now).teks).toBe('diperbarui 5 mnt lalu')
    expect(kesegaranLokasi(lalu(7200), now).teks).toBe('diperbarui 2 jam lalu')
  })
  it('jam HP sedikit di depan server tidak menghasilkan detik negatif', () => {
    expect(kesegaranLokasi(lalu(-5), now).detik).toBe(0)
  })
})

describe('kalimatOutlet', () => {
  const base: StatusAntarSj = {
    dilacak: true, nama_driver: 'Adam Sandy Rakhman', berangkat_at: '2026-10-27T02:40:00Z',
    status_stop: 'menunggu', tiba_at: null, tiba_sumber: null, outlet_sebelum: 2,
  }
  it('menunggu dengan antrean', () => {
    expect(kalimatOutlet(base)).toBe('Sedang diantar oleh Adam · berangkat 09:40 · 2 outlet lagi sebelum outletmu')
  })
  it('outletmu berikutnya', () => {
    expect(kalimatOutlet({ ...base, outlet_sebelum: 0 })).toBe('Sedang diantar oleh Adam · berangkat 09:40 · outletmu berikutnya')
  })
  it('tiba versi driver dan versi verifikasi', () => {
    expect(kalimatOutlet({ ...base, status_stop: 'tiba', tiba_at: TIBA, tiba_sumber: 'driver' })).toBe('Tiba 10:12')
    expect(kalimatOutlet({ ...base, status_stop: 'tiba', tiba_at: TIBA, tiba_sumber: 'verifikasi_outlet' }))
      .toBe('Tiba 10:12 (dicatat dari verifikasi)')
  })
  it('tidak dilacak, tidak ditandai, dibatalkan → null', () => {
    expect(kalimatOutlet({ ...base, dilacak: false })).toBeNull()
    expect(kalimatOutlet({ ...base, status_stop: 'tidak_ditandai' })).toBeNull()
    expect(kalimatOutlet({ ...base, status_stop: 'dibatalkan' })).toBeNull()
  })
})
