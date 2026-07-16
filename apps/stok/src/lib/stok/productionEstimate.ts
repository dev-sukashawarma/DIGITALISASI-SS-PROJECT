import type { MonitoringItem } from '../types/monitoring';
import type { EstimasiRecipe } from '@/app/actions/estimasi_produksi';

export interface ProductionEstimate {
  menuName: string;
  estimatedPortions: number;
  limitingIngredient: string;
}

export function calculateProductionEstimate(
  items: Partial<MonitoringItem>[], 
  recipes: EstimasiRecipe[]
): ProductionEstimate[] {
  if (!items || items.length === 0 || !recipes || recipes.length === 0) return [];

  const estimates: ProductionEstimate[] = [];

  for (const recipe of recipes) {
    if (recipe.ingredients.length === 0) continue; // Skip menu without ingredients

    let minPortions = Infinity;
    let bottleneck = 'Tidak ada bahan';

    for (const req of recipe.ingredients) {
      // Find matching item by EXACT bahan_baku_id
      const stockItem = items.find(i => i.bahan_baku_id === req.bahan_baku_id);

      if (!stockItem || typeof stockItem.current_qty !== 'number' || stockItem.current_qty <= 0) {
        if (minPortions !== 0) {
          minPortions = 0;
          bottleneck = req.nama_bahan;
        } else {
          // Jika sudah 0 sebelumnya, kita tambahkan nama bahan ke bottleneck agar lebih informatif
          bottleneck += `, ${req.nama_bahan}`;
        }
        continue; // Boleh continue untuk mendata semua bottleneck, atau break. Kita gunakan continue.
      }

      // requiredQtyMainUnit sudah dikonversi ke satuan utama di server action
      const portions = Math.floor(stockItem.current_qty / req.requiredQtyMainUnit);
      
      if (portions < minPortions) {
        minPortions = portions;
        bottleneck = stockItem.item_name || req.nama_bahan;
      }
    }

    if (minPortions === Infinity) minPortions = 0;

    estimates.push({
      menuName: recipe.nama,
      estimatedPortions: minPortions,
      limitingIngredient: bottleneck
    });
  }

  return estimates;
}
