import { getChannel } from './channels'

// Resolusi sumber pesanan (pure, tanpa JSX) agar bisa dipakai bersama oleh
// komponen badge (OrderSourceBadge) & agregasi analitik (admin-analytics).
//
// 3 kemungkinan sumber, konsisten dgn halaman Owner & papan Kasir crew:
//   1. Channel eksternal (GoFood, ShopeeFood, dll) -> logo brand
//   2. Website Online (sales_source = 'online')     -> ikon Globe
//   3. POS Kasir (default)                          -> ikon Monitor
//
// `channel` diprioritaskan (tag per-order). Bila kosong, jatuh ke `sales_source`
// yang bisa berupa 'online', 'pos', atau id channel (data ter-sync/agregat).
export interface OrderSourceInfo {
  key: string
  label: string
  bg: string
  fg: string
  logoPath?: string
  mark?: string
  lucide: 'globe' | 'monitor' | null
}

export function resolveOrderSource(
  channel?: string | null,
  salesSource?: string | null,
  customerName?: string | null,
): OrderSourceInfo {
  // Try resolving channel first
  let ch = getChannel(channel)
  // If channel is generic (e.g. 'food_apps') or unrecognized, fall back to salesSource
  if (!ch) {
    const normalized = salesSource === 'tiktok' ? 'tiktokgo' : salesSource
    ch = getChannel(normalized)
  }

  if (ch) {
    return { key: ch.id, label: ch.label, bg: ch.bg, fg: ch.fg, logoPath: ch.logoPath, mark: ch.mark, lucide: null }
  }
  if (salesSource === 'online') {
    return { key: 'online', label: 'Website Online', bg: '#f29744', fg: '#ffffff', lucide: 'globe' }
  }

  // Direct check for POS Kasir internal
  if (salesSource === 'pos_kasir' || channel === 'pos_kasir' || (customerName && customerName !== 'Pawoon Import')) {
    return { key: 'pos_kasir', label: 'POS KASIR', bg: '#2563eb', fg: '#ffffff', lucide: 'monitor' }
  }

  return { key: 'pos_pawoon', label: 'POS PAWOON', bg: '#701604', fg: '#ffffff', lucide: 'monitor' }
}
