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

const ENDORSE_SOURCE: OrderSourceInfo = { key: 'endors', label: 'ENDORSE', bg: '#fdf4ff', fg: '#d946ef', lucide: 'gift' }
const ONLINE_SOURCE: OrderSourceInfo = { key: 'online', label: 'Website Online', bg: '#f29744', fg: '#ffffff', lucide: 'globe' }
const POS_KASIR_SOURCE: OrderSourceInfo = { key: 'pos_kasir', label: 'POS KASIR', bg: '#2563eb', fg: '#ffffff', lucide: 'monitor' }
const POS_PAWOON_SOURCE: OrderSourceInfo = { key: 'pos_pawoon', label: 'POS PAWOON', bg: '#701604', fg: '#ffffff', lucide: 'monitor' }

const sourceMemo = new Map<string, OrderSourceInfo>()

export function resolveOrderSource(
  channel?: string | null,
  salesSource?: string | null,
  customerName?: string | null,
  isEndorse?: boolean | null,
): OrderSourceInfo {
  const hasNonPawoonCustomer = customerName && customerName !== 'Pawoon Import' ? 1 : 0
  const cacheKey = `${channel || ''}\u0001${salesSource || ''}\u0001${isEndorse ? 1 : 0}\u0001${hasNonPawoonCustomer}`
  const cached = sourceMemo.get(cacheKey)
  if (cached) return cached

  let result: OrderSourceInfo
  // Direct check for Endorse
  if (isEndorse || channel === 'endors' || channel === 'endorse' || salesSource === 'endors' || salesSource === 'endorse') {
    result = ENDORSE_SOURCE
  } else {
    // Try resolving channel first
    let ch = getChannel(channel)
    // If channel is generic (e.g. 'food_apps') or unrecognized, fall back to salesSource
    if (!ch) {
      const normalized = salesSource === 'tiktok' ? 'tiktokgo' : salesSource
      ch = getChannel(normalized)
    }

    if (ch) {
      result = { key: ch.id, label: ch.label, bg: ch.bg, fg: ch.fg, logoPath: ch.logoPath, mark: ch.mark, lucide: null }
    } else {
      const normCh = (channel || '').trim().toLowerCase()
      const normSrc = (salesSource || '').trim().toLowerCase()

      if (
        normSrc === 'online' ||
        normSrc === 'website' ||
        normCh === 'website' ||
        normCh === 'online' ||
        normCh === 'web' ||
        normCh === 'website ss'
      ) {
        result = ONLINE_SOURCE
      } else if (salesSource === 'pos_kasir' || channel === 'pos_kasir' || hasNonPawoonCustomer) {
        // Direct check for POS Kasir internal
        result = POS_KASIR_SOURCE
      } else {
        result = POS_PAWOON_SOURCE
      }
    }
  }

  if (sourceMemo.size > 500) sourceMemo.clear()
  sourceMemo.set(cacheKey, result)
  return result
}
