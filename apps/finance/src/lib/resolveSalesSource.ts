/* ── Sumber penjualan kanonik untuk agregasi per kanal ────────────────────────
 *
 * Port 1:1 dari fungsi DB `resolve_sales_source(channel, sales_source)` plus
 * aturan endorse di view `sales_daily_spv`. Omzet Rekap Bulanan dikelompokkan
 * lewat view itu, jadi HPP & PCS WAJIB memakai aturan yang persis sama —
 * kalau tidak, omzet & HPP satu kanal jatuh ke kelompok berbeda.
 *
 * Contoh nyata: mayoritas order ShopeeFood tersimpan sales_source='pos',
 * channel='shopeefood'. Mengelompokkan dari sales_source mentah (atau dari
 * payment_method, seperti useHppByChannel dulu) memasukkannya ke "offline".
 *
 * Ubah bersamaan dengan fungsi DB bila aturannya berubah.
 */

export function resolveSalesSource(
  channel: string | null | undefined,
  salesSource: string | null | undefined,
  isEndorse?: boolean | null,
): string {
  const ch = (channel ?? '').trim().toLowerCase()
  const src = (salesSource ?? '').trim().toLowerCase()

  if (isEndorse || ch === 'endors' || ch === 'endorse' || src === 'endors' || src === 'endorse') {
    return 'endors'
  }

  const v = ch === '' || ch === 'pos' || ch === 'food_apps' || ch === 'foodapps'
    ? (salesSource == null ? 'pos' : src)
    : ch

  if (/tiktok.*shop/.test(v) || v === 'f3305089-b9e4-4b92-95da-14bf6e7fb6d5') return 'tiktok_shop'
  if (v.includes('tiktok') || v === 'c9b01c9f-0e5b-462f-bba8-9a9b6525c5c8') return 'tiktok'
  if (/shopee.*shop/.test(v) || v === 'd68eb5ec-d6bb-4d0a-8758-a2600c8f1584') return 'shopee_shop'
  if (v.includes('shopee') || v === '0eaf2746-da9f-492c-a9b4-f091307c98c2') return 'shopeefood'
  if (v.includes('grab') || v === '6802a8b5-8fe3-4ddb-b552-ee87ee7d7f6a') return 'grabfood'
  if (v.includes('gofood') || /go.food/.test(v) || v.includes('gojek') || v === '1284ac2a-e753-4380-9f32-59219a322459') return 'gofood'
  if (v === 'website' || v === 'online' || v === 'web') return 'online'
  return 'pos'
}
