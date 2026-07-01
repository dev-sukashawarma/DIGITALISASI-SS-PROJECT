import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function ResepPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  // Fetch all menu items
  const { data: menuItems, error } = await supabase
    .from('menu_items')
    .select('id, name, category, price, is_available')
    .order('category')
    .order('name')

  if (error) {
    console.error('Error fetching menu items:', error)
  }

  // Fetch existing recipes to know which ones have a BOM
  const { data: recipes } = await supabase
    .from('resep')
    .select('menu_item_ref, is_active, resep_item(count)')
    .eq('scope', 'global')

  // Map BOM status
  const menuWithBOM = menuItems?.map((menu) => {
    const bom = recipes?.find((r) => r.menu_item_ref === menu.id)
    return {
      ...menu,
      hasBOM: !!bom,
      bomActive: bom?.is_active,
      itemCount: bom?.resep_item?.[0]?.count || 0
    }
  }) || []

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Manajemen Resep (BOM)</h1>
        <p className="text-sm text-gray-500 mt-1">
          Pilih menu untuk mengatur Bill of Materials. Menu dengan BOM akan memotong stok otomatis saat terjual di Kasir.
        </p>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b text-gray-600 font-medium">
              <tr>
                <th className="px-6 py-4">Kategori</th>
                <th className="px-6 py-4">Nama Menu</th>
                <th className="px-6 py-4">Status BOM</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {menuWithBOM.map((menu: any) => (
                <tr key={menu.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-gray-500 uppercase text-xs tracking-wider font-semibold">
                    {menu.category}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {menu.name}
                  </td>
                  <td className="px-6 py-4">
                    {menu.hasBOM ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Aktif ({menu.itemCount} bahan)
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Belum Diatur
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/dashboard/resep/${menu.id}`}
                      className="text-suka-primary hover:text-suka-primary/80 font-medium"
                    >
                      {menu.hasBOM ? 'Edit Resep' : 'Buat Resep'}
                    </Link>
                  </td>
                </tr>
              ))}
              {menuWithBOM.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    Tidak ada menu ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
