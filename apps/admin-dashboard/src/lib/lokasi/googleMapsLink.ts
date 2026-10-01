import { parseLatLng, type LatLng } from '@/lib/parseLatLng'

/**
 * Membaca titik koordinat dari link Google Maps (atau koordinat yang diketik).
 *
 * Koordinat HANYA diambil dari isi link itu sendiri. Halaman HTML Google Maps
 * sengaja tidak di-scrape: diuji 2026-10-01, `og:image center=` di halaman itu
 * adalah perkiraan lokasi dari IP peminta, bukan tempatnya ("Monumen Nasional"
 * terbaca di Bogor). Koordinat outlet dipakai radius GPS absensi dan urutan
 * jarak di aplikasi pelanggan — titik yang salah lebih berbahaya daripada
 * tidak ada titik, jadi link tanpa koordinat ditolak dengan petunjuk.
 */

/** Seberapa bisa dipercaya titik yang terbaca. */
export type AkurasiTitik =
  /** Pin tempat (`!3d…!4d…`) atau koordinat eksplisit di link/teks. */
  | 'pin'
  /** `@lat,lng,zoom` saja: titik tengah layar peta, belum tentu outletnya. */
  | 'tengah_peta'

export interface TitikDariLink extends LatLng {
  akurasi: AkurasiTitik
}

export type HasilBacaLink =
  | { jenis: 'titik'; titik: TitikDariLink; namaTempat: string | null }
  | { jenis: 'link_pendek'; url: string }
  | { jenis: 'tanpa_koordinat'; namaTempat: string | null }
  | { jenis: 'bukan_link_maps' }

const HOST_LINK_PENDEK = new Set(['maps.app.goo.gl', 'goo.gl'])

/** Host yang boleh dikunjungi saat mengikuti redirect link pendek (cegah SSRF). */
export function hostGoogleMapsDiizinkan(hostname: string): boolean {
  const h = hostname.toLowerCase()
  if (HOST_LINK_PENDEK.has(h)) return true
  if (h === 'consent.google.com') return true
  // google.com, google.co.id, maps.google.com, www.google.co.id, …
  return /^(www\.|maps\.)?google\.(com|co\.id)$/.test(h)
}

function bulatkan(n: number): number {
  // 7 desimal ≈ 1 cm — lebih dari cukup, membuang ekor float yang aneh.
  return Math.round(n * 1e7) / 1e7
}

function titikValid(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
    !(lat === 0 && lng === 0)
  )
}

function buatTitik(lat: number, lng: number, akurasi: AkurasiTitik): TitikDariLink | null {
  if (!titikValid(lat, lng)) return null
  return { lat: bulatkan(lat), lng: bulatkan(lng), akurasi }
}

function decodeAman(s: string): string {
  try { return decodeURIComponent(s.replace(/\+/g, ' ')) } catch { return s }
}

/**
 * Koordinat derajat-menit-detik seperti yang ditampilkan Google Maps saat pin
 * diklik: `6°35'49.6"S 106°48'21.6"E`.
 */
export function parseDms(input: string): LatLng | null {
  const re = /(\d{1,3})\s*°\s*(\d{1,2})\s*['′]\s*(\d{1,2}(?:[.,]\d+)?)\s*(?:"|″|'')?\s*([NSEWUTBLnsewutbl])/g
  const bagian = [...input.matchAll(re)]
  if (bagian.length !== 2) return null
  const keDesimal = (m: RegExpMatchArray) => {
    const nilai = Number(m[1]) + Number(m[2]) / 60 + Number(m[3].replace(',', '.')) / 3600
    const arah = m[4].toUpperCase()
    // S (selatan/south), W/B (barat) bernilai negatif.
    return arah === 'S' || arah === 'W' || arah === 'B' ? -nilai : nilai
  }
  const [a, b] = bagian
  const arahA = a[4].toUpperCase()
  const aLintang = arahA === 'N' || arahA === 'S' || arahA === 'U'
  const lat = keDesimal(aLintang ? a : b)
  const lng = keDesimal(aLintang ? b : a)
  return titikValid(lat, lng) ? { lat, lng } : null
}

/** "lat,lng" dari sebuah nilai parameter/segmen path, mis. `-6.59, 106.80`. */
function titikDariTeks(teks: string): LatLng | null {
  const m = decodeAman(teks).match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/)
  if (!m) return null
  const lat = Number(m[1]); const lng = Number(m[2])
  return titikValid(lat, lng) ? { lat, lng } : null
}

function namaTempatDariUrl(u: URL): string | null {
  const m = u.pathname.match(/\/maps\/place\/([^/]+)/)
  const kandidat = m ? decodeAman(m[1]) : (u.searchParams.get('q') ?? u.searchParams.get('query'))
  if (!kandidat) return null
  const bersih = kandidat.trim()
  // Segmen place yang isinya koordinat (pin yang dijatuhkan) bukan nama tempat.
  if (!bersih || titikDariTeks(bersih) || parseDms(bersih)) return null
  return bersih.slice(0, 200)
}

