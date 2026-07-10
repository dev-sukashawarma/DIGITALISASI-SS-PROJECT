'use server'
import { createClient } from '@supabase/supabase-js'

function makeServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export interface ResepMenu {
  id: string
  nama: string
  harga_jual: number
  image_url?: string | null
}

export interface CalculatedBahan {
  bahan_baku_id: string
  nama_bahan: string
  satuan: string
  kebutuhan: number
  sisa_stok: number
  saran_qty: number
}

// ---------------------------------------------------------------------------
// fetchActiveResep — ambil daftar resep menu yang aktif
// ---------------------------------------------------------------------------
export async function fetchActiveResep(outletId: string): Promise<ResepMenu[]> {
  const supabase = makeServiceClient()
  
  const { data, error } = await supabase
    .from('resep')
    .select('id, nama, menu_item_ref')
    .eq('is_active', true)
    .or(`scope.eq.global,and(scope.eq.outlet,outlet_id.eq.${outletId})`)

  if (error) throw new Error(error.message)
  if (!data) return []

  const { data: menuData } = await supabase
    .from('menu_items')
    .select('id, name, price, image_url')
    
  if (menuData) {
    const menuMap = new Map(menuData.map(m => [m.id, { name: m.name, price: m.price, image_url: m.image_url }]))
    
    const validMenus = data
      .filter(r => r.menu_item_ref && menuMap.has(r.menu_item_ref))
      .map(r => {
        const m = menuMap.get(r.menu_item_ref)!
        return {
          id: r.id,
          nama: m.name,
          harga_jual: m.price,
          image_url: m.image_url
        }
      })

    return validMenus.sort((a, b) => {
      const bottomItems = ['Extra Keju', 'Extra Kentang', 'Ice Tea', 'Orange Jus']
      const aIsBottom = bottomItems.includes(a.nama)
      const bIsBottom = bottomItems.includes(b.nama)
      
      if (aIsBottom && !bIsBottom) return 1
      if (!aIsBottom && bIsBottom) return -1
      
      return a.nama.localeCompare(b.nama)
    })
  }

  return []
}

// ---------------------------------------------------------------------------
// calculateBahanBakuRequest — kalkulasi via RPC
// ---------------------------------------------------------------------------
export async function calculateBahanBakuRequest(
  outletId: string,
  targets: { resep_id: string; qty_target: number }[]
): Promise<CalculatedBahan[]> {
  if (targets.length === 0) return []
  
  const supabase = makeServiceClient()
  const { data, error } = await supabase.rpc('calculate_bahan_baku_request', {
    p_outlet_id: outletId,
    p_targets: targets,
  })

  if (error) throw new Error(error.message)
  return data ?? []
}
