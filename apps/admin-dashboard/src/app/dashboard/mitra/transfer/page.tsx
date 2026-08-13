'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useMitraOutlet } from '../MitraOutletContext'
import { PageHeader } from '@/components/ui'
import { Download, FileText, ArrowRightLeft } from 'lucide-react'

export default function TransferPage() {
  const { selectedOutletId, selectedOutlet } = useMitraOutlet()
  const [transfers, setTransfers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function fetchTransfers() {
      if (!selectedOutletId) return
      setLoading(true)
      const { data } = await supabase
        .from('mitra_transfers')
        .select('*')
        .eq('outlet_id', selectedOutletId)
        .order('bulan', { ascending: false })
        
      setTransfers(data || [])
      setLoading(false)
    }
    fetchTransfers()
  }, [selectedOutletId])

  const handleDownload = async (url: string) => {
    const { data } = await supabase.storage.from('mitra-transfers').createSignedUrl(url, 60)
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank')
    } else {
      alert('Gagal mengambil file bukti transfer.')
    }
  }

  if (!selectedOutletId) {
    return (
      <div className="p-8 text-center text-gray-500 font-medium">
        Silakan pilih outlet terlebih dahulu dari halaman Dashboard.
      </div>
    )
  }

  return (
    <div className="min-h-screen relative bg-[#fafafa]">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <PageHeader 
          title="Transfer Bagi Hasil" 
          description={`Riwayat dan bukti transfer bagi hasil untuk outlet ${selectedOutlet?.name || 'terpilih'}`}
        />

        {loading ? (
          <div className="bg-white/70 backdrop-blur-md rounded-[32px] p-12 text-center border border-white shadow-xl shadow-suka-orange/5">
            <div className="w-8 h-8 border-4 border-suka-orange border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-suka-gray-500 font-bold uppercase tracking-wider text-sm">Memuat bukti transfer...</p>
          </div>
        ) : transfers.length === 0 ? (
          <div className="bg-white/70 backdrop-blur-md rounded-[32px] p-16 text-center border border-white shadow-xl shadow-suka-orange/5 animate-fade-in">
            <div className="bg-gradient-to-br from-suka-orange/20 to-suka-orange/5 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
              <ArrowRightLeft className="h-8 w-8 text-suka-orange" />
            </div>
            <h3 className="text-xl font-extrabold text-suka-brown mb-2">Belum Ada Transfer</h3>
            <p className="text-suka-gray-500 font-medium text-sm">Belum ada riwayat transfer bagi hasil untuk outlet ini.</p>
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in">
            {transfers.map((t) => (
              <div key={t.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 p-5 sm:p-6 bg-white/70 backdrop-blur-xl rounded-[28px] border border-white shadow-xl shadow-suka-orange/5 hover:bg-white/90 hover:scale-[1.01] transition-all duration-300">
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <div className="p-3.5 bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-2xl border border-blue-100 shadow-sm shrink-0">
                    <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-base sm:text-lg text-suka-brown tracking-tight truncate">
                      Periode {new Date(t.bulan).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta',  month: 'long', year: 'numeric' })}
                    </div>
                    <div className="text-sm font-semibold text-suka-gray-500 mt-0.5">
                      {Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(t.nominal)}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => handleDownload(t.bukti_url)}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 sm:py-2.5 bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 text-blue-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-sm border border-blue-200 shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Bukti</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
