// @ts-nocheck
'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { usePurchaseRequests, useRejectPr, type PurchaseRequest } from '@/hooks/usePurchaseRequest'
import { PageHeader, StatCard } from '@/components/ui'
import { ClipboardList, AlertTriangle, Clock, ArrowRight, CheckCircle2, XCircle, Plus } from 'lucide-react'
import CountUp from 'react-countup'
import { Spinner } from '@suka/design-system'
import Link from 'next/link'

const URG_STYLE: Record<string, { label: string; bg: string; text: string; border: string }> = {
  mendesak: { label: 'Mendesak', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  normal: { label: 'Normal', bg: 'bg-suka-cream/80', text: 'text-suka-brown', border: 'border-suka-brown/15' },
  rendah: { label: 'Rendah', bg: 'bg-stone-50', text: 'text-stone-600', border: 'border-stone-200' },
}

const STATUS_STYLE: Record<string, { label: string; bg: string; text: string; border: string }> = {
  pending: { label: 'Menunggu PO', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  jadi_po: { label: 'Sudah Jadi PO', bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
  ditolak: { label: 'Ditolak', bg: 'bg-stone-100', text: 'text-stone-500', border: 'border-stone-200' },
}

export default function PermintaanPage() {
  const { rows, loading } = usePurchaseRequests()
  const reject = useRejectPr()
  const router = useRouter()

  const mendesakCount = useMemo(() => rows.filter(r => r.urgensi === 'mendesak').length, [rows])
  const pendingCount = useMemo(() => rows.filter(r => r.status === 'pending').length, [rows])

  if (loading) {
    return (
      <div className="p-16 flex flex-col items-center justify-center text-suka-brown/60 font-medium">
        <Spinner className="w-8 h-8 text-suka-orange" />
        <span className="mt-3 text-xs font-semibold text-suka-brown">Memuat permintaan pembelian…</span>
      </div>
    )
  }

  const konversi = (r: PurchaseRequest) => {
    sessionStorage.setItem('po_draft_items', JSON.stringify([
      { bahan_baku_id: r.bahan_baku_id, nama: r.nama_bebas ?? '', satuan: r.satuan, qty: r.qty, pr_id: r.id },
    ]))
    router.push('/pembelian/new?from=pr')
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12 font-sans">
      {/* Header */}
      <PageHeader
        title="Permintaan Pembelian (PR)"
        description="Daftar pengajuan kebutuhan bahan baku dari cabang yang dapat langsung dikonversi menjadi Purchase Order."
      >
        <Link
          href="/pembelian/new"
          className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-suka-brown to-suka-ink text-white font-bold px-4 py-2.5 rounded-2xl hover:opacity-95 active:scale-[0.98] transition-all text-xs shadow-md shadow-suka-brown/20"
        >
          <Plus className="w-4 h-4 text-suka-orange" />
          <span>Buat PO Baru</span>
        </Link>
      </PageHeader>

      {/* Top Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Permintaan"
          value={<CountUp end={rows.length} duration={1} />}
          hint="Dokumen Pengajuan Masuk"
          icon={<ClipboardList className="w-5 h-5" />}
          tone="default"
        />
        <StatCard
          label="Urgensi Mendesak"
          value={<CountUp end={mendesakCount} duration={1} />}
          hint="Butuh Tindakan Cepat"
          icon={<AlertTriangle className="w-5 h-5" />}
          tone={mendesakCount > 0 ? 'orange' : 'default'}
        />
        <StatCard
          label="Menunggu Dikonversi"
          value={<CountUp end={pendingCount} duration={1} />}
          hint="Belum Diproses Menjadi PO"
          icon={<Clock className="w-5 h-5" />}
          tone={pendingCount > 0 ? 'green' : 'default'}
        />
      </div>

      {/* Modern Data Table */}
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl border border-suka-brown/10 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-suka-cream/70 text-suka-brown/80 text-[11px] uppercase font-bold tracking-wider border-b border-suka-brown/10 select-none">
                <th className="py-4 px-5">Nama Barang / Bahan</th>
                <th className="py-4 px-5 text-right">Kuantitas</th>
                <th className="py-4 px-5">Alasan / Catatan Pengajuan</th>
                <th className="py-4 px-5 text-center">Urgensi</th>
                <th className="py-4 px-5 text-center">Status</th>
                <th className="py-4 px-5 text-center">Aksi Konversi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-suka-brown/5 text-suka-ink font-medium">
              {rows.map((r) => {
                const urgMeta = URG_STYLE[r.urgensi] ?? URG_STYLE.normal
                const stMeta = STATUS_STYLE[r.status] ?? STATUS_STYLE.pending

                return (
                  <tr key={r.id} className="hover:bg-amber-50/40 transition-colors">
                    <td className="py-4 px-5 font-bold text-suka-brown">
                      {r.nama_bebas ?? r.bahan_baku_id}
                    </td>
                    <td className="py-4 px-5 text-right font-bold text-suka-ink tabular-nums">
                      {r.qty} <span className="text-[11px] font-semibold text-suka-brown/60">{r.satuan ?? ''}</span>
                    </td>
                    <td className="py-4 px-5 text-suka-ink/70 font-medium max-w-xs truncate">
                      {r.alasan ?? '—'}
                    </td>
                    <td className="py-4 px-5 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[10px] font-bold border ${urgMeta.bg} ${urgMeta.text} ${urgMeta.border}`}>
                        {r.urgensi === 'mendesak' && <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />}
                        {urgMeta.label}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-bold border ${stMeta.bg} ${stMeta.text} ${stMeta.border}`}>
                        {stMeta.label}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-center whitespace-nowrap">
                      {r.status === 'pending' ? (
                        <div className="flex items-center gap-2 justify-center">
                          <button 
                            onClick={() => konversi(r)} 
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-suka-orange text-white text-xs font-bold hover:bg-orange-600 active:scale-95 transition-all shadow-2xs cursor-pointer"
                          >
                            <span>Jadikan PO</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => reject.mutate(r.id)} 
                            className="px-2.5 py-1.5 rounded-xl border border-suka-brown/15 text-suka-ink/60 hover:text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-all cursor-pointer"
                          >
                            Tolak
                          </button>
                        </div>
                      ) : (
                        <span className="text-suka-ink/30 font-medium text-xs">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-suka-brown/40 space-y-2">
                    <ClipboardList className="w-10 h-10 mx-auto text-suka-brown/30" />
                    <p className="font-bold text-suka-brown text-sm">Belum ada permintaan pembelian</p>
                    <p className="text-xs text-suka-brown/50">Pengajuan dari outlet akan muncul di sini secara otomatis.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}


