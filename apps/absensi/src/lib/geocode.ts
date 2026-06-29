/**
 * Pencarian alamat via Nominatim (OpenStreetMap) — gratis, tanpa API key.
 * Dipakai untuk menerbangkan peta kalibrasi ke area yang tepat; SPV tetap
 * menggeser pin manual ke gedung persis (Nominatim jarang punya data POI
 * bisnis kecil seperti outlet shawarma).
 */

export type GeocodeResult = { lat: number; lng: number; label: string };

const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";

/** Bangun URL pencarian Nominatim, dibatasi Indonesia, 5 hasil teratas. */
export function buildNominatimSearchUrl(query: string): string {
  const params = new URLSearchParams({
    format: "json",
    q: query,
    countrycodes: "id",
    limit: "5",
  });
  return `${NOMINATIM_SEARCH_URL}?${params.toString()}`;
}

/** Normalisasi hasil mentah Nominatim ke `{lat,lng,label}`, buang baris tak valid. */
export function parseNominatimResults(raw: unknown): GeocodeResult[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row: any) => ({
      lat: Number(row?.lat),
      lng: Number(row?.lon),
      label: String(row?.display_name ?? ""),
    }))
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng) && r.label.length > 0);
}
