'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { usePurchaseRequests, useRejectPr, type PurchaseRequest } from '@/hooks/usePurchaseRequest'
import { PageHeader, StatTile } from '@/components/ui'
import { ClipboardList, AlertTriangle, Clock, ArrowRight, CheckCircle2, XCircle } from 'lucide-react'
import CountUp from 'react-countup'
import { Spinner } from '@suka/design-system'

const URG_STYLE: Record<string, { label: string; bg: string; text: string; border: string }> = {
  mendesak: { label: 'Mendesak', bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200/80' },
  normal: { label: 'Normal', bg: 'bg-suka-cream/60', text: 'text-suka-brown', border: 'border-suka-brown/20' },
  rendah: { label: 'Rendah', bg: 'bg-suka-gray-100', text: 'text-suka-gray-500', border: 'border-suka-gray-200' },
}

const STATUS_STYLE: Record<string, { label: string; bg: string; text: string; border: string }> = {
  pending: { label: 'Menunggu PO', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200/80' },
  jadi_po: { label: 'Sudah Jadi PO', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200/80' },
  ditolak: { label: 'Ditolak', bg: 'bg-suka-gray-100', text: 'text-suka-gray-400', border: 'border-suka-gray-200' },
}

export default function PermintaanPage() {
  const { rows, loading } = usePurchaseRequests()
  const reject = useRejectPr()
  const router = useRouter()

  const mendesakCount = useMemo(() => rows.filter(r => r.urgensi === 'mendesak').length, [rows])
  const pendingCount = useMemo(() => rows.filter(r => r.status === 'pending').length, [rows])

  if (loading) {
    return (
      <div className="p-16 flex flex-col items-center justify-center text-suka-gray-400 font-medium">
        <Spinner className="w-8 h-8 text-suka-orange" />
        <span className="mt-3 text-xs font-bold text-suka-brown">Memuat permintaan pembelian…</span>
      </div>
    )
  }

  const konversi = (r: PurchaseRequest) => {
    sessionStorage.setItem('po_draft_items', JSON.stringify([
      { bahan_baku_id: r.bahan_baku_id, nama: r.nama_bebas ?? '', satuan: r.satuan, qty: r.qty, pr_id: r.id },
    ]))
    router.push('/dashboard/pembelian/new?from=pr')
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12 max-w-6xl mx-auto">
      {/* Header */}
      <PageHeader
        title="Permintaan Pembelian (PR)"
        description="Daftar pengajuan kebutuhan bahan baku dari cabang yang dapat langsung dikonversi menjadi Purchase Order."
      />

      {/* Top Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile
          label="Total Permintaan"
          value={<CountUp end={rows.length} duration={1} />}
          sub="Dokumen Pengajuan"
          icon={ClipboardList}
          accent="brown"
        />
        <StatTile
          label="Urgensi Mendesak"
          value={<CountUp end={mendesakCount} duration={1} />}
          sub="Butuh Tindakan Cepat"
          icon={AlertTriangle}
          accent="red"
        />
        <StatTile
          label="Menunggu Dikonversi"
          value={<CountUp end={pendingCount} duration={1} />}
          sub="Belum Menjadi PO"
          icon={Clock}
          accent="orange"
        />
      </div>

      {/* Glassmorphism Table */}
      <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-suka-gray-200/60 shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[750px]">
            <thead>
              <tr className="bg-suka-cream/40 text-suka-gray-500 text-[9px] uppercase font-black tracking-widest border-b border-suka-gray-100">
                <th className="py-4 px-6">Nama Barang / Bahan</th>
                <th className="py-4 px-6 text-right">Kuantitas</th>
                <th className="py-4 px-6">Alasan / Catatan</th>
                <th className="py-4 px-6 text-center">Urgensi</th>
                <th className="py-4 px-6 text-center">Status</th>
                <th className="py-4 px-6 text-center">Aksi Konversi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-suka-gray-100 text-xs">
              {rows.map((r) => {
                const urgMeta = URG_STYLE[r.urgensi] ?? URG_STYLE.normal
                const stMeta = STATUS_STYLE[r.status] ?? STATUS_STYLE.pending

                return (
                  <tr key={r.id} className="hover:bg-white/80 transition-all">
                    <td className="py-4 px-6 font-extrabold text-suka-brown text-sm">
                      {r.nama_bebas ?? r.bahan_baku_id}
                    </td>
                    <td className="py-4 px-6 text-right font-black text-suka-ink text-sm">
                      {r.qty} <span className="text-xs font-semibold text-suka-gray-400">{r.satuan ?? ''}</span>
                    </td>
                    <td className="py-4 px-6 text-suka-gray-600 font-medium max-w-xs truncate">
                      {r.alasan ?? '—'}
                    </td>
                    <td className="py-4 px-6 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${urgMeta.bg} ${urgMeta.text} ${urgMeta.border} shadow-2xs`}>
                        {r.urgensi === 'mendesak' && <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />}
                        {urgMeta.label}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${stMeta.bg} ${stMeta.text} ${stMeta.border}`}>
                        {stMeta.label}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center whitespace-nowrap">
                      {r.status === 'pending' ? (
                        <div className="flex items-center gap-2 justify-center">
                          <button 
                            onClick={() => konversi(r)} 
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-suka-orange text-white text-xs font-extrabold shadow-2xs hover:bg-orange-600 active:scale-95 transition-all"
                          >
                            Jadikan PO <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => reject.mutate(r.id)} 
                            className="px-3 py-1.5 rounded-xl border border-suka-gray-200 text-suka-gray-500 hover:text-red-600 hover:bg-red-50 text-xs font-bold transition-all"
                          >
                            Tolak
                          </button>
                        </div>
                      ) : (
                        <span className="text-suka-gray-300 font-medium text-xs">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-suka-gray-400 space-y-2">
                    <ClipboardList className="w-10 h-10 mx-auto text-suka-gray-300" />
                    <p className="font-extrabold text-suka-brown text-sm">Belum ada permintaan pembelian</p>
                    <p className="text-xs text-suka-gray-400">Pengajuan dari outlet akan muncul di sini.</p>
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
