// Label & kalimat pelacakan driver (murni, tanpa React).
import type { StatusAntarSj, StopRow } from './types'

export type Nada = 'ok' | 'peringatan' | 'buruk' | 'netral'

/** Tiba di atas jarak ini dianggap "ditekan jauh dari outlet". */
export const JARAK_JAUH_M = 500
/** Kesegaran posisi: < 2 mnt normal, 2–10 mnt kuning, > 10 mnt merah. */
export const SEGAR_DETIK = 120
export const BASI_DETIK = 600

const jamWib = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false,
})

/** "HH:mm" WIB. */
export function formatJamWib(iso: string): string {
  return jamWib.format(new Date(iso))
}

export function formatJarak(meter: number): string {
  if (meter < 1000) return `${Math.round(meter)} m`
  return `${(meter / 1000).toFixed(1).replace('.', ',')} km`
}

export function labelStop(stop: StopRow): { teks: string; nada: Nada } {
  switch (stop.status) {
    case 'menunggu':
      return { teks: '○ menunggu', nada: 'netral' }
    case 'tidak_ditandai':
      return { teks: '✗ tidak ditandai tiba', nada: 'buruk' }
    case 'dibatalkan':
      return { teks: '— dibatalkan', nada: 'netral' }
    case 'tiba': {
      const jam = stop.tiba_at ? formatJamWib(stop.tiba_at) : '--:--'
      if (stop.tiba_sumber === 'verifikasi_outlet') return { teks: `✓ ${jam} · dari verifikasi outlet`, nada: 'ok' }
      if (stop.tiba_jarak_m == null) return { teks: `✓ ${jam} · jarak tidak diketahui`, nada: 'ok' }
      if (stop.tiba_jarak_m > JARAK_JAUH_M) {
        return { teks: `⚠ ${jam} · ditekan ${formatJarak(stop.tiba_jarak_m)} dari outlet`, nada: 'peringatan' }
      }
      return { teks: `✓ ${jam} · ${formatJarak(stop.tiba_jarak_m)}`, nada: 'ok' }
    }
  }
}

/** Umur posisi driver. `waktu` = direkam_at (umur posisi, bukan umur kiriman). */
export function kesegaranLokasi(waktu: string, now: Date = new Date()): { detik: number; nada: Exclude<Nada, 'netral'>; teks: string } {
  const detik = Math.max(0, Math.floor((now.getTime() - new Date(waktu).getTime()) / 1000))
  const nada = detik < SEGAR_DETIK ? 'ok' : detik <= BASI_DETIK ? 'peringatan' : 'buruk'
  const teks =
    detik < 60 ? `diperbarui ${detik} dtk lalu`
    : detik < 3600 ? `diperbarui ${Math.floor(detik / 60)} mnt lalu`
    : `diperbarui ${Math.floor(detik / 3600)} jam lalu`
  return { detik, nada, teks }
}

const namaDepan = (nama: string | null) => (nama ?? 'driver').trim().split(/\s+/)[0]

/** Kalimat status antar untuk outlet penerima; null = tidak menampilkan apa pun. */
export function kalimatOutlet(s: StatusAntarSj): string | null {
  if (!s.dilacak) return null
  if (s.status_stop === 'menunggu') {
    const berangkat = s.berangkat_at ? ` · berangkat ${formatJamWib(s.berangkat_at)}` : ''
    const antre = (s.outlet_sebelum ?? 0) > 0
      ? `${s.outlet_sebelum} outlet lagi sebelum outletmu`
      : 'outletmu berikutnya'
    return `Sedang diantar oleh ${namaDepan(s.nama_driver)}${berangkat} · ${antre}`
  }
  if (s.status_stop === 'tiba' && s.tiba_at) {
    return `Tiba ${formatJamWib(s.tiba_at)}${s.tiba_sumber === 'verifikasi_outlet' ? ' (dicatat dari verifikasi)' : ''}`
  }
  return null
}
