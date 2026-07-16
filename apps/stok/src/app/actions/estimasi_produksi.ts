'use server'
import { createClient } from '@supabase/supabase-js'

function makeServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export interface EstimasiIngredient {
  bahan_baku_id: string;
  nama_bahan: string;
  satuan: string;         // Satuan utama
  satuan_kecil: string | null;
  faktor_konversi: number;
  qty_per_porsi: number;
  satuan_resep: string;   // Satuan yang digunakan di resep
  requiredQtyMainUnit: number; // Kebutuhan bahan baku per porsi (dalam satuan utama)
}

export interface EstimasiRecipe {
  id: string;
  nama: string;
  ingredients: EstimasiIngredient[];
}

export async function fetchEstimasiRecipes(outletId: string): Promise<EstimasiRecipe[]> {
  const supabase = makeServiceClient()
  
  // 1. Ambil resep aktif dan scope sesuai outlet
  const { data: resepData, error: resepError } = await supabase
    .from('resep')
    .select(`
      id, 
      nama, 
      menu_item_ref,
      resep_item (
        id, 
        bahan_baku_id, 
        qty_per_porsi, 
        satuan,
        bahan_baku (
          id, 
          nama, 
          satuan, 
          satuan_kecil, 
          faktor_konversi
        )
      )
    `)
    .eq('is_active', true)
    .not('menu_item_ref', 'is', null)
    .or(`scope.eq.global,and(scope.eq.outlet,outlet_id.eq.${outletId})`)

  if (resepError) throw new Error(resepError.message)
  if (!resepData) return []

  // 3. Format data
  const result: EstimasiRecipe[] = []

  for (const row of resepData) {
    const menuName = row.nama;
    
    // Konversi bahan
    const ingredients: EstimasiIngredient[] = []
    
    // Bypass ts strict check untuk relasi (Supabase JSON return)
    const items = row.resep_item as any[] || [];
    
    for (const item of items) {
      if (!item.bahan_baku) continue; // Data tidak valid / referensi hilang
      
      const bb = item.bahan_baku;
      const satuanResep = item.satuan;
      const qtyResep = item.qty_per_porsi;
      
      let requiredQtyMainUnit = qtyResep;
      
      // Jika satuan resep berbeda dengan satuan utama, dan faktor_konversi valid, kita konversi.
      // Asumsi: jika satuan resep BUKAN satuan utama, maka itu diasumsikan sebagai satuan kecil 
      // (termasuk variasi penamaan seperti gram vs ml).
      if (
        satuanResep && bb.satuan && 
        satuanResep.toLowerCase() !== bb.satuan.toLowerCase() && 
        bb.faktor_konversi > 0
      ) {
        requiredQtyMainUnit = qtyResep / bb.faktor_konversi;
      }

      ingredients.push({
        bahan_baku_id: bb.id,
        nama_bahan: bb.nama,
        satuan: bb.satuan,
        satuan_kecil: bb.satuan_kecil,
        faktor_konversi: bb.faktor_konversi,
        qty_per_porsi: qtyResep,
        satuan_resep: satuanResep,
        requiredQtyMainUnit: requiredQtyMainUnit
      })
    }

    result.push({
      id: row.id,
      nama: menuName,
      ingredients: ingredients
    })
  }

  // Sort secara alfabet (opsional, menyesuaikan `fetchActiveResep` sebelumnya)
  result.sort((a, b) => a.nama.localeCompare(b.nama));

  return result;
}
