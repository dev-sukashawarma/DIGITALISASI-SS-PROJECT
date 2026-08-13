// @ts-nocheck
import { useState, useEffect } from 'react'
import { Button } from '@suka/design-system'
import { CheckCircle2, AlertTriangle, X, Save } from 'lucide-react'
import { bulkUpdateMitraInvestmentsAction } from '@/app/actions/bulkInvestments'
import type { Outlet } from '@/lib/types'

export function BulkInvestasiModal({
  isOpen,
  onClose,
  outlets,
  investments,
  onSuccess
}: {
  isOpen: boolean
  onClose: () => void
  outlets: Outlet[]
  investments: any[]
  onSuccess: () => void
}) {
  const [data, setData] = useState<Record<string, { modal: string, profit: string }>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      // Initialize with existing data
      const initial: Record<string, { modal: string, profit: string }> = {}
      outlets.forEach(o => {
        const inv = investments.find(i => i.outlet_id === o.id)
        initial[o.id] = {
          modal: inv ? inv.nilai_investasi?.toString() || '0' : '0',
          profit: inv ? inv.omzet_historis?.toString() || '0' : '0'
        }
      })
      setData(initial)
      setError(null)
    }
  }, [isOpen, outlets, investments])

  if (!isOpen) return null

  const handleInputChange = (outletId: string, field: 'modal' | 'profit', value: string) => {
    // Only allow numbers
    if (value && !/^\d*$/.test(value)) return
    
    setData(prev => ({
      ...prev,
      [outletId]: {
        ...prev[outletId],
        [field]: value
      }
    }))
  }

  const handleSave = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const payload = outlets.map(o => ({
        outlet_id: o.id,
        nilai_investasi: Number(data[o.id]?.modal || 0),
        omzet_historis: Number(data[o.id]?.profit || 0)
      }))

      await bulkUpdateMitraInvestmentsAction(payload)
      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan data massal.')
    } finally {
      setLoading(false)
    }
  }

  const formatRupiah = (val: string) => {
    const num = parseInt(val || '0', 10)
    if (isNaN(num)) return 'Rp 0'
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h3 className="text-xl font-bold text-suka-ink">Input Massal Modal & Profit Historis</h3>
            <p className="text-sm text-suka-gray-500 mt-1">Pindahkan angka dari laporan PDF (Total Modal Mitra & Total Profit Mitra Sementara) ke sini.</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors text-suka-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100 mb-4 shrink-0">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="overflow-y-auto border border-suka-gray-200 rounded-xl flex-1 bg-suka-gray-50">
          <table className="w-full text-left text-sm">
            <thead className="bg-white sticky top-0 shadow-sm z-10 border-b border-suka-gray-200">
              <tr>
                <th className="px-4 py-3 font-semibold text-suka-ink w-[25%]">Nama Outlet</th>
                <th className="px-4 py-3 font-semibold text-suka-ink w-[30%]">Total Modal Mitra</th>
                <th className="px-4 py-3 font-semibold text-suka-ink w-[30%]">Profit Historis (Sementara)</th>
                <th className="px-4 py-3 font-semibold text-suka-ink w-[15%] text-right">Est. ROI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-suka-gray-200">
              {outlets.map((outlet, idx) => {
                const modalStr = data[outlet.id]?.modal || '0'
                const profitStr = data[outlet.id]?.profit || '0'
                const modal = parseInt(modalStr, 10) || 0
                const profit = parseInt(profitStr, 10) || 0
                const roi = modal > 0 ? ((profit / modal) * 100) : 0
                
                return (
                <tr key={outlet.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-suka-gray-50/50'}>
                  <td className="px-4 py-3 font-medium text-suka-ink">
                    {outlet.name}
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-suka-gray-400 font-medium">Rp</span>
                        <input 
                          type="text" 
                          inputMode="numeric"
                          value={data[outlet.id]?.modal || ''}
                          onChange={(e) => handleInputChange(outlet.id, 'modal', e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-white border border-suka-gray-300 rounded-lg text-suka-ink focus:outline-none focus:ring-2 focus:ring-suka-orange focus:border-transparent font-medium"
                          placeholder="0"
                        />
                      </div>
                      <p className="text-[10px] text-suka-gray-400 font-medium ml-1">
                        {formatRupiah(data[outlet.id]?.modal)}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-suka-gray-400 font-medium">Rp</span>
                        <input 
                          type="text" 
                          inputMode="numeric"
                          value={data[outlet.id]?.profit || ''}
                          onChange={(e) => handleInputChange(outlet.id, 'profit', e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-white border border-suka-gray-300 rounded-lg text-suka-ink focus:outline-none focus:ring-2 focus:ring-suka-orange focus:border-transparent font-medium"
                          placeholder="0"
                        />
                      </div>
                      <p className="text-[10px] text-suka-gray-400 font-medium ml-1">
                        {formatRupiah(data[outlet.id]?.profit)}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-bold ${roi > 0 ? 'text-suka-green' : 'text-suka-gray-400'}`}>
                      {roi.toFixed(2).replace('.', ',')}%
                    </span>
                  </td>
                </tr>
              )})}
              {outlets.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-suka-gray-500 font-medium">
                    Belum ada outlet mitra.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-suka-gray-100 shrink-0">
          <Button variant="ghost" onClick={onClose} disabled={loading}>Batal</Button>
          <Button 
            onClick={handleSave} 
            disabled={loading || outlets.length === 0}
            className="flex items-center gap-2"
          >
            {loading ? 'Menyimpan...' : <><Save className="w-4 h-4" /> Simpan Semua Data</>}
          </Button>
        </div>
      </div>
    </div>
  )
}
