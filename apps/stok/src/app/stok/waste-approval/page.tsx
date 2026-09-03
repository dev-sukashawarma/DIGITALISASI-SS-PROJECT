// @ts-nocheck
'use client'
import { useState } from 'react'
import { Card, Button, Input } from '@suka/design-system'
import { approveWasteReport, rejectWasteReport } from '@/app/actions/waste'
import { toast } from 'sonner'
import { useStokBalance } from '@/hooks/useStokBalance'
import { useWasteApprovalList } from '@/hooks/useWaste'
import { useAuth } from '@suka/auth'
import { formatTriUnitSaldo, convertGramToBesar } from '@/lib/format/compositeUnit'
import { AppLayout } from '@/components/layout/AppLayout'
import { UserAvatarDropdown } from '@/components/common/UserAvatarDropdown'

export default function WasteApprovalPage() {
  const { outletStaff } = useAuth()
  const outletId = outletStaff?.outlet_id

  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const { balances } = useStokBalance(outletId || '')
  const { reports, loading, refresh: loadReports } = useWasteApprovalList()

  const handleApprove = async (id: string, qty: number, bahanBakuId: string) => {
    const bal = balances.find(b => b.bahan_baku_id === bahanBakuId)
    // qty (laporan waste) selalu besar-scale mentah; bal.saldo bisa gram-scale
    // -- samakan skala dulu sebelum dibandingkan (§4).
    const currentSaldoBesar = bal?.saldo_is_gram
      ? convertGramToBesar(bal.saldo, reports.find(r => r.bahan_baku_id === bahanBakuId)?.bahan_baku ?? {})
      : (bal?.saldo || 0)

    if (qty > currentSaldoBesar) {
      const confirmMsg = `WARNING: Qty waste (${qty}) lebih besar dari saldo saat ini (${currentSaldoBesar}). Saldo akan menjadi negatif. Tetap setujui?`
      if (!window.confirm(confirmMsg)) return
    }

    try {
      await approveWasteReport(id)
      toast.success('Laporan disetujui')
      loadReports()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rejectingId || !rejectReason) return
    try {
      await rejectWasteReport(rejectingId, rejectReason)
      toast.success('Laporan ditolak')
      setRejectingId(null)
      setRejectReason('')
      loadReports()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-3">
        <span className="text-4xl animate-bounce">♻️</span>
        <p className="text-sm font-bold text-suka-brown/60 tracking-widest uppercase">Memuat Laporan...</p>
      </div>
    </div>
  )

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto flex flex-col h-full bg-[#faf2e9]/30">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#701604] tracking-tight flex items-center gap-2">
            <span>🗑️</span> Persetujuan Waste
          </h1>
          <p className="text-sm font-semibold text-[#544437]/70 mt-1">Kelola dan tinjau laporan waste dari outlet.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadReports()}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-[#d9c2b2] text-[#544437] rounded-xl text-sm font-bold shadow-sm hover:bg-[#faf2e9] active:scale-95 transition-all"
          >
            <span>🔄</span> Refresh
          </button>
          <UserAvatarDropdown />
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-white border border-[#d9c2b2]/40 rounded-3xl p-12 text-center shadow-sm min-h-[300px]">
          <span className="text-5xl opacity-50 mb-4">✨</span>
          <h3 className="text-lg font-bold text-[#544437]">Semua Bersih!</h3>
          <p className="text-[#544437]/60 font-medium max-w-sm mt-2">Tidak ada laporan waste yang menunggu persetujuan saat ini.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {reports.map(r => {
            const bal = balances.find(b => b.bahan_baku_id === r.bahan_baku_id)
            // r.qty (laporan PENDING, belum di-approve) selalu besar-scale
            // mentah -- konversi ke gram baru terjadi di trigger
            // process_waste_report_approval SAAT approve (§4). bal.saldo
            // bisa gram-scale, jadi disamakan dulu ke besar sebelum
            // dibandingkan -- kalau tidak, warning defisit salah nyala/mati.
            const currentSaldoBesar = bal?.saldo_is_gram
              ? convertGramToBesar(bal.saldo, r.bahan_baku ?? {})
              : (bal?.saldo || 0)
            const isNegativeWarning = r.qty > currentSaldoBesar

            const createdDate = r.created_at ? new Date(r.created_at) : null
            const formattedDate = createdDate 
              ? createdDate.toLocaleString('id-ID', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '-'

            return (
              <div key={r.id} className="bg-white border border-[#d9c2b2]/60 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col relative group">
                {/* Header Card */}
                <div className="flex justify-between items-start mb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-block text-[10px] font-black bg-[#ffdcc2] text-[#6d3900] px-2 py-0.5 rounded uppercase tracking-wider">
                        Laporan Waste
                      </span>
                      {r.created_at && (
                        <span className="text-[10px] font-semibold text-[#544437]/60 flex items-center gap-1">
                          🕒 {formattedDate}
                        </span>
                      )}
                    </div>
                    <h3 className="font-black text-[#701604] text-lg leading-tight mt-1">{r.bahan_baku?.nama}</h3>
                    <p className="text-[11px] font-bold text-[#544437]/70 uppercase tracking-wide flex items-center gap-1">
                      <span>🏪</span> {r.outlets?.name?.replace('SUKA SHAWARMA ', '') || 'Unknown'}
                    </p>
                  </div>
                  <div className="text-right">
                    {/* r.qty selalu besar-scale mentah (belum di-approve, lihat
                        catatan currentSaldoBesar di atas) -- pakai formatter
                        besar-scale biasa, BUKAN Adaptive. */}
                    <p className="font-black text-lg text-[#ba1a1a] whitespace-pre-line">{formatTriUnitSaldo(
                      r.qty,
                      r.bahan_baku?.satuan || '',
                      r.bahan_baku?.satuan_tengah,
                      r.bahan_baku?.faktor_tengah,
                      r.bahan_baku?.satuan_kecil,
                      r.bahan_baku?.faktor_tampilan,
                      true
                    )}</p>
                  </div>
                </div>

                {/* Reporter & Time Info */}
                <div className="flex items-center justify-between gap-2 mb-4 p-2.5 bg-[#faf2e9] rounded-xl border border-[#d9c2b2]/30">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-[#d9c2b2] flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                      {r.reported_by_staff?.name?.charAt(0) || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-[#544437]/60 uppercase leading-none">Dilaporkan Oleh</p>
                      <p className="text-xs font-bold text-[#1e1b15] truncate mt-0.5">{r.reported_by_staff?.name || 'Unknown'}</p>
                    </div>
                  </div>
                  {r.created_at && (
                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-semibold text-[#544437]/60 uppercase leading-none">Waktu Dibuat</p>
                      <p className="text-xs font-bold text-[#701604] mt-0.5">{formattedDate}</p>
                    </div>
                  )}
                </div>

                {/* Reason */}
                <div className="bg-white border border-dashed border-[#d9c2b2] p-3 rounded-xl text-sm mb-4">
                  <span className="font-bold text-[#544437] text-[11px] uppercase tracking-wider block mb-1">Alasan Waste:</span>
                  <p className="text-[#1e1b15] font-medium italic">"{r.reason}"</p>
                </div>

                {/* Negative Warning */}
                {isNegativeWarning && (
                  <div className="bg-red-50 text-red-700 text-[11px] font-bold p-3 rounded-xl border border-red-200 mb-4 flex gap-2 items-start">
                    <span className="text-base leading-none">⚠️</span>
                    <p>Saldo saat ini: <span className="font-black">{bal?.saldo || 0}</span>. Menyetujui ini akan membuat stok menjadi negatif!</p>
                  </div>
                )}

                {/* Photo Proof */}
                {r.photo_url && (
                  <div className="mb-4">
                    <a href={r.photo_url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 w-full py-2 bg-[#f0f9ff] text-[#0284c7] border border-[#bae6fd] hover:bg-[#e0f2fe] rounded-xl text-xs font-bold transition-colors">
                      <span>📸</span> Lihat Foto Bukti
                    </a>
                  </div>
                )}

                <div className="flex-grow"></div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t border-[#d9c2b2]/30 mt-2">
                  <button 
                    className="flex-1 bg-suka-green hover:bg-green-700 text-white font-bold text-sm py-2.5 rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5" 
                    onClick={() => handleApprove(r.id, r.qty, r.bahan_baku_id)}
                  >
                    <span>✓</span> Setujui
                  </button>
                  <button 
                    className="flex-1 bg-white border-2 border-red-200 text-red-600 hover:bg-red-50 font-bold text-sm py-2.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5"
                    onClick={() => setRejectingId(r.id)}
                  >
                    <span>✕</span> Tolak
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Reject Modal */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-[#d9c2b2]/50 transform transition-all">
            <h2 className="text-xl font-black text-[#701604] mb-2 flex items-center gap-2">
              <span>⚠️</span> Tolak Laporan
            </h2>
            <p className="text-sm font-semibold text-[#544437]/70 mb-5">Berikan alasan penolakan waste ini.</p>
            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-[#544437] uppercase tracking-wider mb-1.5 block">Alasan Penolakan</label>
                <textarea
                  autoFocus
                  placeholder="Misal: Foto buram, salah item..."
                  className="w-full p-3 bg-[#faf2e9] border border-[#d9c2b2]/50 rounded-xl focus:ring-2 focus:ring-suka-orange focus:border-suka-orange outline-none text-sm font-medium resize-none h-24"
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" className="flex-1 px-4 py-2.5 border-2 border-[#d9c2b2] text-[#544437] font-bold rounded-xl hover:bg-[#faf2e9] transition-colors" onClick={() => setRejectingId(null)}>
                  Batal
                </button>
                <button type="submit" className="flex-1 px-4 py-2.5 bg-red-650 text-white font-bold rounded-xl hover:bg-red-700 shadow-sm transition-colors">
                  Tolak Laporan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </AppLayout>
  )
}
