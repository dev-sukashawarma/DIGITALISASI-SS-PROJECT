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
  lucide: 'globe' | 'monitor' | 'gift' | null
}

export function resolveOrderSource(
  channel?: string | null,
  salesSource?: string | null,
  isEndorse?: boolean
): OrderSourceInfo {
  if (isEndorse || channel === 'endors' || salesSource === 'endors') {
    return { key: 'endors', label: 'ENDORSE', bg: '#fdf4ff', fg: '#d946ef', lucide: 'gift' }
  }

  // sales_source 'tiktok' (agregat) dipetakan ke id channel lokal 'tiktokgo'.
  const normalized = salesSource === 'tiktok' ? 'tiktokgo' : salesSource
  const chId = channel || (normalized && normalized !== 'pos' && normalized !== 'online' ? normalized : null)
  const ch = getChannel(chId)

  if (ch) {
    return { key: ch.id, label: ch.label, bg: ch.bg, fg: ch.fg, logoPath: ch.logoPath, mark: ch.mark, lucide: null }
  }
  if (salesSource === 'online') {
    return { key: 'online', label: 'Website Online', bg: '#f29744', fg: '#ffffff', lucide: 'globe' }
  }
  return { key: 'pos', label: 'POS Kasir', bg: '#701604', fg: '#ffffff', lucide: 'monitor' }
}
