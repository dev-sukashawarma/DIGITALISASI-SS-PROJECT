import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'


export const dynamic = 'force-dynamic'

export default async function VoidsReportPage() {
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

  // Fetch cancelled orders
  const { data: voids, error } = await supabase
    .from('orders')
    .select(`
      id,
      created_at,
      total,
      void_reason,
      void_at,
      outlets!inner(name),
      outlet_staff!orders_voided_by_fkey(name, role)
    `)
    .eq('status', 'cancelled')
    .order('void_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('Error fetching voids:', error)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-suka-brown">Pembatalan & Kecurangan</h1>
        <p className="text-sm text-gray-500 mt-1">
          Monitor pembatalan pesanan dan aktivitas mencurigakan di kasir.
        </p>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b text-gray-600 font-medium">
              <tr>
                <th className="px-6 py-4">Waktu Batal</th>
                <th className="px-6 py-4">Outlet</th>
                <th className="px-6 py-4">Di-void Oleh</th>
                <th className="px-6 py-4">Alasan (Void Reason)</th>
                <th className="px-6 py-4 text-right">Nilai (Rp)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {!voids || voids.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Belum ada data pembatalan pesanan.
                  </td>
                </tr>
              ) : (
                voids.map((v: any) => (
                  <tr key={v.id} className="hover:bg-red-50/30 transition-colors group">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {v.void_at ? new Date(v.void_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':') : '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{v.outlets?.name || '-'}</td>
                    <td className="px-6 py-4">
                      {v.outlet_staff ? (
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900">{v.outlet_staff.name}</span>
                          <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500">{v.outlet_staff.role}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">Sistem/Unknown</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-2">
                        <span className="text-red-500 mt-0.5">⚠️</span>
                        <span className="text-gray-700 italic max-w-xs truncate" title={v.void_reason || 'Tanpa alasan'}>
                          {v.void_reason || 'Tanpa alasan'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-red-600">
                      -{v.total?.toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
