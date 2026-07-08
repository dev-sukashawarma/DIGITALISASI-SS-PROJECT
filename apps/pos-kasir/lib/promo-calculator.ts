export type PromoScope = 'global' | 'item';
export type PromoType = 'percentage' | 'nominal';

export interface BasePromo {
  scope: PromoScope;
  menu_item_id: string | null;
  discount_type: PromoType;
  discount_value: number;
  is_active: boolean;
  min_purchase?: number | null;
  end_date?: string | null;
}

export function calculateItemPrice(
  originalPrice: number,
  menuId: string,
  promos: BasePromo[],
  cartBaseSubtotal?: number
): number {
  const globalPromo = promos.find(p => p.scope === 'global' && p.is_active);
  const itemPromos = promos.filter(p => p.scope === 'item' && p.is_active);

  // If global promo is active and not expired, it overrides item promos
  if (globalPromo) {
    if (globalPromo.end_date && new Date(globalPromo.end_date).getTime() < Date.now()) {
      // global promo is expired, so it's ignored, fall through to item promo
    } else {
      return originalPrice; // Global promo applies to total, not individual items
    }
  }

  const promo = itemPromos.find(p => p.menu_item_id === menuId);
  if (!promo) return originalPrice;

  if (promo.end_date && new Date(promo.end_date).getTime() < Date.now()) {
    return originalPrice; // Expired
  }

  if (promo.min_purchase && promo.min_purchase > 0) {
    if (cartBaseSubtotal !== undefined && cartBaseSubtotal < promo.min_purchase) {
      return originalPrice; // Not reached min purchase
    }
  }

  if (promo.discount_type === 'nominal') {
    return Math.max(0, originalPrice - promo.discount_value);
  } else {
    return Math.max(0, originalPrice * (1 - promo.discount_value / 100));
  }
}

export function calculateGlobalDiscount(
  subtotal: number,
  promos: BasePromo[]
): number {
  const globalPromo = promos.find(p => p.scope === 'global' && p.is_active);
  if (!globalPromo) return 0;
  
  if (globalPromo.end_date && new Date(globalPromo.end_date).getTime() < Date.now()) {
    return 0; // Expired
  }

  if (globalPromo.min_purchase && subtotal < globalPromo.min_purchase) {
    return 0; // Not reached min purchase
  }

  if (globalPromo.discount_type === 'nominal') {
    return Math.min(subtotal, globalPromo.discount_value);
  } else {
    return subtotal * (globalPromo.discount_value / 100);
  }
}
