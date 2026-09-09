import type { SalesSource } from './types'

export type ChannelGroup = 'offline' | 'online' | 'foodapps' | 'tiktok' | 'app'

const MAP: Record<SalesSource, ChannelGroup> = {
  pos: 'offline',
  online: 'online',
  gofood: 'foodapps',
  shopeefood: 'foodapps',
  grabfood: 'foodapps',
  tiktok: 'tiktok',
  // Marketplace (e-commerce) sales are a different revenue stream from food-delivery/POS
  // channels — must NOT be conflated with the existing 'tiktok' (TikTok Go delivery) bucket.
  tiktok_shop: 'online',
  shopee_shop: 'online',
  endors: 'offline',
  // Grup sendiri, bukan digabung ke 'online'. Keputusan owner 2026-09-09:
  // pertumbuhan aplikasi harus terbaca terpisah dari website & marketplace.
  // Sebelum ini 'app' tidak ada di peta sama sekali, jadi omzet aplikasi
  // jatuh diam-diam ke 'offline' lewat fallback di groupChannel().
  app: 'app',
}

/** Kelompokkan sales_source jadi 4 grup channel untuk laporan Rekap Bulanan. Nilai tak dikenal jatuh ke 'offline' (sama seperti default POS Kasir di resolveOrderSource). */
export function groupChannel(salesSource: string): ChannelGroup {
  return MAP[salesSource as SalesSource] ?? 'offline'
}