const PARAM_KOORDINAT = ['q', 'query', 'll', 'sll', 'center', 'destination', 'daddr', 'viewpoint']

/** Baca titik dari URL Google Maps yang sudah lengkap (bukan link pendek). */
export function titikDariUrlMaps(u: URL): TitikDariLink | null {
  const lengkap = decodeAman(u.pathname + u.search + u.hash)

  // 1. Pin tempat di parameter data: `!3d<lat>!4d<lng>` — paling akurat.
  const pin = lengkap.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)
  if (pin) {
    const t = buatTitik(Number(pin[1]), Number(pin[2]), 'pin')
    if (t) return t
  }

  // 2. Koordinat eksplisit di parameter (?q=lat,lng, ?ll=, ?destination=, …).
  for (const kunci of PARAM_KOORDINAT) {
    const nilai = u.searchParams.get(kunci)
    const t = nilai ? titikDariTeks(nilai) : null
    if (t) return buatTitik(t.lat, t.lng, 'pin')
  }

  // 3. Koordinat sebagai segmen path: /maps/place/-6.59,106.80/ atau /maps/search/…
  for (const seg of u.pathname.split('/')) {
    if (seg.startsWith('@')) continue
    const t = titikDariTeks(seg)
    if (t) return buatTitik(t.lat, t.lng, 'pin')
  }

  // 4. `@lat,lng,17z` — titik tengah layar peta, bukan pin.
  const tengah = lengkap.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,|$|\/|\?)/)
  if (tengah) return buatTitik(Number(tengah[1]), Number(tengah[2]), 'tengah_peta')

  return null
}

/** Ambil URL pertama dari teks tempelan (orang sering menempel "Nama Tempat\nhttps://…"). */
function urlPertama(teks: string): string | null {
  const m = teks.match(/https?:\/\/[^\s<>"']+/i)
  if (m) return m[0].replace(/[.,;:!?)]+$/, '')
  const tanpaSkema = teks.trim().match(/^((?:maps\.app\.goo\.gl|goo\.gl\/maps|(?:www\.|maps\.)?google\.(?:com|co\.id)\/maps)[^\s]*)/i)
  return tanpaSkema ? `https://${tanpaSkema[1].replace(/[.,;:!?)]+$/, '')}` : null
}

/** Membaca tempelan pengguna tanpa jaringan. Link pendek dikembalikan untuk diikuti di server. */
export function bacaTempelanLokasi(input: string): HasilBacaLink {
  const teks = input.trim()
  if (!teks) return { jenis: 'bukan_link_maps' }

  const url = urlPertama(teks)
  if (!url) {
    const angka = parseLatLng(teks)
    if (angka) {
      const t = buatTitik(angka.lat, angka.lng, 'pin')
      if (t) return { jenis: 'titik', titik: t, namaTempat: null }
    }
    const dms = parseDms(teks)
    if (dms) {
      const t = buatTitik(dms.lat, dms.lng, 'pin')
      if (t) return { jenis: 'titik', titik: t, namaTempat: null }
    }
    return { jenis: 'bukan_link_maps' }
  }

  let u: URL
  try { u = new URL(url) } catch { return { jenis: 'bukan_link_maps' } }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { jenis: 'bukan_link_maps' }
  if (!hostGoogleMapsDiizinkan(u.hostname)) return { jenis: 'bukan_link_maps' }

  const host = u.hostname.toLowerCase()
  if (host === 'maps.app.goo.gl' || (host === 'goo.gl' && u.pathname.startsWith('/maps'))) {
    u.protocol = 'https:'
    return { jenis: 'link_pendek', url: u.toString() }
  }
  if (host === 'goo.gl') return { jenis: 'bukan_link_maps' }

  // Halaman persetujuan cookie Google membungkus tujuan aslinya di ?continue=
  if (host === 'consent.google.com') {
    const lanjut = u.searchParams.get('continue')
    return lanjut ? bacaTempelanLokasi(lanjut) : { jenis: 'bukan_link_maps' }
  }

  // google.com tanpa /maps (mis. hasil pencarian) bukan link peta.
  if (!host.startsWith('maps.') && !u.pathname.startsWith('/maps')) return { jenis: 'bukan_link_maps' }

  const titik = titikDariUrlMaps(u)
  const namaTempat = namaTempatDariUrl(u)
  return titik ? { jenis: 'titik', titik, namaTempat } : { jenis: 'tanpa_koordinat', namaTempat }
}

/** Batas kasar wilayah Indonesia — untuk peringatan (mis. lat/lng tertukar), bukan penolakan. */
export function diLuarIndonesia(lat: number, lng: number): boolean {
  return lat < -11.5 || lat > 6.5 || lng < 94.5 || lng > 141.5
}
