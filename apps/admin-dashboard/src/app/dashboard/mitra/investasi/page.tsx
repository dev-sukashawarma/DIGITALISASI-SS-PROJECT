'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useMitraOutlet } from '../MitraOutletContext'
import { PageHeader } from '@/components/ui'
import { DollarSign, Activity, FileText } from 'lucide-react'

export default function LaporanInvestasiPage() {
  const { selectedOutletId, selectedOutlet } = useMitraOutlet()
  const [investasi, setInvestasi] = useState<any>(null)
  const [omzetTotal, setOmzetTotal] = useState<number>(0)
  const [totalTransfer, setTotalTransfer] = useState<number>(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function fetchData() {
      if (!selectedOutletId) return
      setLoading(true)
      const supabase = createClient()
      
      const { data: inv } = await supabase
        .from('mitra_investments')
        .select('*')
        .eq('outlet_id', selectedOutletId)
        .single()
        
      if (inv) {
        setInvestasi(inv)
      } else {
        setInvestasi(null)
      }
      
      const { data: orders } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('outlet_id', selectedOutletId)
        .eq('status', 'completed')
        
      let calculatedOmzet = 0
      if (orders) {
        calculatedOmzet = orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0)
      }

      const { data: transfers } = await supabase
        .from('mitra_transfers')
        .select('nominal')
        .eq('outlet_id', selectedOutletId)
        
      let calculatedTransfers = 0
      if (transfers) {
        calculatedTransfers = transfers.reduce((sum, t) => sum + Number(t.nominal || 0), 0)
      }
      
      // Add historical data if available
      if (inv) {
        calculatedOmzet += Number(inv.omzet_historis || 0)
        calculatedTransfers += Number(inv.transfer_historis || 0)
      }
      
      setOmzetTotal(calculatedOmzet)
      setTotalTransfer(calculatedTransfers)
      
      setLoading(false)
    }
    fetchData()
  }, [selectedOutletId])

  if (!selectedOutletId) {
    return (
      <div className="p-8 text-center text-gray-500 font-medium">
        Silakan pilih outlet terlebih dahulu dari halaman Dashboard.
      </div>
    )
  }

  const roi = investasi && investasi.nilai_investasi > 0 ? (omzetTotal / investasi.nilai_investasi) * 100 : 0
  const bepPercentage = Math.min(roi, 100)

  return (
    <div className="min-h-screen relative bg-[#fafafa]">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <PageHeader 
          title="Laporan Investasi" 
          description={`Detail dan status pengembalian modal untuk outlet ${selectedOutlet?.name || 'terpilih'}`}
        />

        {loading ? (
          <div className="bg-white/70 backdrop-blur-md rounded-[32px] p-12 text-center border border-white shadow-xl shadow-suka-orange/5">
            <div className="w-8 h-8 border-4 border-suka-orange border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-suka-gray-500 font-bold uppercase tracking-wider text-sm">Memuat data investasi...</p>
          </div>
        ) : !investasi ? (
          <div className="bg-white/70 backdrop-blur-md rounded-[32px] p-16 text-center border border-white shadow-xl shadow-suka-orange/5 animate-fade-in">
            <div className="bg-gradient-to-br from-suka-orange/20 to-suka-orange/5 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
              <DollarSign className="h-8 w-8 text-suka-orange" />
            </div>
            <h3 className="text-xl font-extrabold text-suka-brown mb-2">Belum Ada Data Investasi</h3>
            <p className="text-suka-gray-500 font-medium text-sm">Data investasi untuk outlet ini belum diatur oleh admin.</p>
          </div>
        ) : (
          <div className="space-y-6 animate-fade-in">
            {/* KPI Cards Glassmorphism */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Investasi Card */}
              <div className="group bg-white/70 backdrop-blur-md p-6 sm:p-8 rounded-[32px] border border-white shadow-xl shadow-suka-orange/5 flex flex-col justify-between hover:-translate-y-2 transition-all duration-300 hover:shadow-2xl hover:shadow-suka-orange/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-100/30 rounded-bl-full -z-10 group-hover:scale-125 transition-transform duration-500"></div>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-extrabold text-suka-gray-400 uppercase tracking-widest">Total Investasi</p>
                    <p className="text-[10px] text-suka-gray-400 font-semibold mt-1">
                      Mulai: {new Date(investasi.tanggal_mulai).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-100 shadow-sm group-hover:scale-110 transition-transform duration-300">
                    <DollarSign className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
                <div className="mt-8">
                  <h3 className="text-3xl lg:text-4xl font-black text-suka-brown tracking-tighter truncate drop-shadow-sm">
                    {Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(investasi.nilai_investasi)}
                  </h3>
                </div>
              </div>

              {/* ROI Kumulatif Card */}
              <div className="group bg-white/70 backdrop-blur-md p-6 sm:p-8 rounded-[32px] border border-white shadow-xl shadow-suka-orange/5 flex flex-col justify-between hover:-translate-y-2 transition-all duration-300 hover:shadow-2xl hover:shadow-suka-orange/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-green-100/30 rounded-bl-full -z-10 group-hover:scale-125 transition-transform duration-500"></div>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-extrabold text-suka-gray-400 uppercase tracking-widest">ROI Kumulatif</p>
                    <p className="text-[10px] text-suka-gray-400 font-semibold mt-1">Rasio pengembalian seluruh omzet</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-green-50 to-green-100/50 border border-green-100 shadow-sm group-hover:rotate-12 transition-transform duration-300">
                    <Activity className="w-6 h-6 text-suka-green" />
                  </div>
                </div>
                <div className="mt-8">
                  <h3 className="text-3xl lg:text-4xl font-black text-suka-brown tracking-tighter truncate drop-shadow-sm mb-4">
                    {roi.toFixed(2)}%
                  </h3>
                  <div className="w-full relative">
                    <div className="flex justify-between text-[10px] font-extrabold text-suka-gray-500 mb-2 uppercase tracking-wider">
                      <span>Progres Balik Modal</span>
                      <span className="text-suka-green">{bepPercentage.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-suka-gray-100/80 rounded-full h-2 overflow-hidden shadow-inner backdrop-blur-sm">
                      <div 
                        className={`h-full rounded-full transition-all duration-[2000ms] ease-out shadow-sm ${
                          bepPercentage >= 100 ? 'bg-gradient-to-r from-green-400 to-suka-green' : 'bg-gradient-to-r from-suka-orange/80 to-suka-orange'
                        }`}
                        style={{ width: `${bepPercentage}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
              
            </div>

            {/* Rekap Modal Mitra Table */}
            <div className="rounded-[16px] border-2 border-black overflow-hidden bg-white shadow-xl shadow-suka-orange/5 animate-fade-in">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-cyan-300 border-b-2 border-black">
                    <th className="px-4 py-3 text-sm font-extrabold text-black uppercase tracking-wider border-r-2 border-black w-2/3">REKAP MODAL MITRA</th>
                    <th className="px-4 py-3 border-black"></th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-black">
                  <tr>
                    <td className="px-4 py-2.5 text-sm font-medium text-black border-r-2 border-black uppercase">Total Modal Mitra</td>
                    <td className="px-4 py-2.5 text-sm font-extrabold text-black text-right">
                      {Intl.NumberFormat('id-ID').format(investasi.nilai_investasi)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-sm font-medium text-black border-r-2 border-black uppercase">Profit Mitra Sebelumnya</td>
                    <td className="px-4 py-2.5 text-sm font-medium text-black text-right">
                      {Intl.NumberFormat('id-ID').format(totalTransfer)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-sm font-medium text-black border-r-2 border-black uppercase">Total Profit Mitra Sementara</td>
                    <td className="px-4 py-2.5 text-sm font-extrabold text-black text-right">
                      {Intl.NumberFormat('id-ID').format(omzetTotal)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-sm font-medium text-black border-r-2 border-black uppercase">ROI</td>
                    <td className="px-4 py-2.5 text-sm font-extrabold text-black text-right">
                      {roi.toFixed(2)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Catatan Admin */}
            {investasi.catatan && (
              <div className="bg-gradient-to-br from-orange-50 to-orange-100/30 p-6 rounded-[24px] border border-orange-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-suka-orange"></div>
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-white/80 rounded-xl shadow-sm shrink-0">
                    <FileText className="w-5 h-5 text-suka-orange" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-suka-brown mb-1.5 text-sm uppercase tracking-wider">Catatan Admin</h3>
                    <p className="text-suka-gray-500 text-sm font-medium leading-relaxed">{investasi.catatan}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
