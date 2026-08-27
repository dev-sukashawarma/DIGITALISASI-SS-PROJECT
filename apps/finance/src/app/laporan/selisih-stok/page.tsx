import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import ShrinkageView from './ShrinkageView'

export const dynamic = 'force-dynamic'

export default async function SelisihStokReportPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  // Fetch recent opname items with discrepancies
  const { data: items, error } = await supabase
    .from('opname_item')
    .select(`
      id,
      qty_fisik,
      qty_system,
      flagged,
      opname!inner(
        created_at,
        outlets(name)
      ),
      bahan_baku(
        nama,
        satuan,
        kategori
      )
    `)
    .order('id', { ascending: false })
    .limit(100)

  if (error) {
    console.error('Error fetching shrinkage data:', error)
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-suka-brown">Selisih Stok (Shrinkage & Opname)</h1>
        </div>
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200">
          Gagal mengambil data laporan shrinkage: {error.message}
        </div>
      </div>
    )
  }

  // Filter only items with discrepancies
  const discrepancies = items?.filter(item => {
    const selisih = (item.qty_fisik || 0) - (item.qty_system || 0)
    return Math.abs(selisih) > 0
  }) || []

  return <ShrinkageView initialDiscrepancies={discrepancies} />
}
