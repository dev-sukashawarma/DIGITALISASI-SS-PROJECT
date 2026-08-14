export type PromoScope = 'global' | 'item';
export type PromoType = 'percentage' | 'nominal';

export interface BasePromo {
  id?: string;
  promo_name?: string | null;
  scope: PromoScope;
  menu_item_id: string | null;
  discount_type: PromoType;
  discount_value: number;
  is_active: boolean;
  min_purchase?: number | null;
  usage_limit?: number | null;
  current_usage?: number;
  /** Promo terjadwal: belum berlaku sebelum waktu ini. NULL = berlaku sejak diaktifkan. */
  start_date?: string | null;
  end_date?: string | null;
  apply_to_food_apps?: boolean;
}

export function isScheduledPromo(promo: BasePromo): boolean {
  return Boolean(promo.start_date || promo.end_date);
}

const FOOD_APP_CHANNELS = ['gofood', 'grabfood', 'shopeefood', 'tiktok', 'tiktokgo'];

/**
 * Promo sedang berada di dalam jendela jadwalnya?
 *
 * start_date/end_date bertipe timestamptz (instant absolut), jadi perbandingan
 * ini benar tanpa peduli zona waktu perangkat kasir — perangkat yang diset
 * WITA tidak akan menyalakan promo satu jam lebih awal.
 */
export function isPromoScheduleRunning(promo: BasePromo, now: number = Date.now()): boolean {
  if (promo.start_date) {
    const start = new Date(promo.start_date).getTime();
    // Jadwal yang rusak harus fail-closed. Mengabaikannya akan membuat promo
    // aktif tanpa batas waktu dan memotong harga sebelum jadwal yang dimaksud.
    if (isNaN(start) || start > now) return false; // rusak / belum mulai
  }
  if (promo.end_date) {
    const end = new Date(promo.end_date).getTime();
    // Jendela berlaku adalah [start, end): tepat pada end promo sudah selesai.
    if (isNaN(end) || end <= now) return false; // rusak / sudah selesai
  }
  return true;
}

/**
 * Promo layak dipakai: aktif, di dalam jadwal, kuota belum habis.
 * min_purchase dicek terpisah karena bergantung isi keranjang.
 */
export function isPromoEligible(promo: BasePromo, now: number = Date.now()): boolean {
  if (!promo.is_active) return false;
  if (!isPromoScheduleRunning(promo, now)) return false;
  if (promo.usage_limit && (promo.current_usage || 0) >= promo.usage_limit) return false;
  return true;
}

/**
 * Harga acuan (list price) sebelum promo. Untuk channel yang punya harga
 * sendiri (mis. GoFood di-markup untuk nutupi komisi), acuannya harga channel
 * — BUKAN harga menu biasa, supaya markup channel tidak salah tercatat
 * sebagai diskon negatif.
 */
export function resolveBasePrice(
  originalPrice: number,
  salesSource?: string,
  channelPrices?: Record<string, number> | null
): number {
  if (salesSource && channelPrices && channelPrices[salesSource.toLowerCase()] !== undefined) {
    return channelPrices[salesSource.toLowerCase()];
  }
  return originalPrice;
}

export function calculateItemPrice(
  originalPrice: number,
  menuId: string,
  promos: BasePromo[],
  cartBaseSubtotal?: number,
  salesSource?: string,
  channelPrices?: Record<string, number> | null,
  now: number = Date.now()
): number {
  const isFoodApp = salesSource ? FOOD_APP_CHANNELS.includes(salesSource.toLowerCase()) : false;

  const basePrice = resolveBasePrice(originalPrice, salesSource, channelPrices);

  // Gunakan isPromoEligible (bukan sekadar .is_active) agar jadwal & kuota
  // diperiksa di titik yang sama — mencegah promo aktif sebelum start_date.
  const globalPromo = promos.find(p => p.scope === 'global' && isPromoEligible(p, now));
  const itemPromos = promos.filter(p => p.scope === 'item' && isPromoEligible(p, now));

  // Global promo berlaku untuk SEMUA item, asalkan di dalam jadwal & kuota.
  if (globalPromo && (!isFoodApp || globalPromo.apply_to_food_apps)) {
    if (!isPromoEligible(globalPromo, now)) {
      // Belum mulai / sudah lewat / kuota habis → jatuh ke promo per item.
    } else {
      let apply = true;
      if (globalPromo.min_purchase && globalPromo.min_purchase > 0) {
        if (cartBaseSubtotal !== undefined && cartBaseSubtotal < globalPromo.min_purchase) {
          apply = false; // Not reached min purchase
        }
      }
      
      if (apply) {
        if (globalPromo.discount_type === 'nominal') {
          return Math.max(0, Math.round(basePrice - globalPromo.discount_value));
        } else {
          return Math.max(0, Math.round(basePrice * (1 - globalPromo.discount_value / 100)));
        }
      }
    }
  }

  const promo = itemPromos.find(p => p.menu_item_id === menuId);
  if (!promo) return basePrice;
  if (isFoodApp && !promo.apply_to_food_apps) return basePrice;

  // isPromoEligible sudah dipanggil saat membangun itemPromos di atas,
  // sehingga promo di sini pasti sudah lolos jadwal & kuota.
  // Guard ini dipertahankan sebagai lapisan defensif.
  if (!isPromoEligible(promo, now)) {
    return basePrice;
  }

  if (promo.min_purchase && promo.min_purchase > 0) {
    if (cartBaseSubtotal !== undefined && cartBaseSubtotal < promo.min_purchase) {
      return basePrice; // Not reached min purchase
    }
  }

  if (promo.discount_type === 'nominal') {
    return Math.max(0, Math.round(basePrice - promo.discount_value));
  } else {
    return Math.max(0, Math.round(basePrice * (1 - promo.discount_value / 100)));
  }
}

export function calculateGlobalDiscount(
  subtotal: number,
  promos: BasePromo[]
): number {
  return 0; // Global promos are now applied directly per-item in calculateItemPrice
}

/**
 * Selisih antara harga acuan dan harga jual setelah promo, dikali quantity.
 * Dipakai route pembuatan order untuk MENCATAT diskon per-item ke
 * orders.discount_amount — sebelumnya diskon ini dibakar ke unit_price dan
 * hilang, sehingga "Omzet Kotor" di laporan understated.
 */
export function calculateItemDiscount(
  originalPrice: number,
  unitPrice: number,
  quantity: number,
  opts?: { isGiveaway?: boolean }
): number {
  // Endorse/giveaway digratiskan sepenuhnya — bukan potongan penjualan, jadi
  // tidak ikut Total Potongan (keputusan owner 2026-07-31).
  if (opts?.isGiveaway) return 0;
  return Math.max(0, (originalPrice - unitPrice) * quantity);
}
