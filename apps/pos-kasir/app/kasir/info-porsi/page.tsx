'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function InfoPorsiPage() {
  const [limitedMenus, setLimitedMenus] = useState<[string, number][] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchPortions() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: profile } = await supabase
          .from('outlet_staff')
          .select('outlet_id, role')
          .eq('id', user.id)
          .single()

        let outletId = profile?.outlet_id
        if (profile?.role === 'admin' && !outletId) {
          outletId = '550e8400-e29b-41d4-a716-446655440001'
        }

        if (!outletId) return

        const { data: criticalItems } = await supabase
          .from('monitoring_view_crew')
          .select('item_name, projection_text')
          .eq('outlet_id', outletId)
          .eq('status', 'below')

        if (!criticalItems || criticalItems.length === 0) {
          setLimitedMenus([])
          return
        }

        const menuPortions: Record<string, number> = {}

        criticalItems.forEach(item => {
          if (!item.projection_text) return
          const parts = item.projection_text.split(' atau ')
          parts.forEach((part: string) => {
            const match = part.match(/(.*?)\s*\((\d+)\s*porsi\)/)
            if (match) {
              const menuName = match[1].trim()
              const portions = parseInt(match[2], 10)
              if (menuPortions[menuName] === undefined) {
                menuPortions[menuName] = portions
              } else {
                menuPortions[menuName] = Math.min(menuPortions[menuName], portions)
              }
            }
          })
        })

        const sorted = Object.entries(menuPortions)
          .sort((a, b) => a[1] - b[1])

        setLimitedMenus(sorted)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }

    fetchPortions()
  }, [])

  return (
    <div className="flex-1 w-full flex flex-col bg-[#fff8f1] min-h-screen">
      <div className="px-4 pt-6 pb-4 max-w-[1600px] mx-auto w-full">
        <div className="mb-6 flex items-start gap-3 bg-red-50 p-4 rounded-xl border border-red-100">
          <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
          <div>
            <h1 className="text-xl font-bold text-red-800">Informasi Porsi & Bahan Baku</h1>
            <p className="text-red-700/80 text-sm mt-1">
              Halaman ini menampilkan seluruh menu yang bahan bakunya akan segera habis (di bawah batas minimal) atau sudah habis (0 porsi).
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#d9c2b2]" />
          </div>
        ) : (!limitedMenus || limitedMenus.length === 0) ? (
          <div className="bg-white border border-[#d9c2b2] p-8 text-center rounded-2xl shadow-sm">
            <h3 className="text-lg font-bold text-[#1e1b15]">Stok Aman</h3>
            <p className="text-[#877365]">Tidak ada menu dengan porsi kritis (di bawah batas minimal).</p>
          </div>
        ) : (
          <div className="block w-full bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-red-800 font-bold text-base mb-3">
                  Sisa Porsi Menu Saat Ini:
                </h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-3">
                  {limitedMenus.map(([menuName, portions], idx) => (
                    <li key={idx} className="flex flex-col gap-1 text-red-800 text-sm bg-red-100/50 p-3 rounded-lg border border-red-100/80">
                      <span className="font-semibold leading-tight flex-1">
                        {menuName}
                      </span>
                      <span className="font-bold text-red-600 flex items-center gap-1.5 mt-auto">
                        <span className={`inline-block w-2 h-2 rounded-full ${portions === 0 ? 'bg-red-600' : 'bg-orange-500'}`}></span>
                        {portions === 0 ? 'HABIS (0 porsi)' : `Sisa ${portions} porsi`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
