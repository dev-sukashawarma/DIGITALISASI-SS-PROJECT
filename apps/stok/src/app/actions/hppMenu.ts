'use server'

import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'

function makeServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL! || 'https://khpkoreaaucvyqfhynfq.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
  return createClient(url, key)
}

async function getAuthedClient() {
  const cookieStore = await cookies()
  return createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (toSet) =>
      toSet.forEach(({ name, value, options }) =>
        cookieStore.set(name, value, options as any)
      ),
  })
}

export interface HPPMenuIngredient {
  bahan_baku_id: string
  nama_bahan: string
  satuan_master: string
  satuan_kecil: string | null
  faktor_konversi: number
  qty_per_porsi: number
  satuan_resep: string
  harga_beli_master: number
  biaya_per_satuan_resep: number
  subtotal_biaya: number
  kontribusi_pct: number
}

export interface HPPMenuItem {
  resep_id: string
  resep_nama: string
  menu_id: string | null
  menu_nama: string
  kategori_nama: string
  harga_jual: number
  total_hpp: number
  gross_margin_rp: number
  gross_margin_pct: number
  food_cost_pct: number
  status_food_cost: 'optimal' | 'warning' | 'critical'
  ingredients: HPPMenuIngredient[]
}

export async function fetchHPPMenuList(): Promise<HPPMenuItem[]> {
  const authedClient = await getAuthedClient()
  const { data: { user } } = await authedClient.auth.getUser()

  if (!user) {
    throw new Error('Sesi tidak valid. Silakan login kembali.')
  }

  const supabase = makeServiceClient()

  // 1. Ambil data resep aktif beserta bahan baku
  const { data: resepData, error: resepError } = await supabase
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
          faktor_tampilan,
          kategori,
          kategori_core
        )
      )
    `)
    .eq('is_active', true)

  if (resepError) throw new Error(resepError.message)
  if (!resepData || resepData.length === 0) return []

  // 2. Ambil seluruh menu items dan kategorinya
  const { data: menuData } = await supabase
    .from('menu_items')
    .select('id, name, price, category_id, categories(name)')

  const menuMap = new Map<string, { id: string; name: string; price: number; categoryName: string }>()
  for (const m of (menuData || [])) {
    const cat = Array.isArray(m.categories) ? m.categories[0]?.name : (m.categories as any)?.name
    menuMap.set(m.id, {
      id: m.id,
      name: m.name,
      price: Number(m.price) || 0,
      categoryName: cat || 'Umum'
    })
  }

  // 3. Ambil harga beli master bahan baku
  const { data: hargaData } = await supabase
    .from('bahan_baku_harga')
    .select('bahan_baku_id, harga_beli, harga_beli_display, kemasan_qty')

  const hargaMap = new Map<string, { hargaBeli: number, hargaBeliDisplay: number, kemasanQty: number }>()
  for (const h of (hargaData || [])) {
    hargaMap.set(h.bahan_baku_id, {
      hargaBeli: Number(h.harga_beli) || 0,
      hargaBeliDisplay: Number(h.harga_beli_display) || 0,
      kemasanQty: Number(h.kemasan_qty) || 0
    })
  }

  // 4. Hitung HPP dan komposisi untuk tiap resep
  const result: HPPMenuItem[] = []

  for (const r of resepData) {
    const menu = r.menu_item_ref ? menuMap.get(r.menu_item_ref) : null
    const menuNama = menu?.name || r.nama
    const hargaJual = menu?.price || 0
    const kategoriNama = menu?.categoryName || 'Menu Lain'

    const ingredients: HPPMenuIngredient[] = []
    let totalHpp = 0

    const rawItems = (r.resep_item as any[]) || []
    for (const it of rawItems) {
      if (!it.bahan_baku) continue
      const bb = it.bahan_baku
      const hData = hargaMap.get(bb.id)
      const masterPrice = hData ? (hData.hargaBeliDisplay || hData.hargaBeli) : 0
      const qtyPorsi = Number(it.qty_per_porsi) || 0
      const satuanResep = it.satuan || bb.satuan || ''
      
      const fallbackFaktor = Number(bb.faktor_tampilan) || Number(bb.faktor_konversi) || 1
      const faktor = (hData && hData.kemasanQty > 0) ? hData.kemasanQty : fallbackFaktor

      // Match admin-dashboard logic: always divide by kemasanQty
      let unitCost = masterPrice
      if (faktor > 0) {
        unitCost = masterPrice / faktor
      }

      const subtotal = qtyPorsi * unitCost
      totalHpp += subtotal

      ingredients.push({
        bahan_baku_id: bb.id,
        nama_bahan: bb.nama,
        satuan_master: bb.satuan || '-',
        satuan_kecil: bb.satuan_kecil || null,
        faktor_konversi: faktor,
        qty_per_porsi: qtyPorsi,
        satuan_resep: satuanResep,
        harga_beli_master: masterPrice,
        biaya_per_satuan_resep: Math.round(unitCost * 100) / 100,
        subtotal_biaya: Math.round(subtotal),
        kontribusi_pct: 0, // dihitung setelah totalHpp selesai
      })
    }

    // Hitung kontribusi % per bahan terhadap total HPP
    if (totalHpp > 0) {
      ingredients.forEach((ing) => {
        ing.kontribusi_pct = Math.round((ing.subtotal_biaya / totalHpp) * 1000) / 10
      })
      // Urutkan bahan dari biaya tertinggi ke terendah
      ingredients.sort((a, b) => b.subtotal_biaya - a.subtotal_biaya)
    }

    const grossMarginRp = hargaJual - totalHpp
    const grossMarginPct = hargaJual > 0 ? (grossMarginRp / hargaJual) * 100 : 0
    const foodCostPct = hargaJual > 0 ? (totalHpp / hargaJual) * 100 : 0

    let statusFoodCost: 'optimal' | 'warning' | 'critical' = 'optimal'
    if (foodCostPct > 45) {
      statusFoodCost = 'critical'
    } else if (foodCostPct >= 35) {
      statusFoodCost = 'warning'
    }

    result.push({
      resep_id: r.id,
      resep_nama: r.nama,
      menu_id: r.menu_item_ref || null,
      menu_nama: menuNama,
      kategori_nama: kategoriNama,
      harga_jual: hargaJual,
      total_hpp: Math.round(totalHpp),
      gross_margin_rp: Math.round(grossMarginRp),
      gross_margin_pct: Math.round(grossMarginPct * 10) / 10,
      food_cost_pct: Math.round(foodCostPct * 10) / 10,
      status_food_cost: statusFoodCost,
      ingredients,
    })
  }

  // Urutkan default berdasarkan kategori lalu nama menu
  result.sort((a, b) => {
    if (a.kategori_nama !== b.kategori_nama) {
      return a.kategori_nama.localeCompare(b.kategori_nama)
    }
    return a.menu_nama.localeCompare(b.menu_nama)
  })

  return result
}
