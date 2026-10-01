/**
 * Menyusun alamat yang enak dibaca dari hasil reverse geocoding Nominatim
 * (OpenStreetMap), mis. "Jalan Pancasan No. 12, Paledang, Bogor Tengah,
 * Bogor, Jawa Barat 16122".
 *
 * Sengaja TIDAK memakai `display_name` mentah: di zoom 18 Nominatim mengawali
 * alamat dengan POI terdekat ("Masjid Nur Amaliyah, Jalan Pancasan, …"), yang
 * bukan outlet kita, dan diakhiri "Indonesia" yang tak perlu.
 */
export interface AlamatNominatim {
  house_number?: string
  road?: string
  pedestrian?: string
  footway?: string
  residential?: string
  hamlet?: string
  neighbourhood?: string
  quarter?: string
  village?: string
  suburb?: string
  city_district?: string
  municipality?: string
  city?: string
  town?: string
  county?: string
  regency?: string
  state?: string
  postcode?: string
}

export function formatAlamat(a: AlamatNominatim | null | undefined): string | null {
  if (!a) return null

  const jalanNama = a.road ?? a.pedestrian ?? a.footway ?? a.residential
  const jalan = jalanNama
    ? a.house_number ? `${jalanNama} No. ${a.house_number}` : jalanNama
    : null

  const bagian = [
    jalan,
    a.hamlet,
    a.neighbourhood ?? a.quarter,
    a.village,
    a.suburb,
    a.city_district,
    a.city ?? a.town ?? a.municipality ?? a.regency ?? a.county,
  ]

  // Buang yang kosong & yang berulang (OSM kadang mengisi village = suburb).
  const unik: string[] = []
  for (const b of bagian) {
    const t = b?.trim()
    if (t && !unik.some((u) => u.toLowerCase() === t.toLowerCase())) unik.push(t)
  }

  const provinsi = [a.state?.trim(), a.postcode?.trim()].filter(Boolean).join(' ')
  if (provinsi) unik.push(provinsi)

  return unik.length ? unik.join(', ') : null
}
