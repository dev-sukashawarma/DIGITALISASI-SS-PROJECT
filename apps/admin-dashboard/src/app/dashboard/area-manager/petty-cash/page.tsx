'use client'

import React, { useState, useEffect } from 'react'
import { CheckCircle2, Clock, Store, ShieldCheck, Send } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { formatRupiah } from '@/lib/validations'
import { toast } from 'sonner'

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
  outlet?: { name: string } | null
}

export default function AreaManagerPettyCashPage() {
  const supabase = createClient()
  const [requests, setRequests] = useState<TopupRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState<string | null>(null)

  useEffect(() => {
    loadRequests()
  }, [])

  async function loadRequests() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('petty_cash_topups')
        .select(`
          *,
          outlets!petty_cash_topups_outlet_id_fkey(name)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      if (data) {
        setRequests(data.map((r: any) => ({
          ...r,
          outlet: r.outlets ? { name: r.outlets.name } : null
        })))
      }
    } catch (err: any) {
      console.error(err)
      toast.error('Gagal memuat data petty cash: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(id: string) {
    if (!confirm('Setujui pengajuan ini dan terusan ke Finance?')) return
    setIsProcessing(id)
    try {
      const { error } = await supabase.rpc('area_manager_process_petty_cash', {
        p_topup_id: id,
        p_action: 'approve'
      })
      if (error) throw error

      toast.success('Pengajuan disetujui & diteruskan ke Finance!')
      await loadRequests()
    } catch (err: any) {
      toast.error('Gagal menyetujui pengajuan: ' + err.message)
    } finally {
      setIsProcessing(null)
    }
  }

  async function handleReject(id: string) {
    if (!confirm('Tolak pengajuan ini? Status akan menjadi Ditolak.')) return
    setIsProcessing(id)
    try {
      const { error } = await supabase.rpc('area_manager_process_petty_cash', {
        p_topup_id: id,
        p_action: 'reject'
      })
      if (error) throw error

      toast.error('Pengajuan telah ditolak.')
      await loadRequests()
    } catch (err: any) {
      toast.error('Gagal menolak pengajuan: ' + err.message)
    } finally {
      setIsProcessing(null)
    }
  }

  async function handleForwardToLeader(id: string) {
    if (!confirm('Teruskan penyerahan dana ke Leader Cabang?')) return
    setIsProcessing(id)
    try {
      const { error } = await supabase.rpc('area_manager_forward_funds', {
        p_topup_id: id
      })
      if (error) throw error

      toast.success('Dana berhasil diserahkan ke Leader!')
      await loadRequests()
    } catch (err: any) {
      toast.error('Gagal penyerahan dana: ' + err.message)
    } finally {
      setIsProcessing(null)
    }
  }

  const reviewRequests = requests.filter(r => 
    r.status === 'forwarded_to_area_manager' || 
    r.status === 'approved_by_finance' || 
    r.status === 'forwarded_by_finance'
  )
  
  const historyRequests = requests.filter(r => 
    r.status !== 'forwarded_to_area_manager' && 
    r.status !== 'approved_by_finance' && 
    r.status !== 'forwarded_by_finance'
  )

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2.5">
          <ShieldCheck className="w-7 h-7 text-indigo-600" />
          Dashboard Area Manager - Approval Petty Cash
        </h1>
        <p className="text-sm text-slate-500 mt-1">Review pengajuan dana dari cabang-cabang dan kelola serah terima ke Leader (Data Real Supabase).</p>
      </div>

      {/* Review Section */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-500" />
          Butuh Review / Serah Terima Area Manager ({reviewRequests.length})
        </h2>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-400 font-medium">Memuat data...</div>
          ) : reviewRequests.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              Tidak ada pengajuan yang membutuhkan persetujuan/tindakan Area Manager saat ini.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {reviewRequests.map((req) => (
                <div key={req.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Store className="w-3.5 h-3.5 text-slate-400" /> {req.outlet?.name || 'Unknown Outlet'}
                      </span>
                      {req.status === 'forwarded_to_area_manager' && (
                        <span className="text-xs font-bold px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md">
                          MENUNGGU ACC AM
                        </span>
                      )}
                      {(req.status === 'approved_by_finance' || req.status === 'forwarded_by_finance') && (
                        <span className="text-xs font-bold px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md">
                          DICAIRKAN FINANCE (TERUSKAN KE LEADER)
                        </span>
                      )}
                    </div>

                    <p className="font-bold text-slate-900 text-base">{req.description}</p>
                    
                    {/* Bank Info */}
                    <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200 inline-block">
                      <span className="font-bold text-slate-700">Rekening Tujuan: </span>
                      {req.bank_name ? (
                        <span>{req.bank_name} - <b>{req.bank_account_number}</b> (a.n {req.bank_account_name || '-'})</span>
                      ) : (
                        <span className="italic text-slate-400">Belum ada</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Nominal</p>
                      <p className="text-xl font-black text-blue-600">{formatRupiah(req.amount)}</p>
                    </div>

                    <div className="flex gap-2">
                      {req.status === 'forwarded_to_area_manager' && (
                        <>
                          <button
                            onClick={() => handleReject(req.id)}
                            disabled={isProcessing === req.id}
                            className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold text-xs transition-colors disabled:opacity-50"
                          >
                            Tolak
                          </button>
                          <button
                            onClick={() => handleApprove(req.id)}
                            disabled={isProcessing === req.id}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-colors shadow-sm disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Acc & Ke Finance
                          </button>
                        </>
                      )}

                      {(req.status === 'approved_by_finance' || req.status === 'forwarded_by_finance') && (
                        <button
                          onClick={() => handleForwardToLeader(req.id)}
                          disabled={isProcessing === req.id}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-colors shadow-sm disabled:opacity-50"
                        >
                          <Send className="w-4 h-4" />
                          Serahkan ke Leader
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
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-800">Riwayat Pengajuan Area Manager ({historyRequests.length})</h2>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                  <th className="px-6 py-3 font-semibold">Outlet</th>
                  <th className="px-6 py-3 font-semibold">Nominal</th>
                  <th className="px-6 py-3 font-semibold">Alasan</th>
                  <th className="px-6 py-3 font-semibold">Status Final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {historyRequests.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                      Belum ada riwayat pengajuan.
                    </td>
                  </tr>
                ) : (
                  historyRequests.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-3.5 font-bold text-slate-800">{r.outlet?.name || '-'}</td>
                      <td className="px-6 py-3.5 font-black text-slate-900">{formatRupiah(r.amount)}</td>
                      <td className="px-6 py-3.5 text-slate-600 max-w-xs truncate">{r.description}</td>
                      <td className="px-6 py-3.5">
                        {r.status === 'forwarded_by_area_manager' && (
                          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-full">Diserahkan ke Leader</span>
                        )}
                        {r.status === 'forwarded_by_leader' && (
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold text-xs rounded-full">Diserahkan ke Crew</span>
                        )}
                        {r.status === 'completed' && (
                          <span className="px-2.5 py-1 bg-emerald-500 text-white font-bold text-xs rounded-full">Selesai</span>
                        )}
                        {r.status === 'rejected' && (
                          <span className="px-2.5 py-1 bg-red-50 text-red-700 font-bold text-xs rounded-full">Ditolak</span>
                        )}
                        {r.status === 'forwarded_to_finance' && (
                          <span className="px-2.5 py-1 bg-blue-50 text-blue-700 font-bold text-xs rounded-full">Menunggu Finance</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}
