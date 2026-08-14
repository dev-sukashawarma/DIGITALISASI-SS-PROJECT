'use client'

import { useState, useMemo } from 'react'
import { CircleDollarSign, Calendar, FileText, Store, UploadCloud } from 'lucide-react'
import { InvestmentDialog } from '@/components/InvestmentDialog'
import { BulkInvestasiModal } from '@/components/BulkInvestasiModal'
import { Button } from '@suka/design-system'
import type { Outlet } from '@/lib/types'

export default function KelolaMitraView({ 
  outlets, 
  investments 
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
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(dateString))
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-extrabold text-suka-brown tracking-tight">Kelola Mitra</h2>
        <Button 
          onClick={() => setIsBulkModalOpen(true)}
          className="flex items-center gap-2 bg-suka-orange hover:bg-suka-orange/90 text-white border-0"
        >
          <UploadCloud size={16} />
          Input Massal Base Data
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {outlets.map(outlet => {
          const inv = investmentMap[outlet.id]
          const totalModal = inv?.nilai_investasi || 0
          
          return (
            <div key={outlet.id} className="bg-white rounded-2xl shadow-sm border border-suka-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-5 border-b border-suka-gray-100 bg-suka-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-600">
                    <Store size={20} />
                  </div>
                  <h3 className="font-bold text-suka-ink text-lg">{outlet.name}</h3>
                </div>
              </div>
              
              <div className="p-5 space-y-4">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Total Modal</p>
                  <p className="text-2xl font-bold text-cyan-600">{formatCurrency(totalModal)}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                      <Calendar size={14} />
                      <span className="font-medium">Mulai</span>
                    </div>
                    <p className="text-sm font-medium text-suka-ink">{formatDate(inv?.start_date)}</p>
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                      <FileText size={14} />
                      <span className="font-medium">Catatan</span>
                    </div>
                    <p className="text-sm text-gray-700 line-clamp-1" title={inv?.notes || '-'}>
                      {inv?.notes || '-'}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-gray-50 border-t border-suka-gray-100">
                <button 
                  onClick={() => setInvestmentOutlet(outlet)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 hover:text-cyan-600 transition-colors shadow-sm"
                >
                  <CircleDollarSign size={16} />
                  Atur Modal Mitra
                </button>
              </div>
            </div>
          )
        })}
        
        {outlets.length === 0 && (
          <div className="col-span-full bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
            <Store className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-500 font-medium">Belum ada outlet dengan tipe Mitra.</p>
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
