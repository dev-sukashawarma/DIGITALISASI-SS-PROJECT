/**
 * URL ke apps/stok (sistem monitoring stok), satu Supabase project dengan
 * pos-kasir jadi sesi SSO ikut terbawa. Lokal pakai localhost:3001 supaya dev
 * tidak perlu override .env per app.
 */
export function getStokUrl(): string {
  const configured = process.env.NEXT_PUBLIC_STOK_URL || 'https://stok.sukashawarma.com'
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3001'
  }
  return configured
}
