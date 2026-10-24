/**
 * Dashboard POS Admin - Menu Page
 * Author: rendydev404 <rendyakun50@gmail.com>
 */
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import MenuView from './MenuView'
import type { MenuItem, Category, SalesChannel, Outlet } from '@/pos-types'

export const dynamic = 'force-dynamic'

export default async function AdminMenuPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const searchParams = await props.searchParams
  const q = typeof searchParams.q === 'string' ? searchParams.q : ''

  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  let itemsQuery = supabase.from('menu_items').select('*, categories(id,name,sort_order), package_items:menu_packages!package_id(id, menu_item_id, quantity, or_menu_item_id)').order('sort_order')

  let [itemsRes, categoriesRes, settingsRes, channelsRes, outletsRes, bahanBakuRes, recipesRes] = await Promise.all([
    itemsQuery,
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('kiosk_settings').select('key, value').eq('outlet_id', '550e8400-e29b-41d4-a716-446655440001').in('key', ['upsell_ids', 'bestseller_ids', 'recommendation_ids']),
    supabase.from('sales_channels').select('*').eq('is_active', true).order('name'),
    supabase.from('outlets').select('*').eq('is_active', true).order('name'),
    supabase.from('bahan_baku').select('id, nama, satuan, satuan_kecil, kategori, faktor_konversi, bahan_baku_harga(harga_beli, harga_beli_display, kemasan_qty, kemasan_satuan), bahan_baku_sku(nama_kemasan, qty_isi, harga_beli, is_default, is_active, tingkatan_satuan)').order('nama'),
    supabase.from('resep').select('id, menu_item_ref, is_active, buffer_amount, catatan, resep_item(id, bahan_baku_id, qty_per_porsi, satuan)').eq('scope', 'global'),
  ])

  if (itemsRes.error) {
    console.error("Error fetching items with package_items:", itemsRes.error);
    let fallbackQuery = supabase.from('menu_items').select('*, categories(id,name,sort_order)').order('sort_order');
    itemsRes = await fallbackQuery;
  }

  const initialItems: MenuItem[] = itemsRes.data || []
  const initialCategories: Category[] = categoriesRes.data || []
  const initialChannels: SalesChannel[] = channelsRes.data || []
  const initialOutlets: Outlet[] = outletsRes.data || []
  let initialPromos: any[] = []
  const activeOutletIds = initialOutlets.map(outlet => outlet.id)
  if (activeOutletIds.length > 0) {
    const promosRes = await supabase
      .from('outlet_promos')
      .select('scope, menu_item_id, outlet_id, is_active, start_date, end_date, daily_start_time, daily_end_time, daily_schedule')
      .eq('is_active', true)
      .in('outlet_id', activeOutletIds)

    if (promosRes.error) {
      console.error('Error fetching menu promo badges:', promosRes.error)
    } else {
      initialPromos = promosRes.data || []
    }
  }
  const settingsData = settingsRes.data || []
  
  const parseIds = (key: string) => {
    try {
      const val = settingsData.find(s => s.key === key)?.value
      return val ? JSON.parse(val) : []
    } catch { return [] }
  }

  const upsellIds = parseIds('upsell_ids')
  const bestsellerIds = parseIds('bestseller_ids')
  const recommendationIds = parseIds('recommendation_ids')

  // Normalisasi bahan baku untuk modal resep
  const initialBahanBaku = (bahanBakuRes.data || []).map((bb: any) => {
    const h = Array.isArray(bb.bahan_baku_harga) ? bb.bahan_baku_harga[0] : bb.bahan_baku_harga
    const skus = Array.isArray(bb.bahan_baku_sku) ? bb.bahan_baku_sku : []
    const activeSkus = skus.filter((s: any) => s.is_active)
    let defaultSku = activeSkus.find((s: any) => s.is_default)
    if (!defaultSku && activeSkus.length > 0) {
      defaultSku = activeSkus.reduce((min: any, curr: any) => 
        (curr.qty_isi > 0 && curr.harga_beli / curr.qty_isi < (min.qty_isi > 0 ? min.harga_beli / min.qty_isi : Infinity)) ? curr : min
      , activeSkus[0])
    }
    const hargaBeli = defaultSku ? Number(defaultSku.harga_beli) || 0 : Number(h?.harga_beli) || 0
    const kemasanQty = defaultSku ? Number(defaultSku.qty_isi) || 0 : Number(h?.kemasan_qty) || 0
    const kemasanSatuan = bb.satuan_kecil || h?.kemasan_satuan || bb.satuan || ''

    return {
      id: bb.id,
      nama: bb.nama,
      satuan: bb.satuan,
      satuan_kecil: bb.satuan_kecil || kemasanSatuan,
      harga_beli: hargaBeli,
      kemasan_qty: kemasanQty,
      kemasan_satuan: kemasanSatuan,
    }
  })

  // Map resep per menu_item_ref
  const initialRecipes: Record<string, { id: string; resep_item: { bahan_baku_id: string; qty_per_porsi: number; satuan: string }[] }> = {}
  for (const r of (recipesRes.data || [])) {
    if (r.menu_item_ref) {
      initialRecipes[r.menu_item_ref] = {
        id: r.id,
        resep_item: (r.resep_item || []).map((ri: any) => ({
          bahan_baku_id: ri.bahan_baku_id,
          qty_per_porsi: Number(ri.qty_per_porsi) || 0,
          satuan: ri.satuan || '',
        }))
      }
    }
  }

  return (
    <MenuView 
      initialItems={initialItems} 
      initialCategories={initialCategories} 
      initialChannels={initialChannels}
      initialOutlets={initialOutlets}
      initialPromos={initialPromos}
      initialUpsells={upsellIds}
      initialBestsellers={bestsellerIds}
      initialRecommendations={recommendationIds}
      searchQuery={q}
      initialBahanBaku={initialBahanBaku}
      initialRecipes={initialRecipes}
    />
  )
}
