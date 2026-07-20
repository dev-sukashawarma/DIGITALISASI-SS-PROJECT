'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@suka/auth'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { approveOpname, rejectOpname, fetchPendingOpnameApprovals } from '@/app/actions/opname'
import { BottomNav } from '@/components/common/BottomNav'

type PendingOpname = Awaited<ReturnType<typeof fetchPendingOpnameApprovals>>[number]

export default function OpnameApprovalPage() {
  const { outletStaff } = useAuth()
  const router = useRouter()

  const [list, setList] = useState<PendingOpname[]>([])
  const [loading, setLoading] = useState(true)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchPendingOpnameApprovals(outletStaff?.outlet_id)
      setList(data ?? [])
    } catch (err: any) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [outletStaff?.outlet_id])

  useEffect(() => { load() }, [load])

  const handleApprove = async (opnameId: string) => {
    setBusy(true)
    try {
      await approveOpname(opnameId)
      showToast('✅ Opname berhasil disetujui dan difinalisasi!')
      load()
    } catch (err: any) {
      showToast(`🔴 Gagal: ${err.message}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rejectingId || !rejectReason.trim()) return
    setBusy(true)
    try {
      await rejectOpname(rejectingId, rejectReason)
      showToast('⚠️ Opname ditolak. Crew akan diminta input ulang.')
      setRejectingId(null)
      setRejectReason('')
      load()
    } catch (err: any) {
      showToast(`🔴 Gagal: ${err.message}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })

  if (!outletStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fff8f1]">
        <div className="w-10 h-10 border-4 border-[#701604] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-32">
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 z-50 font-bold text-sm text-white transition-all ${
          toast.type === 'success' ? 'bg-[#0a7d2c] border-[#93f997]/30' : 'bg-[#ba1a1a] border-[#ffdad6]/30'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <header className="bg-[#fff8f1] border-b border-[#d9c2b2]/30 px-4 py-4 flex items-center justify-between shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Link href="/stok/opname" className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-[#d9c2b2]/30 text-[#f29744] hover:bg-orange-50 active:scale-95 transition-all shadow-sm">
            <span className="text-base">←</span>
          </Link>
          <div>
            <h1 className="font-bold text-sm text-[#701604] uppercase tracking-tight leading-tight">
              Persetujuan Opname
            </h1>
            <p className="text-[10px] text-[#544437]/75 font-bold mt-0.5">
              Leader: {outletStaff.name}
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="px-3 py-1.5 bg-white border border-[#d9c2b2]/40 rounded-xl text-xs font-bold text-[#544437]/80 hover:bg-[#fff8f1] active:scale-95 transition-all shadow-sm"
        >
          ↻ Refresh
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-4 mt-6 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center py-20">
            <div className="w-10 h-10 border-4 border-[#701604] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold text-[#701604]/70 mt-4 uppercase tracking-wider animate-pulse">Memuat...</p>
          </div>
        ) : list.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-[#d9c2b2]/40 shadow-sm">
            <div className="text-4xl mb-3">✅</div>
            <p className="font-bold text-sm text-[#701604]/80">Tidak Ada yang Perlu Disetujui</p>
            <p className="text-xs text-gray-500 mt-1">Semua opname sudah diproses.</p>
          </div>
        ) : (
          list.map((opname) => {
            const flaggedItems = opname.opname_item?.filter(i => i.flagged) ?? []
            const totalItems = opname.opname_item?.length ?? 0

            return (
              <div key={opname.id} className="bg-white rounded-2xl border border-amber-200 shadow-[0px_4px_16px_rgba(245,158,11,0.08)] overflow-hidden">
                {/* Card Header */}
                <div className="bg-amber-50 border-b border-amber-100 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">⏳</span>
                    <div>
                      <p className="font-bold text-xs text-amber-800 uppercase tracking-wide">
                        {formatDate(opname.tanggal)}
                      </p>
                      <p className="text-[10px] text-amber-700/70 font-semibold mt-0.5">
                        👤 {opname.outlet_staff?.name ?? 'Unknown'}
                      </p>
                    </div>
                  </div>
                  <span className="bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider">
                    Menunggu
                  </span>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-3">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-[#faf2e9] rounded-xl px-3 py-2 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#544437]/60">Total Item</p>
                      <p className="text-lg font-black text-[#701604]">{totalItems}</p>
                    </div>
                    <div className="bg-red-50 rounded-xl px-3 py-2 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-red-600/70">Selisih Kritis</p>
                      <p className="text-lg font-black text-red-700">{flaggedItems.length}</p>
                    </div>
                  </div>

                  {/* Flagged Items Preview */}
                  {flaggedItems.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-[#544437]/50">Item Bermasalah</p>
                      {flaggedItems.slice(0, 3).map((item: any) => (
                        <div key={item.bahan_baku_id} className="flex justify-between items-center bg-red-50 border border-red-100 rounded-lg px-3 py-1.5">
                          <span className="text-[10px] font-bold text-red-800 font-mono truncate">
                            {item.bahan_baku_id?.slice(0, 8)}...
                          </span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded ${
                            (item.selisih ?? 0) < 0 ? 'text-red-700 bg-red-100' : 'text-green-700 bg-green-100'
                          }`}>
                            {(item.selisih ?? 0) > 0 ? '+' : ''}{item.selisih}
                          </span>
                        </div>
                      ))}
                      {flaggedItems.length > 3 && (
                        <p className="text-[9px] text-gray-400 font-medium text-center">
                          +{flaggedItems.length - 3} item lainnya
                        </p>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  {opname.notes && (
                    <div className="bg-[#fff8f1] border border-[#d9c2b2]/30 rounded-lg px-3 py-2">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-[#544437]/50 mb-1">Catatan Crew</p>
                      <p className="text-xs text-gray-600">{opname.notes}</p>
                    </div>
                  )}

                  {/* Detail Link */}
                  <Link href={`/stok/opname/${opname.id}`} className="block text-center text-[10px] font-bold text-[#f29744] hover:text-orange-600 underline underline-offset-2">
                    Lihat Detail Lengkap →
                  </Link>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-1">
                    <button
                      disabled={busy}
                      onClick={() => handleApprove(opname.id)}
                      className="flex-1 py-2.5 bg-[#0a7d2c] hover:bg-green-800 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all active:scale-[0.98] disabled:opacity-50 shadow-sm"
                    >
                      ✅ Setujui
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => setRejectingId(opname.id)}
                      className="flex-1 py-2.5 bg-white hover:bg-red-50 text-[#ba1a1a] border border-red-200 rounded-xl font-bold text-xs uppercase tracking-wider transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                      ❌ Tolak
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </main>

      <BottomNav />

      {/* Reject Modal */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-sm font-black text-[#701604] uppercase tracking-wide mb-1">Tolak Opname</h2>
            <p className="text-xs text-gray-500 mb-4">Berikan alasan penolakan agar crew dapat memperbaiki inputan.</p>
            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <textarea
                autoFocus
                placeholder="Contoh: Ada item yang tidak dihitung, foto timbangan tidak sesuai..."
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                required
                className="w-full px-4 py-3 border border-[#d9c2b2]/40 rounded-xl text-xs text-[#1e1b15] focus:outline-none focus:ring-1 focus:ring-[#f29744] focus:border-[#f29744] min-h-[90px] resize-none font-medium"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setRejectingId(null); setRejectReason('') }}
                  className="flex-1 py-2.5 bg-white border border-[#d9c2b2]/40 rounded-xl text-xs font-bold text-[#544437] hover:bg-[#fff8f1] transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={busy || !rejectReason.trim()}
                  className="flex-1 py-2.5 bg-[#ba1a1a] hover:bg-red-800 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50"
                >
                  Tolak Opname
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
