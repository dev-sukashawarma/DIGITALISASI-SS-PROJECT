'use client'

import { useState } from 'react'
import { useAuth } from '@suka/auth'
import { useOutletBudgetStatus, useOutletTopupRequests, useRequestBudgetTopup, useApproveBudgetTopup } from '@/hooks/useOutletBudget'
import { Loader2, Plus, Check, X, Clock } from 'lucide-react'
import { toast } from 'sonner'

export function OutletTopUpRequests({ outletId }: { outletId: string }) {
  const { outletStaff } = useAuth()
  const { status } = useOutletBudgetStatus(outletId)
  const { requests, loading } = useOutletTopupRequests(outletId)
  
  const role = outletStaff?.role || ''
  const isCrew = ['admin_kitchen', 'kitchen', 'kasir'].includes(role)
  const isAM = role === 'admin' || role === 'owner' || role === 'developer' // Assuming AM role maps to admin here
  const isFinance = role === 'developer' || role === 'owner' || role === 'admin_finance'

  if (!status?.hasConfig) return null

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-suka-brown">Permintaan Top-Up Saldo</h3>
        {isCrew && <RequestTopUpModal outletId={outletId} plafon={status.nominal} sisa={status.sisa} />}
      </div>

      <div className="bg-white rounded-3xl border border-suka-brown/10 p-5 shadow-sm">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-suka-orange" /></div>
        ) : requests.length === 0 ? (
          <p className="text-center text-suka-brown/60 text-sm font-medium py-6">Belum ada riwayat permintaan top-up.</p>
        ) : (
          <div className="space-y-4">
            {requests.map((req: any) => (
              <RequestItem 
                key={req.id} 
                request={req} 
                canApproveAM={isAM && req.status === 'pending_am'} 
                canApproveFinance={isFinance && req.status === 'pending_finance'}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function RequestTopUpModal({ outletId, plafon, sisa }: { outletId: string, plafon: number, sisa: number }) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState<string>('')
  const [category, setCategory] = useState<'weekday' | 'weekend'>('weekday')
  
  const maxRequest = Math.max(0, plafon - Math.max(0, sisa))
  const { mutateAsync: requestTopUp, isPending } = useRequestBudgetTopup()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const numAmount = parseInt(amount.replace(/\D/g, ''), 10)
    
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Nominal tidak valid')
      return
    }
    
    if (numAmount > maxRequest) {
      toast.error(`Maksimal top-up adalah Rp ${maxRequest.toLocaleString('id-ID')}`)
      return
    }

    try {
      await requestTopUp({ outletId, requestedAmount: numAmount, periodCategory: category })
      toast.success('Permintaan top-up berhasil diajukan')
      setOpen(false)
      setAmount('')
    } catch (e: any) {
      toast.error(e.message || 'Gagal mengajukan top-up')
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-suka-orange text-white rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-orange-600 transition-colors"
      >
        <Plus className="w-4 h-4" /> Ajukan Top-Up
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-xl border border-suka-brown/10">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-extrabold text-suka-brown text-lg">Form Pengajuan Top-Up</h4>
              <button onClick={() => setOpen(false)} className="text-suka-brown/40 hover:text-suka-brown">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6 p-4 rounded-xl bg-suka-cream/30 border border-suka-brown/10 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-suka-brown/60">Plafon Maksimal:</span>
                <span className="font-bold text-suka-brown">Rp {plafon.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-medium text-suka-brown/60">Sisa Saldo:</span>
                <span className="font-bold text-suka-brown">Rp {sisa.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-suka-brown/10 pt-2 mt-2">
                <span className="font-extrabold text-suka-brown/80">Maksimal Pengajuan:</span>
                <span className="font-black text-suka-orange">Rp {maxRequest.toLocaleString('id-ID')}</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-suka-brown/80 mb-1.5">Nominal Top-Up</label>
                <input
                  type="text"
                  value={amount}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '')
                    if (val) {
                      const num = parseInt(val, 10)
                      if (num > maxRequest) {
                        setAmount(maxRequest.toLocaleString('id-ID'))
                      } else {
                        setAmount(num.toLocaleString('id-ID'))
                      }
                    } else {
                      setAmount('')
                    }
                  }}
                  placeholder="Masukkan nominal..."
                  className="w-full bg-white border border-suka-brown/10 text-suka-brown rounded-xl px-4 py-3 focus:ring-2 focus:ring-suka-orange focus:border-suka-orange shadow-sm font-bold transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-suka-brown/80 mb-1.5">Kategori Periode</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCategory('weekday')}
                    className={`flex-1 py-2.5 rounded-xl border text-sm font-bold transition-colors ${category === 'weekday' ? 'border-suka-orange bg-suka-orange/10 text-suka-orange' : 'border-suka-brown/10 text-suka-brown/60 bg-suka-cream/20 hover:bg-suka-cream'}`}
                  >
                    Weekday
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategory('weekend')}
                    className={`flex-1 py-2.5 rounded-xl border text-sm font-bold transition-colors ${category === 'weekend' ? 'border-suka-orange bg-suka-orange/10 text-suka-orange' : 'border-suka-brown/10 text-suka-brown/60 bg-suka-cream/20 hover:bg-suka-cream'}`}
                  >
                    Weekend
                  </button>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 py-3 border border-suka-brown/20 text-suka-brown font-bold rounded-xl hover:bg-suka-cream/50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending || !amount}
                  className="flex-1 py-3 bg-suka-orange text-white font-extrabold rounded-xl hover:bg-orange-600 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? 'Memproses...' : 'Kirim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

