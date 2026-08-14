import { PlatformId, PlatformParser } from './types';
import { shopeefoodParser } from './shopeefood';
import { grabfoodParser } from './grabfood';
import { gofoodParser } from './gofood';
import { tiktokgoParser } from './tiktokgo';

// Registry parser per platform. Menambah platform baru = tambah satu file parser
// lalu daftarkan di sini — sisa alur (pemetaan outlet, agregasi, preview, sync)
// tidak perlu disentuh.

export const PLATFORM_PARSERS: Record<PlatformId, PlatformParser> = {
  shopeefood: shopeefoodParser,
  grabfood: grabfoodParser,
  gofood: gofoodParser,
  tiktokgo: tiktokgoParser,
};

/**
 * Channel di `order_items` kita yang sepadan dengan tiap platform — dipakai untuk
 * membandingkan omzet laporan vs catatan sendiri. Ketiga food apps memakai channel
 * yang sama karena data periode Pawoon tidak membedakan Shopee/Grab/Go.
 */
export const PLATFORM_COMPARE_CHANNEL: Record<PlatformId, string> = {
  shopeefood: 'food_apps',
  grabfood: 'food_apps',
  gofood: 'food_apps',
  tiktokgo: 'tiktok_go',
};

export const PLATFORM_LIST = Object.values(PLATFORM_PARSERS).map((p) => ({
  id: p.id,
  label: p.label,
  accept: p.accept,
  ready: true,
}));

export function getParser(platform: string): PlatformParser {
  const p = PLATFORM_PARSERS[platform as PlatformId];
  if (!p) throw new Error(`Platform "${platform}" tidak dikenal.`);
  return p;
}

export * from './types';
