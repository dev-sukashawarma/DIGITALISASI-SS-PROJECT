import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient, parseStaffHeader, STAFF_HEADER } from '@suka/auth'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ResepEditor } from './ResepEditor'

export const dynamic = 'force-dynamic'

export default async function EditResepPage({ params }: { params: Promise<{ menu_id: string }> }) {
  const headersList = await headers()
  const staff = parseStaffHeader(headersList.get(STAFF_HEADER))

  if (staff?.role === 'area_manager') {
    redirect('/')
  }

  const menu_id = (await params).menu_id
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  // Fetch Menu Item
  const { data: menu } = await supabase
    .from('menu_items')
    .select('*, categories(name)')
    .eq('id', menu_id)
    .single()

  if (!menu) {
    return <div>Menu tidak ditemukan</div>
  }

  // Fetch all bahan baku for dropdown (+ harga & isi kemasan untuk kartu HPP)
  const { data: bahanBakuList } = await supabase
    .from('bahan_baku')
    .select('id, nama, satuan, satuan_kecil, kategori, faktor_konversi, bahan_baku_harga(harga_beli, harga_beli_display, kemasan_qty, kemasan_satuan), bahan_baku_sku(nama_kemasan, qty_isi, harga_beli, is_default, is_active, tingkatan_satuan, image_url)')
    .order('nama')

  // Fetch existing global recipe (+ buffer Loss & catatan)
  const { data: existingRecipe } = await supabase
    .from('resep')
    .select('id, nama, is_active, scope, buffer_amount, catatan, updated_at, updated_by, created_at, resep_item(id, bahan_baku_id, qty_per_porsi, satuan)')
    .eq('menu_item_ref', menu_id)
    .eq('scope', 'global')
    .maybeSingle()

  let comboBOMData = null;
  if (menu.is_package) {
    const { data: simplePkg } = await supabase.from('menu_packages').select('menu_item_id, quantity').eq('package_id', menu_id);
    const baseIds = (simplePkg || []).map((p: any) => p.menu_item_id);
    if (baseIds.length > 0) {
      const { data: baseMenus } = await supabase.from('menu_items').select('id, name').in('id', baseIds);
      const { data: baseRecipes } = await supabase.from('resep').select('menu_item_ref, resep_item(bahan_baku_id, qty_per_porsi, satuan)').in('menu_item_ref', baseIds).eq('scope', 'global');
      
      comboBOMData = (simplePkg || []).map((pkg: any) => {
         const baseMenu = baseMenus?.find((m: any) => m.id === pkg.menu_item_id)
         const recipe = baseRecipes?.find((r: any) => r.menu_item_ref === pkg.menu_item_id)
         return {
           baseItemId: pkg.menu_item_id,
           baseItemName: baseMenu?.name || 'Unknown Item',
           quantity: pkg.quantity || 1,
           items: recipe?.resep_item || [],
           hasBOM: !!recipe
         }
      })
    } else {
      comboBOMData = []
    }
  }

  const bahanNorm = (bahanBakuList || []).map((bb: any) => {
    const h = Array.isArray(bb.bahan_baku_harga) ? bb.bahan_baku_harga[0] : bb.bahan_baku_harga
    const skus = Array.isArray(bb.bahan_baku_sku) ? bb.bahan_baku_sku : []
    const activeSkus = skus.filter((s: any) => s.is_active)
    
    // Find default SKU, or cheapest SKU per unit if no default
    let defaultSku = activeSkus.find((s: any) => s.is_default)
    if (!defaultSku && activeSkus.length > 0) {
      defaultSku = activeSkus.reduce((min: any, curr: any) => 
        (curr.qty_isi > 0 && curr.harga_beli / curr.qty_isi < (min.qty_isi > 0 ? min.harga_beli / min.qty_isi : Infinity)) ? curr : min
      , activeSkus[0])
    }

    return {
      id: bb.id,
      nama: bb.nama,
      satuan: bb.satuan,
      satuan_kecil: bb.satuan_kecil,
      kategori: bb.kategori,
      faktor_konversi: Number(bb.faktor_konversi) || 1,
      // Fallback to old harga if no SKU
      harga_beli: defaultSku ? Number(defaultSku.harga_beli) : (Number(h?.harga_beli) || 0),
      harga_beli_display: defaultSku ? Number(defaultSku.harga_beli) : (Number(h?.harga_beli_display) || 0),
      kemasan_qty: defaultSku ? Number(defaultSku.qty_isi) : (Number(h?.kemasan_qty) || 0),
      kemasan_satuan: defaultSku ? (bb.satuan_kecil || bb.satuan) : (h?.kemasan_satuan || ''),
    }
  })

  return (
    <div className="w-full space-y-6">
      <Link href="/resep" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-suka-primary">
        <ArrowLeft className="w-4 h-4 mr-1" /> Kembali ke Manajemen Resep
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Resep BOM: {menu.name}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Kategori: {menu.categories?.name || '—'} | Harga: Rp {menu.price?.toLocaleString('id-ID')}
        </p>
      </div>

      <ResepEditor
        menu={menu}
        bahanBakuList={bahanNorm}
        existingRecipe={existingRecipe}
        comboBOMData={comboBOMData}
      />
    </div>
  )
}
