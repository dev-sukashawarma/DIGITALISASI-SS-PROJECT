/* ── Kanal yang memakai HPP "SS Online" ──────────────────────────────────────
 *
 * HPP SS Online (channel_hpp.ss_online / shopee_shop / tiktok_shop) HANYA
 * berlaku untuk marketplace: Shopee (toko) dan TikTok Shop (seller). Food apps
 * — ShopeeFood, TikTok GO, GoFood, GrabFood — memakai hpp_override biasa
 * (keputusan owner, 2026-09-28).
 *
 * Wajib dicocokkan PERSIS. Dulu dipakai includes('shopee') / includes('tiktok'),
 * sehingga 'shopeefood' dan 'tiktokgo' ikut memakai HPP SS Online yang 11–23%
 * lebih murah (September 2026: HPP kurang ±Rp 49 jt di Rangkuman Penjualan).
 *
 * Penjualan marketplace sendiri tidak ada di tabel `orders`; ia hidup di
 * `ecommerce_sales` dengan channel_id berupa UUID ecommerce_channels di bawah.
 *
 * Salinan identik ada di apps/admin-dashboard/src/lib/hpp/kanalSsOnline.ts dan di
 * fungsi DB get_mitra_item_hpp_base — ubah ketiganya bersamaan.
 */

export const KANAL_SS_ONLINE: ReadonlySet<string> = new Set([
  'ss_online',
  'ss-online',
  'shopee_shop',
  'tiktok_shop',
  'f3305089-b9e4-4b92-95da-14bf6e7fb6d5', // ecommerce_channels: TikTokShop
  'd68eb5ec-d6bb-4d0a-8758-a2600c8f1584', // ecommerce_channels: Shopee
])

export function adalahKanalSsOnline(channel: string | null | undefined): boolean {
  if (!channel) return false
  return KANAL_SS_ONLINE.has(channel.trim().toLowerCase())
}
