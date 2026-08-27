import { getChannel } from './channels'

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
  customerName?: string | null,
  isEndorse?: boolean | null,
): OrderSourceInfo {
  // Direct check for Endorse
  if (isEndorse || channel === 'endors' || channel === 'endorse' || salesSource === 'endors' || salesSource === 'endorse') {
    return { key: 'endors', label: 'ENDORSE', bg: '#fdf4ff', fg: '#d946ef', lucide: 'gift' }
  }

  // Try resolving channel first
  let ch = getChannel(channel)
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
