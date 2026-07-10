import type { MonitoringItem } from '../types/monitoring';

export interface ProductionEstimate {
  menuName: string;
  estimatedPortions: number;
  limitingIngredient: string;
}

// Temporary static BOM mapping.
// Future iteration: Fetch from database.
const RECIPES = [
  // --- ORIGINAL SAPI ---
  {
    menuName: 'Original Sapi Sedang',
    ingredients: [
      { matchName: 'SAPI', requiredQty: 0.025 }, // asumsi 50g -> 0.025 blok
      { matchName: 'KULIT 25', requiredQty: 0.05 } // 1 lembar -> 0.05 pack
    ]
  },
  {
    menuName: 'Original Sapi Besar',
    ingredients: [
      { matchName: 'SAPI', requiredQty: 0.0325 }, // asumsi 65g -> 0.0325 blok
      { matchName: 'KULIT 28', requiredQty: 0.05 }
    ]
  },
  {
    menuName: 'Original Sapi Jumbo',
    ingredients: [
      { matchName: 'SAPI', requiredQty: 0.04 }, // asumsi 80g -> 0.04 blok
      { matchName: 'KULIT 32', requiredQty: 0.05 }
    ]
  },
  // --- ORIGINAL AYAM ---
  {
    menuName: 'Original Ayam Sedang',
    ingredients: [
      { matchName: 'AYAM', requiredQty: 0.05 }, // asumsi 50g -> 0.05 kg
      { matchName: 'KULIT 25', requiredQty: 0.05 }
    ]
  },
  {
    menuName: 'Original Ayam Besar',
    ingredients: [
      { matchName: 'AYAM', requiredQty: 0.065 },
      { matchName: 'KULIT 28', requiredQty: 0.05 }
    ]
  },
  {
    menuName: 'Original Ayam Jumbo',
    ingredients: [
      { matchName: 'AYAM', requiredQty: 0.08 },
      { matchName: 'KULIT 32', requiredQty: 0.05 }
    ]
  },
  // --- SHAWARMIE (MIE) ---
  {
    menuName: 'Shawarmie Sapi',
    ingredients: [
      { matchName: 'SAPI', requiredQty: 0.025 },
      { matchName: 'MIE', requiredQty: 1 },
      { matchName: 'FOIL', requiredQty: 0.0013 } // asumsi 1 pcs (1cm? foil ada konversi 760) -> 1/760 = 0.0013
    ]
  }
];

export function calculateProductionEstimate(items: Partial<MonitoringItem>[]): ProductionEstimate[] {
  if (!items || items.length === 0) return [];

  const estimates: ProductionEstimate[] = [];

  for (const recipe of RECIPES) {
    let minPortions = Infinity;
    let bottleneck = 'Tidak ada bahan';

    for (const req of recipe.ingredients) {
      // Find matching item by partial name ignoring case
      const stockItem = items.find(i => 
        i.item_name && i.item_name.toUpperCase().includes(req.matchName.toUpperCase())
      );

      if (!stockItem || typeof stockItem.current_qty !== 'number' || stockItem.current_qty <= 0) {
        minPortions = 0;
        bottleneck = req.matchName;
        continue;
      }

      // We calculate directly using current_qty (which is in main unit e.g. blok/pack)
      // because our requiredQty is already converted to the main unit fraction.
      const portions = Math.floor(stockItem.current_qty / req.requiredQty);
      
      if (portions < minPortions) {
        minPortions = portions;
        bottleneck = stockItem.item_name || req.matchName;
      }
    }

    if (minPortions === Infinity) minPortions = 0;

    estimates.push({
      menuName: recipe.menuName,
      estimatedPortions: minPortions,
      limitingIngredient: bottleneck
    });
  }

  // Filter out recipes that have absolutely 0 ingredients in the system (avoid showing empty menus)
  // Or just return all of them. For now, returning all makes sense so crew knows they lack ingredients.
  return estimates;
}
