import type { MonitoringItem } from '../types/monitoring';

export interface ProductionEstimate {
  menuName: string;
  estimatedPortions: number;
  limitingIngredient: string;
}

// Temporary static BOM mapping.
// Future iteration: Fetch from database.
const RECIPES = [
  {
    menuName: 'Shawarma Sapi Besar',
    ingredients: [
      { matchName: 'SAPI', requiredQty: 0.04 }, // 80g / 2000 = 0.04 blok
      { matchName: 'KULIT 32', requiredQty: 0.05 } // 1 / 20 = 0.05 pack
    ]
  },
  {
    menuName: 'Shawarma Sapi Sedang',
    ingredients: [
      { matchName: 'SAPI', requiredQty: 0.0325 }, // asumsi 65g / 2000 = 0.0325 blok
      { matchName: 'KULIT 28', requiredQty: 0.05 } 
    ]
  },
  {
    menuName: 'Shawarma Sapi Kecil',
    ingredients: [
      { matchName: 'SAPI', requiredQty: 0.025 }, // 50g / 2000 = 0.025 blok
      { matchName: 'KULIT 25', requiredQty: 0.05 }
    ]
  },
  {
    menuName: 'Shawarma Ayam Besar',
    ingredients: [
      { matchName: 'AYAM', requiredQty: 0.08 }, // 80g / 1000 = 0.08 kg
      { matchName: 'KULIT 32', requiredQty: 0.05 } 
    ]
  },
  {
    menuName: 'Shawarma Ayam Sedang',
    ingredients: [
      { matchName: 'AYAM', requiredQty: 0.065 }, // asumsi 65g / 1000 = 0.065 kg
      { matchName: 'KULIT 28', requiredQty: 0.05 } 
    ]
  },
  {
    menuName: 'Shawarma Ayam Kecil',
    ingredients: [
      { matchName: 'AYAM', requiredQty: 0.05 }, // 50g / 1000 = 0.05 kg
      { matchName: 'KULIT 25', requiredQty: 0.05 }
    ]
  },
  {
    menuName: 'Shawarma Bowl Sapi',
    ingredients: [
      { matchName: 'SAPI', requiredQty: 0.04 },
      { matchName: 'CUP + TUTUP', requiredQty: 1 } // Asumsi 1 pcs
    ]
  },
  {
    menuName: 'Shawarma Bowl Ayam',
    ingredients: [
      { matchName: 'AYAM', requiredQty: 0.08 },
      { matchName: 'CUP + TUTUP', requiredQty: 1 } 
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
