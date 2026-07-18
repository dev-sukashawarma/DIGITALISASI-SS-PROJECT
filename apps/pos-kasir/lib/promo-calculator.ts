export type PromoScope = 'global' | 'item';
export type PromoType = 'percentage' | 'nominal';

export interface BasePromo {
  scope: PromoScope;
  menu_item_id: string | null;
  discount_type: PromoType;
  discount_value: number;
  is_active: boolean;
  min_purchase?: number | null;
  usage_limit?: number | null;
  current_usage?: number;
  end_date?: string | null;
  apply_to_food_apps?: boolean;
}

const FOOD_APP_CHANNELS = ['gofood', 'grabfood', 'shopeefood', 'tiktok', 'tiktokgo'];

export function calculateItemPrice(
  originalPrice: number,
  menuId: string,
  promos: BasePromo[],
  cartBaseSubtotal?: number,
  salesSource?: string,
  channelPrices?: Record<string, number> | null
): number {
  const isFoodApp = salesSource ? FOOD_APP_CHANNELS.includes(salesSource.toLowerCase()) : false;
  
  let basePrice = originalPrice;
  if (salesSource && channelPrices && channelPrices[salesSource.toLowerCase()] !== undefined) {
    basePrice = channelPrices[salesSource.toLowerCase()];
  }

  const globalPromo = promos.find(p => p.scope === 'global' && p.is_active);
  const itemPromos = promos.filter(p => p.scope === 'item' && p.is_active);

  // If global promo is active and not expired, it applies to ALL items
  if (globalPromo && (!isFoodApp || globalPromo.apply_to_food_apps)) {
    if (globalPromo.end_date && new Date(globalPromo.end_date).getTime() < Date.now()) {
      // global promo is expired, so it's ignored, fall through to item promo
    } else if (globalPromo.usage_limit && (globalPromo.current_usage || 0) >= globalPromo.usage_limit) {
      // global promo usage limit reached
    } else {
      let apply = true;
      if (globalPromo.min_purchase && globalPromo.min_purchase > 0) {
        if (cartBaseSubtotal !== undefined && cartBaseSubtotal < globalPromo.min_purchase) {
          apply = false; // Not reached min purchase
        }
      }
      
      if (apply) {
        if (globalPromo.discount_type === 'nominal') {
          return Math.max(0, basePrice - globalPromo.discount_value);
        } else {
          return Math.max(0, basePrice * (1 - globalPromo.discount_value / 100));
        }
      }
    }
  }

  const promo = itemPromos.find(p => p.menu_item_id === menuId);
  if (!promo) return basePrice;
  if (isFoodApp && !promo.apply_to_food_apps) return basePrice;

  if (promo.end_date && new Date(promo.end_date).getTime() < Date.now()) {
    return basePrice; // Expired
  }

  if (promo.usage_limit && (promo.current_usage || 0) >= promo.usage_limit) {
    return basePrice; // Usage limit reached
  }

  if (promo.min_purchase && promo.min_purchase > 0) {
    if (cartBaseSubtotal !== undefined && cartBaseSubtotal < promo.min_purchase) {
      return basePrice; // Not reached min purchase
    }
  }

  if (promo.discount_type === 'nominal') {
    return Math.max(0, basePrice - promo.discount_value);
  } else {
    return Math.max(0, basePrice * (1 - promo.discount_value / 100));
  }
}

export function calculateGlobalDiscount(
  subtotal: number,
  promos: BasePromo[]
): number {
  return 0; // Global promos are now applied directly per-item in calculateItemPrice
}
