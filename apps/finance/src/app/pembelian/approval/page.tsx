'use client'

import { usePendingPos, useApprovePo, useRejectPo } from '@/hooks/usePoApproval'
import { rupiah, tanggalWaktu } from '@/lib/format'
import { PageHeader, StatCard } from '@/components/ui'
import { ClipboardCheck, CheckCircle2, XCircle, FileText, ArrowRight, Loader2 } from 'lucide-react'
import CountUp from 'react-countup'
import Link from 'next/link'

export default function PoApprovalPage() {
  const { data: pos = [], isLoading } = usePendingPos()
  const approve = useApprovePo()
  const reject = useRejectPo()

  const totalNilaiApproval = pos.reduce((acc, p) => acc + (p.total || 0), 0)

  return (
    <div className="space-y-6 animate-fade-in pb-12 font-sans">
      {/* Header */}
      <PageHeader
        title="Persetujuan PO (Approval)"
        description="Otorisasi komitmen pembelian bahan baku dan operasional sebelum Purchase Order dikirim ke supplier."
      />

      {/* Top Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          label="PO Menunggu Approval"
          value={<CountUp end={pos.length} duration={1} />}
          hint="Dokumen Perlu Tindakan"
          icon={<ClipboardCheck className="w-5 h-5" />}
          tone={pos.length > 0 ? 'orange' : 'default'}
        />
        <StatCard
          label="Total Nilai Komitmen Diajukan"
          value={<><span className="text-sm align-top">Rp </span><CountUp end={totalNilaiApproval} duration={1} separator="." /></>}
          hint="Plafon Anggaran Diminta"
          icon={<FileText className="w-5 h-5" />}
          tone="default"
        />
      </div>

      {/* Main List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white/60 rounded-3xl border border-suka-brown/5">
          <Loader2 className="w-8 h-8 text-suka-orange animate-spin mb-3" />
          <p className="text-suka-brown/60 font-semibold text-xs">Memeriksa antrean approval PO…</p>
        </div>
      ) : pos.length === 0 ? (
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl border border-suka-brown/10 p-12 text-center shadow-sm">
          <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500/80 mb-3" />
          <h3 className="font-bold text-suka-brown text-base">Semua PO Sudah Disetujui</h3>
          <p className="text-xs text-suka-brown/60 mt-1 max-w-md mx-auto">
            Tidak ada dokumen Purchase Order yang sedang menunggu persetujuan finance saat ini.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pos.map((p) => (
            <div
              key={p.id}
              className="bg-white/95 backdrop-blur-xl rounded-3xl border border-suka-brown/10 shadow-sm hover:shadow-md hover:border-suka-orange/30 transition-all p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link 
                    href={`/pembelian/${p.id}`}
                    className="font-mono text-sm font-bold text-suka-brown hover:text-suka-orange transition-colors"
                  >
                    {p.nomor_po}
                  </Link>
                  <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 uppercase tracking-wider">
                    Menunggu Approval
                  </span>
                </div>
                <div className="text-xs font-bold text-suka-brown mt-1 truncate">
                  {p.supplier_nama}
                </div>
                <div className="text-[11px] text-suka-brown/60 font-medium mt-1">
                  Diajukan: {tanggalWaktu(p.tanggal_po)}
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-suka-brown/5">
                <div className="text-left sm:text-right">
                  <span className="block text-[10px] text-suka-brown/50 font-bold uppercase tracking-wider">Total Nilai</span>
                  <span className="font-bold text-suka-brown text-base tabular-nums">{rupiah(p.total)}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => approve.mutate(p.id)}
                    disabled={approve.isPending || reject.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs transition-all shadow-2xs disabled:opacity-40 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Setujui</span>
                  </button>
                  <button
                    onClick={() => reject.mutate({ poId: p.id })}
                    disabled={approve.isPending || reject.isPending}
                    className="px-3.5 py-2 rounded-xl border border-suka-brown/15 hover:border-rose-300 hover:bg-rose-50 text-suka-ink/60 hover:text-rose-600 font-semibold text-xs transition-all disabled:opacity-40 cursor-pointer"
                  >
                    Tolak
                  </button>
                  <Link
                    href={`/pembelian/${p.id}`}
                    className="p-2 rounded-xl text-suka-brown/40 hover:text-suka-brown hover:bg-suka-cream transition-colors"
                    title="Lihat Detail PO"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
