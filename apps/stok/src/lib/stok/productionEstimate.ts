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
  { menuName: 'Original Sapi Jumbo', ingredients: [{ matchName: 'SAPI', requiredQty: 0.04 }, { matchName: 'KULIT 32', requiredQty: 0.05 }] },
  { menuName: 'Original Sapi Besar', ingredients: [{ matchName: 'SAPI', requiredQty: 0.0325 }, { matchName: 'KULIT 28', requiredQty: 0.05 }] },
  { menuName: 'Original Sapi Sedang', ingredients: [{ matchName: 'SAPI', requiredQty: 0.025 }, { matchName: 'KULIT 25', requiredQty: 0.05 }] },
  
  // --- ORIGINAL AYAM ---
  { menuName: 'Original Ayam Jumbo', ingredients: [{ matchName: 'AYAM', requiredQty: 0.08 }, { matchName: 'KULIT 32', requiredQty: 0.05 }] },
  { menuName: 'Original Ayam Besar', ingredients: [{ matchName: 'AYAM', requiredQty: 0.065 }, { matchName: 'KULIT 28', requiredQty: 0.05 }] },
  { menuName: 'Original Ayam Sedang', ingredients: [{ matchName: 'AYAM', requiredQty: 0.05 }, { matchName: 'KULIT 25', requiredQty: 0.05 }] },
  
  // --- ORIGINAL MIX ---
  { menuName: 'Original Mix Jumbo', ingredients: [{ matchName: 'SAPI', requiredQty: 0.02 }, { matchName: 'AYAM', requiredQty: 0.04 }, { matchName: 'KULIT 32', requiredQty: 0.05 }] },
  { menuName: 'Original Mix Besar', ingredients: [{ matchName: 'SAPI', requiredQty: 0.015 }, { matchName: 'AYAM', requiredQty: 0.03 }, { matchName: 'KULIT 28', requiredQty: 0.05 }] },
  
  // --- SHAWARMIE ---
  { menuName: 'Shawarmie Sapi', ingredients: [{ matchName: 'SAPI', requiredQty: 0.025 }, { matchName: 'MIE', requiredQty: 1 }, { matchName: 'FOIL', requiredQty: 0.0013 }] },
  { menuName: 'Shawarmie Ayam', ingredients: [{ matchName: 'AYAM', requiredQty: 0.05 }, { matchName: 'MIE', requiredQty: 1 }, { matchName: 'FOIL', requiredQty: 0.0013 }] },
  
  // --- SUKA VARIANTS ---
  { menuName: 'Suka Samyang', ingredients: [{ matchName: 'MIE', requiredQty: 1 }, { matchName: 'SAOS SAMYANG', requiredQty: 0.03 }, { matchName: 'SAPI', requiredQty: 0.025 }] },
  { menuName: 'Suka Beef', ingredients: [{ matchName: 'SAPI', requiredQty: 0.04 }, { matchName: 'PAPER WRAP', requiredQty: 1 }] },
  { menuName: 'Suka Chicken', ingredients: [{ matchName: 'AYAM', requiredQty: 0.08 }, { matchName: 'PAPER WRAP', requiredQty: 1 }] },
  { menuName: 'Suka Fried Chicken', ingredients: [{ matchName: 'AYAM', requiredQty: 0.08 }, { matchName: 'TEPUNG', requiredQty: 0.05 }, { matchName: 'PAPER WRAP', requiredQty: 1 }] },
  
  // --- EXTRA / MINUMAN ---
  { menuName: 'Extra Kentang', ingredients: [{ matchName: 'KENTANG', requiredQty: 0.1 }] },
  { menuName: 'Ice Tea', ingredients: [{ matchName: 'POWDER MIX', requiredQty: 0.02 }, { matchName: 'CUP + TUTUP', requiredQty: 1 }] },
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
