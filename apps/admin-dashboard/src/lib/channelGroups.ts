import type { SalesSource } from './types'

export type ChannelGroup = 'offline' | 'online' | 'foodapps' | 'tiktok'

const MAP: Record<SalesSource, ChannelGroup> = {
  pos: 'offline',
  online: 'online',
  gofood: 'foodapps',
  shopeefood: 'foodapps',
  grabfood: 'foodapps',
  tiktok: 'tiktok',
}

/** Kelompokkan sales_source jadi 4 grup channel untuk laporan Rekap Bulanan. Nilai tak dikenal jatuh ke 'offline' (sama seperti default POS Kasir di resolveOrderSource). */
export function groupChannel(salesSource: string): ChannelGroup {
  return MAP[salesSource as SalesSource] ?? 'offline'
}
