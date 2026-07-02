'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Loader2, ArrowDownToLine, Clock, User, Store } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatRupiah } from '@/lib/validations'

interface TopupRequest {
  id: string
  outlet_id: string
  amount: number
  description: string
  status: string
  created_at: string
  creator?: { name: string | null } | null
  outlet?: { name: string | null } | null
  approved_by?: string | null
  approved_at?: string | null
  approver?: { name: string | null } | null
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function PettyCashApprovalPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState<TopupRequest[]>([])
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null) // stores ID of request being processed

  useEffect(() => {
    fetchRequests()
  }, [])

  async function fetchRequests() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('petty_cash_topups')
        .select(`
          *,
          outlet:outlets(name),
          creator:outlet_staff!petty_cash_topups_created_by_fkey(name),
          approver:outlet_staff!petty_cash_topups_approved_by_fkey(name)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setRequests((data as any) || [])
    } catch (err: any) {
      console.error('Failed to fetch requests', err)
      alert('Gagal memuat data pengajuan')
    } finally {
      setLoading(false)
    }
  }

  async function handleReview(id: string, action: 'approve' | 'reject') {
    if (!confirm(`Anda yakin ingin ${action === 'approve' ? 'MENYETUJUI' : 'MENOLAK'} pengajuan ini?`)) return
    
    setIsSubmitting(id)
    try {
      const { error } = await supabase.rpc('review_petty_cash_topup', {
        p_topup_id: id,
        p_action: action
      })
      if (error) throw error
      
      // Update local state instead of full refetch for better UX
      setRequests(reqs => reqs.map(r => {
        if (r.id === id) {
          return {
            ...r,
            status: action === 'approve' ? 'approved' : 'rejected',
            // Ideally we'd fetch the user's name, but for now we just reflect status change
          }
        }
        return r
      }))
      
    } catch (err: any) {
      console.error(err)
      alert(err.message || `Gagal memproses pengajuan`)
    } finally {
      setIsSubmitting(null)
    }
  }

  const pendingRequests = requests.filter(r => r.status === 'pending')
  const historyRequests = requests.filter(r => r.status !== 'pending')

  return (
    <div className="max-w-6xl mx-auto pb-12 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <ArrowDownToLine className="w-7 h-7 text-blue-500" />
          Persetujuan Petty Cash
        </h1>
        <p className="text-gray-500 mt-1 text-sm">Kelola pengajuan Top Up Petty Cash dari seluruh outlet.</p>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Menunggu Persetujuan ({pendingRequests.length})
          </h2>
          
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 flex justify-center text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                Tidak ada pengajuan yang menunggu persetujuan.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {pendingRequests.map(req => (
                  <div key={req.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold px-2 py-1 bg-amber-100 text-amber-700 rounded-md">
                          PENDING
                        </span>
                        <span className="text-sm font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded-md flex items-center gap-1">
                          <Store className="w-3 h-3" /> {req.outlet?.name || 'Unknown Outlet'}
                        </span>
                      </div>
                      <p className="font-bold text-gray-900 text-lg mt-2">{req.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> Diajukan oleh: {req.creator?.name || 'Sistem'}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {formatDateTime(req.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-gray-500 font-bold uppercase mb-0.5">Nominal Top Up</p>
                        <p className="text-xl font-black text-blue-600">+{formatRupiah(req.amount)}</p>
                      </div>
                      <div className="h-10 w-px bg-gray-200 mx-2 hidden md:block"></div>
                      <div className="flex flex-col gap-2 w-full md:w-auto">
                        <button
                          onClick={() => handleReview(req.id, 'approve')}
                          disabled={isSubmitting !== null}
                          className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors disabled:opacity-50"
                        >
                          {isSubmitting === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                          Setujui
                        </button>
                        <button
                          onClick={() => handleReview(req.id, 'reject')}
                          disabled={isSubmitting !== null}
                          className="flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-xl font-bold text-sm transition-colors disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" /> Tolak
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-400" />
            Riwayat Persetujuan
          </h2>
          
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-8 flex justify-center text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : historyRequests.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                Belum ada riwayat persetujuan.
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {historyRequests.map(req => (
                  <div key={req.id} className="p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                          req.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        }`}>
                          {req.status === 'approved' ? 'DISETUJUI' : 'DITOLAK'}
                        </span>
                        <span className="text-xs font-bold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded-md">
                          {req.outlet?.name}
                        </span>
                      </div>
                      <p className="font-bold text-gray-900 text-sm truncate">{req.description}</p>
                      <p className="text-[11px] text-gray-500 mt-1">
                        Oleh: {req.creator?.name || 'Sistem'} &middot; {formatDateTime(req.created_at)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-black ${req.status === 'approved' ? 'text-blue-600' : 'text-gray-400 line-through'}`}>
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
    </div>
  )
}
