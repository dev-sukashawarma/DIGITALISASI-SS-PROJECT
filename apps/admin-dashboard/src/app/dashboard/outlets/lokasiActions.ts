'use server'

import { requireRole } from '@/lib/authz'
import {
  bacaTempelanLokasi, hostGoogleMapsDiizinkan, titikDariUrlMaps,
  type HasilBacaLink, type TitikDariLink,
} from '@/lib/lokasi/googleMapsLink'
import { formatAlamat, type AlamatNominatim } from '@/lib/lokasi/formatAlamat'

export type HasilLokasi =
  | { ok: true; lat: number; lng: number; akurasi: TitikDariLink['akurasi']; alamat: string | null; namaTempat: string | null }
  | { ok: false; pesan: string }

const UA_DESKTOP =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
// Kebijakan Nominatim: wajib User-Agent yang mengidentifikasi aplikasi, maks 1 req/dtk.
const UA_NOMINATIM = 'SukaShawarma-AdminDashboard/1.0 (+https://admin.sukashawarma.com)'

const PESAN_TANPA_KOORDINAT =
  'Link ini tidak memuat titik lokasi. Di Google Maps, tekan lama tepat di lokasi outlet sampai muncul pin merah, lalu Bagikan → Salin link, dan tempel di sini.'

/** Ikuti redirect link pendek (maps.app.goo.gl) tanpa mengunduh halaman, hanya ke host Google. */
async function ikutiLinkPendek(awal: string): Promise<HasilBacaLink> {
  let url = awal
  for (let hop = 0; hop < 6; hop++) {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      headers: { 'User-Agent': UA_DESKTOP, 'Accept-Language': 'id' },
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
    })
    const lokasi = res.headers.get('location')
    res.body?.cancel().catch(() => {})
    if (res.status < 300 || res.status >= 400 || !lokasi) break
    const berikut = new URL(lokasi, url)
    if (berikut.protocol !== 'https:' || !hostGoogleMapsDiizinkan(berikut.hostname)) {
      return { jenis: 'bukan_link_maps' }
    }
    const hasil = bacaTempelanLokasi(berikut.toString())
    if (hasil.jenis !== 'link_pendek') return hasil
    url = berikut.toString()
  }
  // Masih berhenti di host Google tanpa redirect lanjutan: coba baca URL terakhir.
  try {
    const u = new URL(url)
    const t = titikDariUrlMaps(u)
    if (t) return { jenis: 'titik', titik: t, namaTempat: null }
  } catch {}
  return { jenis: 'tanpa_koordinat', namaTempat: null }
}

// Cache kecil per proses + jeda antar-panggilan (aturan 1 req/dtk Nominatim).
const cacheAlamat = new Map<string, string | null>()
let antrean: Promise<unknown> = Promise.resolve()
let terakhir = 0

async function alamatDariTitik(lat: number, lng: number): Promise<string | null> {
  const kunci = `${lat.toFixed(5)},${lng.toFixed(5)}`
  if (cacheAlamat.has(kunci)) return cacheAlamat.get(kunci) ?? null

  const kerja = antrean.then(async () => {
    const tunggu = terakhir + 1100 - Date.now()
    if (tunggu > 0) await new Promise((r) => setTimeout(r, tunggu))
    terakhir = Date.now()
    const q = new URLSearchParams({
      format: 'jsonv2', lat: String(lat), lon: String(lng),
      zoom: '18', addressdetails: '1', 'accept-language': 'id',
    })
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${q}`, {
      headers: { 'User-Agent': UA_NOMINATIM },
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
    })
    if (!res.ok) return null
    const json = (await res.json()) as { address?: AlamatNominatim }
    return formatAlamat(json.address)
  })
  antrean = kerja.catch(() => null)

  try {
    const alamat = await kerja
    if (cacheAlamat.size > 300) cacheAlamat.delete(cacheAlamat.keys().next().value as string)
    cacheAlamat.set(kunci, alamat)
    return alamat
  } catch {
    return null // alamat gagal tidak membatalkan koordinat
  }
}

/** Tempel link Google Maps (atau koordinat) → titik akurat + alamat yang bisa dibaca. */
export async function resolveLokasiGoogleMaps(input: string): Promise<HasilLokasi> {
  await requireRole(['admin', 'owner'])
  if (typeof input !== 'string' || input.length > 2000) {
    return { ok: false, pesan: 'Tempelan terlalu panjang atau tidak valid.' }
  }

  let hasil = bacaTempelanLokasi(input)
  if (hasil.jenis === 'link_pendek') {
    try {
      hasil = await ikutiLinkPendek(hasil.url)
    } catch {
      return { ok: false, pesan: 'Gagal membuka link Google Maps. Coba lagi, atau tempel link lengkapnya.' }
    }
  }

  if (hasil.jenis === 'bukan_link_maps') {
    return { ok: false, pesan: 'Bukan link Google Maps. Tempel link dari tombol Bagikan di Google Maps.' }
  }
  if (hasil.jenis === 'tanpa_koordinat') return { ok: false, pesan: PESAN_TANPA_KOORDINAT }
  if (hasil.jenis !== 'titik') return { ok: false, pesan: PESAN_TANPA_KOORDINAT }

  const { lat, lng, akurasi } = hasil.titik
  const alamat = await alamatDariTitik(lat, lng)
  return { ok: true, lat, lng, akurasi, alamat, namaTempat: hasil.namaTempat }
}
