'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Download, FileText } from 'lucide-react'

export function TabTransfer({ outletId }: { outletId: string }) {
  const [transfers, setTransfers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchTransfers() {
      if (!outletId) return
      setLoading(true)
      const { data } = await supabase
        .from('mitra_transfers')
        .select('*')
        .eq('outlet_id', outletId)
        .order('bulan', { ascending: false })
        
      setTransfers(data || [])
      setLoading(false)
    }
    fetchTransfers()
  }, [outletId])

  const handleDownload = async (url: string) => {
    const { data } = await supabase.storage.from('mitra-transfers').createSignedUrl(url, 60)
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank')
    } else {
      alert('Gagal mengambil file bukti transfer.')
    }
  }

  if (loading) return <div className="text-center p-4 text-gray-500">Memuat bukti transfer...</div>
  if (transfers.length === 0) return <div className="text-center p-4 text-gray-500">Belum ada riwayat transfer.</div>

  return (
    <div className="space-y-3">
      {transfers.map((t) => (
        <div key={t.id} className="flex justify-between items-center p-4 border rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="font-semibold">
                {new Date(t.bulan).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
              </div>
              <div className="text-sm text-gray-600">
                {Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(t.nominal)}
              </div>
            </div>
          </div>
          <button 
            onClick={() => handleDownload(t.bukti_url)}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
            title="Download Bukti"
          >
            <Download className="w-5 h-5" />
          </button>
        </div>
      ))}
    </div>
  )
}
