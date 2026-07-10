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
    menuName: 'Shawarma Besar',
    ingredients: [
      { matchName: 'SAPI', requiredQty: 80 }, // 80 gram
      { matchName: 'KULIT 32', requiredQty: 1 } // 1 lembar
    ]
  },
  {
    menuName: 'Shawarma Kecil',
    ingredients: [
      { matchName: 'SAPI', requiredQty: 50 }, // 50 gram
      { matchName: 'KULIT 25', requiredQty: 1 } // 1 lembar
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

      if (!stockItem || typeof stockItem.current_qty !== 'number') {
        minPortions = 0;
        bottleneck = req.matchName;
        continue;
      }

      // Convert current_qty to smaller unit (base unit for recipe) if available
      const totalBaseQty = stockItem.faktor_tampilan 
        ? stockItem.current_qty * stockItem.faktor_tampilan 
        : stockItem.current_qty;

      const portions = Math.floor(totalBaseQty / req.requiredQty);
      
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
