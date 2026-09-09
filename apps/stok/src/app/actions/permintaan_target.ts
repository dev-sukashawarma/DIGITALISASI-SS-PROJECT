'use server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { assertOutletAccessible } from '@/lib/stok/outletAccess'

function makeServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL! || 'https://khpkoreaaucvyqfhynfq.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NjMyOTIsImV4cCI6MjA5NjUzOTI5Mn0.RdsvP6OKs6aiRnqqd02BYiv5gzbh4uGqO88dapo0Gso'
  return createClient(url, key)
}

// Server Action = endpoint POST publik; makeServiceClient() bypass RLS, jadi
// wajib gerbang sesi+scope-outlet sendiri (lihat CLAUDE.md § Server Action
// authz gap) sebelum baca resep/BOM atau jalankan kalkulasi kebutuhan bahan.
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
  saldo_is_gram: boolean
}

// ---------------------------------------------------------------------------
// fetchActiveResep — ambil daftar resep menu yang aktif
// ---------------------------------------------------------------------------
export async function fetchActiveResep(outletId: string): Promise<ResepMenu[]> {
  await assertOutletAccessible(await getAuthedClient(), outletId)
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

  await assertOutletAccessible(await getAuthedClient(), outletId)
  const supabase = makeServiceClient()
  const { data, error } = await supabase.rpc('calculate_bahan_baku_request', {
    p_outlet_id: outletId,
    p_targets: targets,
  })

  if (error) throw new Error(error.message)
  return data ?? []
}
