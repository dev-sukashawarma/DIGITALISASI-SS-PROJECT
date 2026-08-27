'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@suka/auth'
import { toast } from 'sonner'
import { Package } from 'lucide-react'

export default function ShrinkageView({ initialDiscrepancies }: { initialDiscrepancies: any[] }) {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  useEffect(() => {
    const channel = supabase.channel('realtime_shrinkage_finance')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'opname_items' },
        () => {
          toast.warning('Data Selisih Stok Terbaru!', {
            description: 'Ada input data opname stok terbaru dari cabang'
          })
          router.refresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, router])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-suka-brown">Selisih Stok (Shrinkage & Opname)</h1>
        <p className="text-sm text-gray-500 mt-1">
          Monitor selisih barang (hilang/rusak) antara fisik dan sistem (Blind Opname) secara realtime.
        </p>
      </div>

      <div className="bg-white border border-suka-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 border-b border-suka-gray-200 text-gray-600 font-bold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Waktu Opname</th>
                <th className="px-6 py-4">Outlet</th>
                <th className="px-6 py-4">Bahan Baku</th>
                <th className="px-6 py-4 text-right">Stok Sistem</th>
                <th className="px-6 py-4 text-right">Fisik (Blind)</th>
                <th className="px-6 py-4 text-right">Selisih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-suka-gray-100 font-medium">
              {!initialDiscrepancies || initialDiscrepancies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    <Package size={36} className="mx-auto mb-2 opacity-30 text-suka-orange" />
                    <p className="font-bold text-gray-600">Tidak ada data selisih opname</p>
                    <p className="text-xs text-gray-400 mt-0.5">Semua opname fisik klop dengan sistem atau belum ada data terbaru.</p>
                  </td>
                </tr>
              ) : (
                initialDiscrepancies.map((item) => {
                  const selisih = (item.qty_fisik || 0) - (item.qty_system || 0)
                  const isNegative = selisih < 0
                  return (
                    <tr key={item.id} className="hover:bg-amber-50/20 transition-colors">
                      <td className="px-6 py-4 text-gray-500 font-semibold whitespace-nowrap">
                        {item.opname?.created_at ? new Date(item.opname.created_at).toLocaleString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : '-'}
                      </td>
                      <td className="px-6 py-4 font-bold text-suka-brown whitespace-nowrap">
                        {item.opname?.outlets?.name || 'Unknown Outlet'}
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-900">
                        {item.bahan_baku?.nama || 'Unknown Item'}
                        <span className="text-[10px] text-gray-400 font-normal ml-1.5">
                          ({item.bahan_baku?.satuan || '-'})
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-gray-700">
                        {item.qty_system} {item.bahan_baku?.satuan}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-gray-700">
                        {item.qty_fisik} {item.bahan_baku?.satuan}
                      </td>
                      <td className={`px-6 py-4 text-right font-black ${isNegative ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {selisih > 0 ? `+${selisih}` : selisih} {item.bahan_baku?.satuan}
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
