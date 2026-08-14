'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, XCircle, AlertTriangle, Loader2, ArrowDownToLine, Clock, User, Store, Building2, Send } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { formatRupiah } from '@/lib/validations'
import { useDialogStore } from '@/lib/dialogStore'
import { toast } from 'sonner'
import { processFinancePettyCash, forwardFinanceFunds } from './actions'

interface TopupRequest {
  id: string
  outlet_id: string
  amount: number
  description: string
  status: string
  created_at: string
  bank_name?: string | null
  bank_account_number?: string | null
  bank_account_name?: string | null
  creator?: { name: string | null } | null
  outlet?: { name: string | null } | null
  approved_by?: string | null
  approved_at?: string | null
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

interface PettyCashViewProps {
  initialRequests: TopupRequest[]
}

export default function PettyCashView({ initialRequests }: PettyCashViewProps) {
  const router = useRouter()
  const { showConfirm } = useDialogStore()
  const supabase = createClient()
  const [requests, setRequests] = useState<TopupRequest[]>(initialRequests)
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null)

  useEffect(() => {
    setRequests(initialRequests)
  }, [initialRequests])

  useEffect(() => {
    const channel = supabase.channel('petty_cash_topups_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'petty_cash_topups' },
        () => {
          toast.info('Ada pengajuan Top Up Petty Cash baru')
          router.refresh()
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'petty_cash_topups' },
        () => {
          router.refresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, router])

  async function handleProcess(id: string, action: 'approve' | 'reject') {
    const confirmed = await showConfirm(`Anda yakin ingin ${action === 'approve' ? 'MENYETUJUI & MENCAIRKAN' : 'MENOLAK'} pengajuan ini?`);
    if (!confirmed) return
    
    setIsSubmitting(id)
    try {
      const result = await processFinancePettyCash(id, action, 'transfer')
      if (!result.success) throw new Error(result.error)
      
      setRequests(reqs => reqs.map(r => {
        if (r.id === id) {
          return {
            ...r,
            status: action === 'approve' ? 'approved_by_finance' : 'rejected',
          }
        }
        return r
      }))
      
      toast.success(`Pengajuan berhasil ${action === 'approve' ? 'disetujui & dicairkan' : 'ditolak'}`)
      router.refresh()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || `Gagal memproses pengajuan`)
    } finally {
      setIsSubmitting(null)
    }
  }

  async function handleForwardToAreaManager(id: string) {
    const confirmed = await showConfirm('Konfirmasi penyerahan dana dari Finance ke Area Manager?');
    if (!confirmed) return
    
    setIsSubmitting(id)
    try {
      const result = await forwardFinanceFunds(id)
      if (!result.success) throw new Error(result.error)
      
      setRequests(reqs => reqs.map(r => {
        if (r.id === id) {
          return { ...r, status: 'forwarded_by_finance' }
        }
        return r
      }))
      
      toast.success('Dana berhasil diserahkan ke Area Manager!')
      router.refresh()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Gagal meneruskan dana')
    } finally {
      setIsSubmitting(null)
    }
  }

  const pendingFinanceRequests = requests.filter(r => r.status === 'forwarded_to_finance' || r.status === 'approved_by_finance')
  const historyRequests = requests.filter(r => r.status !== 'forwarded_to_finance' && r.status !== 'approved_by_finance')

  return (
    <div className="max-w-6xl mx-auto pb-12 animate-fade-in space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <ArrowDownToLine className="w-7 h-7 text-blue-600" />
          Persetujuan & Pencairan Finance (Data Real)
        </h1>
        <p className="text-gray-500 mt-1 text-sm">Kelola pencairan dana Petty Cash outlet dari Area Manager ke Rekening Outlet / Cash Pusat.</p>
      </div>

      {/* Action Needed Section */}
      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          Butuh Review / Pencairan Finance ({pendingFinanceRequests.length})
        </h2>
        
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          {pendingFinanceRequests.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              Tidak ada pengajuan yang menunggu persetujuan/pencairan Finance.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {pendingFinanceRequests.map(req => (
                <div key={req.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50 transition-colors">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      {req.status === 'forwarded_to_finance' && (
                        <span className="text-xs font-bold px-2.5 py-1 bg-amber-100 text-amber-800 rounded-md">
                          MENUNGGU ACC FINANCE
                        </span>
                      )}
                      {req.status === 'approved_by_finance' && (
                        <span className="text-xs font-bold px-2.5 py-1 bg-indigo-100 text-indigo-800 rounded-md">
                          DICAIRKAN (SIAP SERAHKAN KE AM)
                        </span>
                      )}
                      <span className="text-sm font-bold text-gray-900 bg-gray-100 px-2.5 py-1 rounded-md flex items-center gap-1">
                        <Store className="w-3.5 h-3.5 text-gray-500" /> {req.outlet?.name || 'Unknown Outlet'}
                      </span>
                    </div>

                    <p className="font-bold text-gray-900 text-lg">{req.description}</p>
                    
                    {/* Bank Info */}
                    <div className="text-xs text-blue-900 bg-blue-50/80 p-3 rounded-xl border border-blue-200 inline-block space-y-0.5">
                      <div className="font-bold text-blue-800 flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-blue-600" /> Rekening Tujuan Transfer Outlet:
                      </div>
                      {req.bank_name ? (
                        <div>Bank: <b>{req.bank_name}</b> | No. Rek: <b className="font-mono text-sm">{req.bank_account_number}</b> | a.n <b>{req.bank_account_name || '-'}</b></div>
                      ) : (
                        <div className="italic text-blue-600">Data rekening belum diisi saat pengajuan</div>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> Pemohon: {req.creator?.name || 'Leader'}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {formatDateTime(req.created_at)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-gray-500 font-bold uppercase mb-0.5">Nominal Top Up</p>
                      <p className="text-2xl font-black text-blue-600">+{formatRupiah(req.amount)}</p>
                    </div>

                    <div className="h-10 w-px bg-gray-200 mx-2 hidden md:block"></div>

                    <div className="flex flex-col gap-2 w-full md:w-auto">
                      {req.status === 'forwarded_to_finance' && (
                        <>
                          <button
                            onClick={() => handleProcess(req.id, 'approve')}
                            disabled={isSubmitting !== null}
                            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-colors disabled:opacity-50 shadow-sm"
                          >
                            {isSubmitting === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            Acc & Transfer
                          </button>
                          <button
                            onClick={() => handleProcess(req.id, 'reject')}
                            disabled={isSubmitting !== null}
                            className="flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-xl font-bold text-xs transition-colors disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" /> Tolak
                          </button>
                        </>
                      )}

                      {req.status === 'approved_by_finance' && (
                        <button
                          onClick={() => handleForwardToAreaManager(req.id)}
                          disabled={isSubmitting !== null}
                          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-colors disabled:opacity-50 shadow-sm"
                        >
                          {isSubmitting === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          Serahkan ke AM
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* History Section */}
      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-400" />
          Riwayat Pengajuan Finance ({historyRequests.length})
        </h2>
        
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          {historyRequests.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              Belum ada riwayat persetujuan Finance.
            </div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {historyRequests.map(req => (
                <div key={req.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                        req.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {req.status.replace(/_/g, ' ').toUpperCase()}
                      </span>
                      <span className="text-xs font-bold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded-md">
                        {req.outlet?.name}
                      </span>
                    </div>
                    <p className="font-bold text-gray-900 text-sm truncate">{req.description}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Tanggal: {formatDateTime(req.created_at)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-black ${req.status === 'rejected' ? 'text-gray-400 line-through' : 'text-blue-600'}`}>
                      +{formatRupiah(req.amount)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
