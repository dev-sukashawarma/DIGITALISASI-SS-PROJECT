'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

export function TabInvestasi({ outletId }: { outletId: string }) {
  const [investasi, setInvestasi] = useState<any>(null)
  const [omzetTotal, setOmzetTotal] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      if (!outletId) return
      setLoading(true)
      const supabase = createClient()
      
      const { data: inv } = await supabase
        .from('mitra_investments')
        .select('*')
        .eq('outlet_id', outletId)
        .single()
        
      if (inv) {
        setInvestasi(inv)
      }
      
      const { data: orders } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('outlet_id', outletId)
        .eq('status', 'completed')
        
      if (orders) {
        const total = orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0)
        setOmzetTotal(total)
      }
      
      setLoading(false)
    }
    fetchData()
  }, [outletId])

  if (loading) return <div className="text-center p-4 text-gray-500">Memuat data investasi...</div>
  if (!investasi) return <div className="text-center p-4 text-gray-500">Data investasi belum diatur oleh admin.</div>

  const roi = investasi.nilai_investasi > 0 ? (omzetTotal / investasi.nilai_investasi) * 100 : 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
          <div className="text-xs text-blue-800 mb-1">Total Investasi</div>
          <div className="font-bold text-lg text-blue-900">
            {Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(investasi.nilai_investasi)}
          </div>
          <div className="text-xs text-blue-700 mt-2">Mulai: {new Date(investasi.tanggal_mulai).toLocaleDateString('id-ID')}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-xl border border-green-100">
          <div className="text-xs text-green-800 mb-1">ROI Kumulatif</div>
          <div className="font-bold text-lg text-green-900">
            {roi.toFixed(2)}%
          </div>
          <div className="text-xs text-green-700 mt-2">Dari total omzet</div>
        </div>
      </div>
      
      <div className="bg-gray-50 p-4 rounded-lg border">
        <h3 className="font-semibold text-gray-700 mb-2">Total Omzet Keseluruhan</h3>
        <div className="text-xl font-bold">
          {Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(omzetTotal)}
        </div>
      </div>
      
      {investasi.catatan && (
        <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
          <h3 className="font-semibold text-orange-900 mb-1 text-sm">Catatan Admin</h3>
          <p className="text-orange-800 text-sm">{investasi.catatan}</p>
        </div>
      )}
    </div>
  )
}
