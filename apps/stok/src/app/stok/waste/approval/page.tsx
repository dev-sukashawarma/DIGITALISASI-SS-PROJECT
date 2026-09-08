'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { approveWasteReport, rejectWasteReport } from '@/app/actions/waste'
import { toast } from 'sonner'
import { useStokBalance } from '@/hooks/useStokBalance'
import { useWasteApprovalList } from '@/hooks/useWaste'
import { useAuth } from '@suka/auth'
import { formatTriUnitSaldo, convertGramToBesar } from '@/lib/format/compositeUnit'
import { WastePhotoModal } from '@/components/waste/WastePhotoModal'
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, Camera, Sparkles } from 'lucide-react'

function formatRp(n: number): string {
  return `Rp ${Math.round(n).toLocaleString('id-ID')}`
}

export default function WasteApprovalPage() {
  const router = useRouter()
  const { outletStaff } = useAuth()
  const outletId = outletStaff?.outlet_id
  const role = outletStaff?.role

  const canApproveWaste = [
    'area_manager',
    'regional_manager',
    'admin',
    'kitchen',
    'developer',
  ].includes(role ?? '')

  // If regular staff, redirect to history
  React.useEffect(() => {
    if (outletStaff && !canApproveWaste) {
      router.replace('/stok/waste/history')
    }
  }, [outletStaff, canApproveWaste, router])

  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [activePhoto, setActivePhoto] = useState<{ url: string; title: string; subtitle: string } | null>(null)

  const { balances } = useStokBalance(outletId || '')
  const { reports, loading, refresh: loadReports } = useWasteApprovalList()

  const handleApprove = async (id: string, qty: number, bahanBakuId: string) => {
    const bal = balances.find(b => b.bahan_baku_id === bahanBakuId)
    const currentSaldoBesar = bal?.saldo_is_gram
      ? convertGramToBesar(bal.saldo, reports.find(r => r.bahan_baku_id === bahanBakuId)?.bahan_baku ?? {})
      : (bal?.saldo || 0)

    if (qty > currentSaldoBesar) {
      const confirmMsg = `PERINGATAN: Kuantitas waste (${qty}) lebih besar dari saldo saat ini (${currentSaldoBesar}). Saldo akan menjadi negatif setelah disetujui. Tetap setujui laporan ini?`
      if (!window.confirm(confirmMsg)) return
    }

    try {
      await approveWasteReport(id)
      toast.success('Laporan waste berhasil disetujui dan stok telah dipotong')
      loadReports()
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyetujui laporan')
    }
  }

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rejectingId || !rejectReason.trim()) return
    try {
      await rejectWasteReport(rejectingId, rejectReason.trim())
      toast.success('Laporan waste ditolak')
      setRejectingId(null)
      setRejectReason('')
      loadReports()
    } catch (err: any) {
      toast.error(err.message || 'Gagal menolak laporan')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px]">
        <span className="text-4xl animate-bounce">♻️</span>
        <p className="text-sm font-bold text-suka-brown/60 tracking-wider uppercase mt-3 animate-pulse">
          Memuat Antrean Laporan...
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#d9c2b2]/30">
        <div>
          <h2 className="text-lg font-black text-[#701604]">
            Menunggu Persetujuan
          </h2>
          <p className="text-xs text-suka-brown/70 font-semibold mt-0.5">
            Tinjau bukti foto dan alasan kerusakan sebelum memotong saldo stok
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadReports()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#d9c2b2] text-[#544437] rounded-xl text-xs sm:text-sm font-bold shadow-2xs hover:bg-[#faf2e9] active:scale-95 transition-all cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Muat Ulang</span>
        </button>
      </div>

      {/* Reports List */}
      {reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center bg-white border border-[#d9c2b2]/40 rounded-3xl p-12 text-center shadow-xs min-h-[320px]">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-3">
            <Sparkles className="w-8 h-8" />
          </div>
          <h3 className="text-base font-extrabold text-[#544437]">Semua Laporan Selesai Ditinjau</h3>
          <p className="text-xs text-[#544437]/70 font-medium max-w-sm mt-1">
            Tidak ada laporan waste yang sedang menunggu persetujuan saat ini.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {reports.map((r: any) => {
            const bal = balances.find(b => b.bahan_baku_id === r.bahan_baku_id)
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
              <div
                key={r.id}
                className="bg-white border border-[#d9c2b2]/60 rounded-2xl p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col relative"
              >
                {/* Header Card */}
                <div className="flex justify-between items-start mb-3 gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-block text-[10px] font-black bg-[#ffdcc2] text-[#6d3900] px-2 py-0.5 rounded uppercase tracking-wider">
                        Pending
                      </span>
                      <span className="text-[10px] font-semibold text-[#544437]/60">
                        🕒 {formattedDate}
                      </span>
                    </div>
                    <h3 className="font-black text-[#701604] text-base leading-tight mt-1 truncate">
                      {r.bahan_baku?.nama}
                    </h3>
                    <p className="text-[11px] font-bold text-[#544437]/70 uppercase tracking-wide truncate">
                      🏪 {r.outlets?.name?.replace('SUKA SHAWARMA ', '') || 'Unknown'}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="font-black text-base sm:text-lg text-[#ba1a1a] whitespace-pre-line">
                      {formatTriUnitSaldo(
                        r.qty,
                        r.bahan_baku?.satuan || '',
                        r.bahan_baku?.satuan_tengah,
                        r.bahan_baku?.faktor_tengah,
                        r.bahan_baku?.satuan_kecil,
                        r.bahan_baku?.faktor_tampilan,
                        true
                      )}
                    </p>
                    <p className="text-xs font-black text-[#701604] mt-0.5">
                      Est. {formatRp(r.nilai_waste || 0)}
                    </p>
                  </div>
                </div>

                {/* Reporter Info */}
                <div className="flex items-center justify-between gap-2 mb-3 p-2.5 bg-[#faf2e9] rounded-xl border border-[#d9c2b2]/30 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-[#d9c2b2] flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                      {r.reported_by_staff?.name?.charAt(0) || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-semibold text-[#544437]/60 uppercase leading-none">
                        Dilaporkan Oleh
                      </p>
                      <p className="text-xs font-bold text-[#1e1b15] truncate mt-0.5">
                        {r.reported_by_staff?.name || 'Staf'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Reason */}
                <div className="bg-[#faf2e9]/30 border border-dashed border-[#d9c2b2] p-3 rounded-xl text-xs mb-3">
                  <span className="font-bold text-[#544437] text-[10px] uppercase tracking-wider block mb-0.5">
                    Alasan Kerusakan / Limbah:
                  </span>
                  <p className="text-[#1e1b15] font-medium italic">
                    "{r.reason}"
                  </p>
                </div>

                {/* Negative Warning */}
                {isNegativeWarning && (
                  <div className="bg-red-50 text-red-700 text-[11px] font-bold p-3 rounded-xl border border-red-200 mb-3 flex gap-2 items-start">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                    <p>
                      Saldo saat ini: <span className="font-black">{bal?.saldo || 0}</span>. Menyetujui ini akan membuat saldo menjadi negatif!
                    </p>
                  </div>
                )}

                {/* Photo Proof Action */}
                {r.photo_url ? (
                  <div className="mb-4">
                    <button
                      type="button"
                      onClick={() =>
                        setActivePhoto({
                          url: r.photo_url,
                          title: r.bahan_baku?.nama || 'Foto Bukti',
                          subtitle: `${r.outlets?.name || ''} · ${r.reported_by_staff?.name || ''}`,
                        })
                      }
                      className="flex items-center justify-center gap-2 w-full py-2 bg-[#f0f9ff] text-[#0284c7] border border-[#bae6fd] hover:bg-[#e0f2fe] rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Lihat Foto Bukti</span>
                    </button>
                  </div>
                ) : (
                  <div className="mb-4 text-center py-1 text-[11px] text-[#544437]/50 font-semibold italic">
                    Tanpa foto bukti
                  </div>
                )}

                <div className="flex-grow" />

                {/* Action Buttons */}
                <div className="flex gap-2 pt-3 border-t border-[#d9c2b2]/30 mt-1">
                  <button
                    type="button"
                    className="flex-1 bg-suka-green hover:bg-green-700 text-white font-bold text-xs sm:text-sm py-2.5 rounded-xl transition-all shadow-2xs active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                    onClick={() => handleApprove(r.id, r.qty, r.bahan_baku_id)}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Setujui</span>
                  </button>
                  <button
                    type="button"
                    className="flex-1 bg-white border border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs sm:text-sm py-2.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                    onClick={() => setRejectingId(r.id)}
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Tolak</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Reject Modal */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-[#d9c2b2]/50 transform transition-all">
            <h2 className="text-lg font-black text-[#701604] mb-1.5 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span>Tolak Laporan Waste</span>
            </h2>
            <p className="text-xs font-semibold text-[#544437]/70 mb-4">
              Berikan alasan penolakan agar staf pelapor mengerti hal yang perlu diperbaiki.
            </p>
            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-[#544437] uppercase tracking-wider mb-1.5 block">
                  Alasan Penolakan
                </label>
                <textarea
                  autoFocus
                  placeholder="Misal: Foto buram, salah hitung timbangan..."
                  className="w-full p-3 bg-[#faf2e9] border border-[#d9c2b2]/50 rounded-xl focus:ring-2 focus:ring-suka-orange focus:border-suka-orange outline-none text-xs sm:text-sm font-medium resize-none h-24"
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  required
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  className="flex-1 px-4 py-2.5 border border-[#d9c2b2] text-[#544437] font-bold text-xs rounded-xl hover:bg-[#faf2e9] transition-colors cursor-pointer"
                  onClick={() => {
                    setRejectingId(null)
                    setRejectReason('')
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Tolak Laporan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Photo Modal */}
      {activePhoto && (
        <WastePhotoModal
          photoUrl={activePhoto.url}
          title={activePhoto.title}
          subtitle={activePhoto.subtitle}
          onClose={() => setActivePhoto(null)}
        />
      )}
    </div>
  )
}
