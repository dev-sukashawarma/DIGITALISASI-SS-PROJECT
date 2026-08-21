'use client'

import { useState, useMemo } from 'react'
import { CircleDollarSign, Calendar, FileText, Store, UploadCloud, TrendingUp, Sparkles } from 'lucide-react'
import { InvestmentDialog } from '@/components/InvestmentDialog'
import { BulkInvestasiModal } from '@/components/BulkInvestasiModal'
import type { Outlet } from '@/lib/types'

export default function KelolaMitraView({ 
  outlets = [], 
  investments = [] 
}: { 
  outlets: Outlet[]
  investments: any[] 
}) {
  const [investmentOutlet, setInvestmentOutlet] = useState<Outlet | null>(null)
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false)
  
  // Create a map of investments by outlet id
  const investmentMap = useMemo(() => {
    const map: Record<string, any> = {}
    investments.forEach(inv => {
      map[inv.outlet_id] = inv
    })
    return map
  }, [investments])

  const formatCurrency = (val: number) => {
    return 'Rp ' + Math.round(val || 0).toLocaleString('id-ID')
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(dateString))
  }

  const totalInvestasiSemua = useMemo(() => {
    return Object.values(investmentMap).reduce((acc: number, inv: any) => acc + (Number(inv.nilai_investasi) || 0), 0)
  }, [investmentMap])

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-suka-brown tracking-tight">Investasi Mitra Outlet</h1>
            <span className="bg-amber-100/80 text-amber-900 text-xs font-extrabold px-2.5 py-0.5 rounded-full border border-amber-200 shadow-sm">
              Modal Mitra
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Pengaturan base modal investasi awal dan periode mulai kemitraan per outlet.
          </p>
        </div>

        <button 
          onClick={() => setIsBulkModalOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-2xl text-xs sm:text-sm font-extrabold shadow-lg shadow-amber-500/25 transition-all hover:scale-[1.02] active:scale-95 w-fit"
        >
          <UploadCloud className="w-4 h-4" />
          Input Massal Base Data
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <div className="bg-white/80 backdrop-blur-xl border border-amber-100/80 rounded-3xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Outlet Mitra</span>
            <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/60">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 mt-3">{outlets.length} <span className="text-sm font-medium text-gray-400">Outlet</span></div>
        </div>

        <div className="bg-white/80 backdrop-blur-xl border border-amber-100/80 rounded-3xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Akumulasi Modal</span>
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200/60">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 mt-3">{formatCurrency(totalInvestasiSemua)}</div>
        </div>
      </div>

      {/* Outlet Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {outlets.map(outlet => {
          const inv = investmentMap[outlet.id]
          const totalModal = inv?.nilai_investasi || 0
          
          return (
            <div 
              key={outlet.id} 
              className="group bg-white/90 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-amber-100/80 overflow-hidden hover:shadow-lg hover:shadow-amber-500/10 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="p-5 border-b border-gray-100 bg-amber-50/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-100/80 text-amber-700 flex items-center justify-center border border-amber-200">
                      <Store size={20} />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-gray-900 text-base leading-tight group-hover:text-amber-600 transition-colors">
                        {outlet.name}
                      </h3>
                      <span className="text-[11px] text-gray-400 font-medium">Tipe: Mitra</span>
                    </div>
                  </div>
                </div>
                
                <div className="p-5 space-y-4">
                  <div>
                    <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-1">Total Modal Investasi</p>
                    <p className="text-2xl font-black text-amber-600">{formatCurrency(totalModal)}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                        <Calendar size={13} />
                        <span className="font-semibold text-[11px]">Mulai</span>
                      </div>
                      <p className="text-xs font-bold text-gray-800">{formatDate(inv?.start_date)}</p>
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                        <FileText size={13} />
                        <span className="font-semibold text-[11px]">Catatan</span>
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-1" title={inv?.notes || '-'}>
                        {inv?.notes || '-'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-gray-50/60 border-t border-gray-100">
                <button 
                  onClick={() => setInvestmentOutlet(outlet)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-gray-200 hover:border-amber-500 hover:bg-amber-500 hover:text-white rounded-xl text-xs sm:text-sm font-extrabold text-gray-700 transition-all shadow-sm group/btn"
                >
                  <CircleDollarSign size={16} className="text-amber-600 group-hover/btn:text-white transition-colors" />
                  Atur Modal Mitra
                </button>
              </div>
            </div>
          )
        })}
        
        {outlets.length === 0 && (
          <div className="col-span-full bg-white/80 backdrop-blur-xl rounded-3xl border border-dashed border-gray-300 p-12 text-center space-y-3">
            <Store className="mx-auto text-gray-300" size={48} />
            <p className="text-gray-500 font-medium text-sm">Belum ada outlet dengan tipe Mitra.</p>
          </div>
        )}
      </div>

      {investmentOutlet && (
        <InvestmentDialog
          outlet={investmentOutlet}
          onClose={() => {
            setInvestmentOutlet(null)
            window.location.reload()
          }}
        />
      )}

      <BulkInvestasiModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        outlets={outlets}
        investments={investments}
        onSuccess={() => {
          setIsBulkModalOpen(false)
          window.location.reload()
        }}
      />
    </div>
  )
}

