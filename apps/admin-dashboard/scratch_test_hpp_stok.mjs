import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  const { data: resepData } = await supabase
    .from('resep')
    .select(`
      id,
      nama,
      menu_item_ref,
      is_active,
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
          faktor_konversi,
          kategori
        )
      )
    `)
    .eq('is_active', true)

  const { data: hargaData } = await supabase
    .from('bahan_baku_harga')
    .select('bahan_baku_id, harga_beli')

  const { data: menuData } = await supabase
    .from('menu_items')
    .select('id, name, price')

  const hargaMap = new Map()
  hargaData.forEach(h => hargaMap.set(h.bahan_baku_id, Number(h.harga_beli) || 0))

  const menuMap = new Map()
  menuData.forEach(m => menuMap.set(m.id, m))

  console.log('=== HASIL PERHITUNGAN HPP REAL-TIME DI APP STOK ===\n')

  for (const r of resepData || []) {
    const menu = r.menu_item_ref ? menuMap.get(r.menu_item_ref) : null
    let totalHpp = 0
    const items = r.resep_item || []

    for (const it of items) {
      if (!it.bahan_baku) continue
      const bb = it.bahan_baku
      const masterPrice = hargaMap.get(bb.id) || 0
      const qtyPorsi = Number(it.qty_per_porsi) || 0
      const satuanResep = (it.satuan || bb.satuan || '').toLowerCase().trim()
      const satuanMaster = (bb.satuan || '').toLowerCase().trim()
      const faktor = Number(bb.faktor_konversi) || 1

      let unitCost = masterPrice
      if (satuanResep !== satuanMaster && faktor > 0) {
        unitCost = masterPrice / faktor
      }
      totalHpp += qtyPorsi * unitCost
    }

    const hargaJual = menu?.price || 0
    const foodCostPct = hargaJual > 0 ? (totalHpp / hargaJual) * 100 : 0

    console.log(`${(menu?.name || r.nama).padEnd(28)} | HPP: Rp ${Math.round(totalHpp).toLocaleString('id-ID').padStart(7)} | Harga Jual: Rp ${hargaJual.toLocaleString('id-ID').padStart(7)} | Food Cost: ${foodCostPct.toFixed(1)}%`)
  }
}

main()
