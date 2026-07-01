import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'

export default async function ShrinkageReportPage() {
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
  }

  // Filter only items with discrepancies
  const discrepancies = items?.filter(item => {
    const selisih = (item.qty_fisik || 0) - (item.qty_system || 0);
    return Math.abs(selisih) > 0;
  }) || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Shrinkage & Opname Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Monitor selisih barang (hilang/rusak) antara fisik dan sistem (Blind Opname).
        </p>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b text-gray-600 font-medium">
              <tr>
                <th className="px-6 py-4">Waktu Opname</th>
                <th className="px-6 py-4">Outlet</th>
                <th className="px-6 py-4">Bahan Baku</th>
                <th className="px-6 py-4 text-right">Stok Sistem</th>
                <th className="px-6 py-4 text-right">Fisik (Blind)</th>
                <th className="px-6 py-4 text-right">Selisih</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {discrepancies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Tidak ada data selisih opname terbaru.
                  </td>
                </tr>
              ) : (
                discrepancies.map((item: any) => {
                  const selisih = (item.qty_fisik || 0) - (item.qty_system || 0);
                  const isNegative = selisih < 0;
                  const absSelisih = Math.abs(selisih).toLocaleString('id-ID');

                  return (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {item.opname?.created_at ? format(new Date(item.opname.created_at), 'dd MMM yyyy HH:mm') : '-'}
                      </td>
                      <td className="px-6 py-4 text-gray-600">{item.opname?.outlets?.name || '-'}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900">{item.bahan_baku?.nama}</span>
                          <span className="text-[10px] uppercase tracking-wider text-gray-500">{item.bahan_baku?.kategori}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-gray-500">
                        {item.qty_system} <span className="text-xs">{item.bahan_baku?.satuan}</span>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-gray-900">
                        {item.qty_fisik} <span className="text-xs">{item.bahan_baku?.satuan}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-bold ${
                          isNegative ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
                        }`}>
                          {isNegative ? '-' : '+'}{absSelisih} {item.bahan_baku?.satuan}
                        </span>
                        {item.flagged && (
                          <div className="text-[10px] text-red-500 font-bold uppercase mt-1">Kritis</div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