function RequestItem({ request, canApproveAM, canApproveFinance }: { request: any, canApproveAM: boolean, canApproveFinance: boolean }) {
  const { mutateAsync: approve, isPending } = useApproveBudgetTopup()
  
  const handleApprove = async (action: 'approve_am' | 'approve_finance' | 'reject') => {
    try {
      await approve({ requestId: request.id, action })
      toast.success(action === 'reject' ? 'Permintaan ditolak' : 'Permintaan disetujui')
    } catch (e: any) {
      toast.error(e.message || 'Gagal memproses')
    }
  }

  return (
    <div className="border border-suka-brown/10 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-suka-cream/10">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-extrabold text-suka-brown text-base">Rp {request.requested_amount.toLocaleString('id-ID')}</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-suka-brown/5 text-suka-brown/60 uppercase">
            {request.period_category}
          </span>
        </div>
        <div className="text-xs text-suka-brown/60 font-medium space-y-1">
          <p>Dibuat: {new Date(request.created_at).toLocaleString('id-ID')}</p>
          <p>Oleh: {request.created_by_staff?.name || 'Sistem'}</p>
        </div>
      </div>

      <div className="flex flex-col sm:items-end gap-2 w-full sm:w-auto">
        <StatusBadge status={request.status} />
        
        {canApproveAM && (
          <div className="flex gap-2 w-full sm:w-auto mt-2">
            <button
              onClick={() => handleApprove('reject')}
              disabled={isPending}
              className="flex-1 sm:flex-none px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              Tolak (AM)
            </button>
            <button
              onClick={() => handleApprove('approve_am')}
              disabled={isPending}
              className="flex-1 sm:flex-none px-3 py-1.5 bg-suka-orange text-white rounded-lg text-xs font-bold hover:bg-orange-600 shadow-sm transition-colors disabled:opacity-50"
            >
              Setujui (AM)
            </button>
          </div>
        )}
        
        {canApproveFinance && (
          <div className="flex gap-2 w-full sm:w-auto mt-2">
            <button
              onClick={() => handleApprove('reject')}
              disabled={isPending}
              className="flex-1 sm:flex-none px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              Tolak (Finance)
            </button>
            <button
              onClick={() => handleApprove('approve_finance')}
              disabled={isPending}
              className="flex-1 sm:flex-none px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 shadow-sm transition-colors disabled:opacity-50"
            >
              Setujui (Finance)
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'pending_am') {
    return <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200"><Clock className="w-3.5 h-3.5" /> Menunggu AM</span>
  }
  if (status === 'pending_finance') {
    return <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200"><Clock className="w-3.5 h-3.5" /> Menunggu Finance</span>
  }
  if (status === 'approved') {
    return <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200"><Check className="w-3.5 h-3.5" /> Disetujui</span>
  }
  if (status === 'rejected') {
    return <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-lg border border-red-200"><X className="w-3.5 h-3.5" /> Ditolak</span>
  }
  return <span className="inline-flex items-center gap-1.5 text-xs font-bold text-suka-brown/60 bg-suka-brown/5 px-2.5 py-1 rounded-lg border border-suka-brown/10">{status}</span>
}
