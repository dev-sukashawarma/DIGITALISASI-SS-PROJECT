'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useMitraOutlet } from '../MitraOutletContext'
import { PageHeader } from '@/components/ui'
import { DollarSign, Activity, FileText, Wallet } from 'lucide-react'
import { getMitraRoiStats } from '@/app/actions/mitraRoi'

export default function LaporanInvestasiPage() {
  const { selectedOutletId, selectedOutlet } = useMitraOutlet()
  const [investasi, setInvestasi] = useState<any>(null)
  const [roiStats, setRoiStats] = useState<{ roi: number, bepPercentage: number, nilaiInvestasi: number, totalProfitKumulatif: number } | null>(null)
  
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function fetchData() {
      if (!selectedOutletId) return
      setLoading(true)
      
      try {
        const supabase = createClient()
        
        // Cek data investasi khusus untuk status dan catatan
        const { data: inv } = await supabase
          .from('mitra_investments')
          .select('*')
          .eq('outlet_id', selectedOutletId)
          .maybeSingle()
          
        setInvestasi(inv)
        
        if (inv) {
          // Hanya hitung ROI jika outlet punya investasi
          const stats = await getMitraRoiStats(selectedOutletId, [selectedOutletId])
          setRoiStats(stats)
        } else {
          setRoiStats(null)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
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
        ) : roiStats ? (
          <div className="space-y-6 animate-fade-in">
            {/* KPI Cards Glassmorphism */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Investasi Card */}
              <div className="bg-[#fff9f6] p-6 sm:p-8 rounded-[32px] border border-white shadow-md relative overflow-hidden flex flex-col justify-between">
                {/* Decorative blob */}
                <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-[#fdeee9] to-transparent rounded-bl-full -z-10 opacity-70"></div>
                
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h3 className="text-sm font-extrabold text-gray-400 uppercase tracking-widest">Nilai Investasi</h3>
                    <p className="text-xs text-gray-400 font-medium mt-1">Total modal disetor</p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-[#fcf0ea] to-[#fae6de] rounded-2xl shadow-sm border border-white">
                    <DollarSign className="w-6 h-6 text-[#6d2310]" />
                  </div>
                </div>

                <div>
                  <h2 className="text-3xl lg:text-4xl font-black text-[#6d2310] tracking-tighter mb-8">
                    {Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(roiStats.nilaiInvestasi)}
                  </h2>
                  
                  <div className="w-full relative">
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Progres Balik Modal</span>
                      <span className="text-xs font-black text-suka-orange">{roiStats.bepPercentage.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-[#f0f0f0] rounded-full h-2.5 overflow-hidden">
                      <div 
                        className="h-full bg-suka-orange rounded-full relative"
                        style={{ width: `${roiStats.bepPercentage}%` }}
                      >
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-[#fcb796] rounded-full translate-x-1/2 shadow-sm border-2 border-white"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ROI Aktual Card */}
              <div className="bg-[#fff9f6] p-6 sm:p-8 rounded-[32px] border border-white shadow-md relative overflow-hidden flex flex-col justify-between">
                {/* Decorative blob */}
                <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-[#fcf0ea] to-transparent rounded-bl-full -z-10 opacity-70"></div>
                
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h3 className="text-sm font-extrabold text-gray-400 uppercase tracking-widest">ROI Aktual</h3>
                    <p className="text-xs text-gray-400 font-medium mt-1">Rasio pengembalian modal</p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-[#fcf0ea] to-[#fae6de] rounded-2xl shadow-sm border border-white">
                    <Activity className="w-6 h-6 text-[#6d2310]" />
                  </div>
                </div>

                <div>
                  <h2 className="text-4xl lg:text-5xl font-black text-[#6d2310] tracking-tighter mb-4">
                    {roiStats.roi.toFixed(2).replace('.', ',')}%
                  </h2>
                  
                  <div className="flex items-center text-sm font-bold text-suka-orange">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
                    </svg>
                    <span>Terus Bertumbuh</span>
                  </div>
                </div>
              </div>

              {/* Profit Mitra Sementara Card */}
              <div className="bg-[#f0fdf4] p-6 sm:p-8 rounded-[32px] border border-white shadow-md relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-[#dcfce7] to-transparent rounded-bl-full -z-10 opacity-70"></div>
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h3 className="text-sm font-extrabold text-gray-400 uppercase tracking-widest">Profit Sementara</h3>
                    <p className="text-xs text-gray-400 font-medium mt-1">Total kumulatif (Realtime)</p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-[#dcfce7] to-[#bbf7d0] rounded-2xl shadow-sm border border-white">
                    <Wallet className="w-6 h-6 text-green-700" />
                  </div>
                </div>
                <div>
                  <h2 className="text-3xl lg:text-4xl font-black text-green-800 tracking-tighter mb-4">
                    {Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(roiStats.totalProfitKumulatif)}
                  </h2>
                  <div className="flex items-center text-sm font-bold text-green-600">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <span>Terus Bertambah</span>
                  </div>
                </div>
              </div>
              
            </div>

            {/* Catatan Admin */}
            {investasi.catatan && (
              <div className="bg-gradient-to-br from-orange-50 to-orange-100/30 p-6 rounded-[24px] border border-orange-100 shadow-sm relative overflow-hidden mt-8">
                <div className="absolute top-0 left-0 w-1 h-full bg-suka-orange"></div>
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-white/80 rounded-xl shadow-sm shrink-0">
                    <FileText className="w-5 h-5 text-suka-orange" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-suka-brown mb-1.5 text-sm uppercase tracking-wider">Catatan Khusus</h3>
                    <p className="text-suka-gray-500 text-sm font-medium leading-relaxed whitespace-pre-line">{investasi.catatan}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
