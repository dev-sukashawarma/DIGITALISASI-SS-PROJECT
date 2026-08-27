export type SalesSource = 'pos' | 'online' | 'gofood' | 'grabfood' | 'shopeefood' | 'tiktok' | 'tiktok_shop' | 'shopee_shop' | 'endors'

export type ChannelGroup = 'offline' | 'online' | 'foodapps' | 'tiktok'

const MAP: Record<string, ChannelGroup> = {
  pos: 'offline',
  online: 'online',
  gofood: 'foodapps',
  shopeefood: 'foodapps',
  grabfood: 'foodapps',
  tiktok: 'tiktok',
  tiktok_shop: 'online',
  shopee_shop: 'online',
  endors: 'offline',
}

/** Kelompokkan sales_source jadi 4 grup channel untuk laporan Rekap Bulanan. Nilai tak dikenal jatuh ke 'offline' (sama seperti default POS Kasir di resolveOrderSource). */
export function groupChannel(salesSource: string): ChannelGroup {
  return MAP[salesSource] ?? 'offline'
}
