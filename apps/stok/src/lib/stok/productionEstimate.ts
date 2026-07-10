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
      // Format di database: "Daging Sapi (B)" untuk Shawarma Besar
      // "Tortilla (B) 25cm" untuk Tortilla Besar
      { matchName: 'DAGING SAPI (B)', requiredQty: 1 }, // Asumsi sudah dalam satuan porsi (misal 1 bks = 1 porsi atau hitungan base sudah sesuai qty display)
      { matchName: 'TORTILLA (B)', requiredQty: 1 }
    ]
  },
  {
    menuName: 'Shawarma Kecil',
    ingredients: [
      { matchName: 'DAGING SAPI (K)', requiredQty: 1 },
      { matchName: 'TORTILLA (K)', requiredQty: 1 }
    ]
  },
  {
    menuName: 'Shawarma Bowl',
    ingredients: [
      { matchName: 'DAGING SAPI (B)', requiredQty: 1 }, // Anggap bowl pakai daging besar
      { matchName: 'BOWL', requiredQty: 1 } // Asumsi ada item packaging Bowl
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
