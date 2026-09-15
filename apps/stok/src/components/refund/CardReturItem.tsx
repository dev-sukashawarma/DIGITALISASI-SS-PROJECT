'use client'

import { useState } from 'react'
import {
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  PackageCheck,
  Scale,
  ShieldCheck,
  FileCheck,
  Maximize2,
  X,
  Printer,
} from 'lucide-react'
import { ReturStok } from '@/types/retur'
import { ModalApproveManager } from './ModalApproveManager'
import { ModalSerahTerimaKurir } from './ModalSerahTerimaKurir'
import { ModalVerifikasiKitchen } from './ModalVerifikasiKitchen'
import { ModalSuratJalanPengganti } from './ModalSuratJalanPengganti'

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string; icon: any }
> = {
  diajukan: {
    label: 'Menunggu Review AM/RM',
    color: 'text-amber-800',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: Clock,
  },
  disetujui_manager: {
    label: 'Disetujui AM/RM (Siap Kurir)',
    color: 'text-blue-800',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: ShieldCheck,
  },
  dalam_pengiriman: {
    label: 'Dalam Pengiriman Kurir',
    color: 'text-indigo-800',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    icon: Truck,
  },
  diterima_kitchen: {
    label: 'Tiba di Kitchen (Menunggu Kirim)',
    color: 'text-amber-900',
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    icon: Clock,
  },
  dikirim_pengganti: {
    label: 'SJ Pengganti OTW',
    color: 'text-sky-800',
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    icon: PackageCheck,
  },
  selesai: {
    label: 'Selesai (100% Diganti)',
    color: 'text-emerald-800',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    icon: CheckCircle2,
  },
  ditolak: {
    label: 'Ditolak (Dialihkan ke Waste)',
    color: 'text-red-800',
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: XCircle,
  },
}

export function CardReturItem({
  retur,
  userRole,
  userOutletId,
}: {
  retur: ReturStok
  userRole?: string
  userOutletId?: string | null
}) {
  const [modalManagerOpen, setModalManagerOpen] = useState(false)
  const [modalKurirOpen, setModalKurirOpen] = useState(false)
  const [modalKitchenOpen, setModalKitchenOpen] = useState(false)
  const [modalSuratJalanOpen, setModalSuratJalanOpen] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; title: string } | null>(null)

  const cfg = STATUS_CONFIG[retur.status] || {
    label: retur.status,
    color: 'text-gray-800',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    icon: Clock,
  }
  const StatusIcon = cfg.icon

  const isManager = ['area_manager', 'regional_manager', 'spv', 'admin', 'owner', 'developer'].includes(
    userRole ?? ''
  )
  const isKitchen = ['kitchen', 'admin', 'owner', 'purchasing', 'developer'].includes(userRole ?? '')
  const isMyOutlet = retur.outlet_id === userOutletId || isManager || isKitchen

  // Tahapan Stepper
  const steps = [
    { key: 'diajukan', title: 'Diajukan' },
    { key: 'disetujui_manager', title: 'Approve AM' },
    { key: 'dalam_pengiriman', title: 'Kurir OTW' },
    { key: 'diterima_kitchen', title: 'Tiba Kitchen' },
    { key: 'dikirim_pengganti', title: 'SJ Pengganti' },
    { key: 'selesai', title: 'Selesai' },
  ]

  const getStepIndex = (st: string) => {
    switch (st) {
      case 'diajukan':
        return 0
      case 'disetujui_manager':
        return 1
      case 'dalam_pengiriman':
        return 2
      case 'diterima_kitchen':
        return 3
      case 'dikirim_pengganti':
        return 4
      case 'selesai':
        return 5
      case 'ditolak':
        return -1
      default:
        return 0
    }
  }

  const currentStepIdx = getStepIndex(retur.status)

  return (
    <>
      <div className="bg-white rounded-2xl border border-[#d9c2b2]/40 p-4 sm:p-5 shadow-xs hover:shadow-md transition-shadow space-y-4">
        {/* Header card */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-xs text-[#544437] tracking-wider">
                {retur.nomor_retur}
              </span>
              <span className="text-[10px] text-gray-400">·</span>
              <span className="text-xs font-extrabold text-[#1e1b15]">
                {retur.outlets?.name ?? 'Outlet'}
              </span>
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Diajukan {new Date(retur.created_at).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })} oleh {retur.created_by_staff?.name ?? 'Kru'}
            </p>
          </div>

          <div
            className={`px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${cfg.bg} ${cfg.color} ${cfg.border}`}
          >
            <StatusIcon className="w-3.5 h-3.5" />
            <span>{cfg.label}</span>
          </div>
        </div>

        {/* Stepper Progress */}
        {retur.status !== 'ditolak' && (
          <div className="py-1">
            <div className="flex items-center justify-between relative">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-gray-100 z-0" />
              {steps.map((step, idx) => {
                const isPassed = currentStepIdx >= idx
                const isCurrent = currentStepIdx === idx
                return (
                  <div key={step.key} className="flex flex-col items-center relative z-10">
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black transition-colors ${
                        isPassed
                          ? 'bg-amber-800 text-white shadow-xs'
                          : 'bg-gray-100 text-gray-400'
                      } ${isCurrent ? 'ring-2 ring-amber-400' : ''}`}
                    >
                      {idx + 1}
                    </div>
                    <span
                      className={`text-[8px] font-bold mt-1 tracking-tight text-center ${
                        isPassed ? 'text-amber-950 font-black' : 'text-gray-400'
                      }`}
                    >
                      {step.title}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Items List */}
        <div className="space-y-2 bg-[#fff8f1]/50 p-3 rounded-xl border border-amber-900/5">
          {retur.items?.map((it) => (
            <div
              key={it.id}
              className="p-3 bg-white rounded-xl border border-amber-900/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
            >
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="w-2 h-2 rounded-full bg-amber-700 shrink-0" />
                  <span className="font-extrabold text-sm text-gray-900">{it.bahan_baku?.nama ?? 'Bahan'}</span>
                  <span className="font-mono font-black text-amber-950 text-xs bg-amber-100/70 px-2 py-0.5 rounded-md">
                    {it.qty_klaim.toLocaleString('id-ID')} {it.bahan_baku?.satuan}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-[11px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60">
                    Alasan: {it.alasan}
                  </span>
                  {it.catatan && (
                    <span className="text-[11px] text-gray-500 italic">
                      &ldquo;{it.catatan}&rdquo;
                    </span>
                  )}
                  {it.qty_diterima_kitchen !== null && (
                    <span className="text-[11px] font-bold text-purple-900 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                      Timbang Kitchen: {it.qty_diterima_kitchen.toLocaleString('id-ID')} {it.bahan_baku?.satuan}
                    </span>
                  )}
                </div>
              </div>

              {/* Photo Evidence Preview Thumbnail */}
              {it.foto_fisik_url && (
                <div className="shrink-0 flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedPhoto({
                        url: it.foto_fisik_url,
                        title: `Bukti Timbangan: ${it.bahan_baku?.nama ?? 'Bahan Baku'} (${it.qty_klaim} ${it.bahan_baku?.satuan ?? ''})`,
                      })
                    }
                    className="group relative w-14 h-14 rounded-xl overflow-hidden border border-amber-900/15 bg-black/5 hover:opacity-90 transition-all cursor-pointer shadow-2xs"
                    title="Klik untuk memperbesar bukti timbangan"
                  >
                    <img
                      src={it.foto_fisik_url}
                      alt="Foto bahan di timbangan"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                      <Maximize2 size={14} />
                    </div>
                    <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[8px] text-white font-bold text-center py-0.5">
                      Timbangan
                    </div>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Kurir info badge if present */}
        {retur.driver_nama && (
          <div className="p-2.5 bg-blue-50/50 rounded-xl border border-blue-100 flex items-center justify-between text-xs gap-3">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-700 shrink-0" />
              <div>
                <span className="font-bold text-blue-950 block text-[11px]">
                  {retur.jenis_logistik.toUpperCase()} · {retur.driver_nama}{' '}
                  {retur.driver_plat_kendaraan ? `(${retur.driver_plat_kendaraan})` : ''}
                </span>
                {retur.nomor_resi_order && (
                  <span className="text-[10px] font-mono font-semibold text-blue-800">
                    Resi: {retur.nomor_resi_order}
                  </span>
                )}
              </div>
            </div>

            {retur.foto_serah_terima_url && (
              <button
                type="button"
                onClick={() =>
                  setSelectedPhoto({
                    url: retur.foto_serah_terima_url!,
                    title: `Bukti Serah Terima Kurir - ${retur.driver_nama}`,
                  })
                }
                className="group relative w-11 h-11 rounded-lg overflow-hidden border border-blue-200 bg-black/5 hover:opacity-90 transition-all cursor-pointer shrink-0"
                title="Lihat foto serah terima kurir"
              >
                <img
                  src={retur.foto_serah_terima_url}
                  alt="Bukti serah terima"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                  <Maximize2 size={12} />
                </div>
              </button>
            )}
          </div>
        )}

        {/* Info Surat Jalan Pengganti if issued */}
        {retur.surat_jalan_pengganti && (
          <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200/80 flex items-center justify-between text-xs gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200">
                <FileCheck className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-gray-500 font-bold uppercase block">
                  Surat Jalan Pengganti (Resmi)
                </span>
                <span className="font-mono font-black text-emerald-950 text-xs">
                  {retur.surat_jalan_pengganti.nomor_surat}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setModalSuratJalanOpen(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Lihat & Cetak Dokumen SJ</span>
            </button>
          </div>
        )}

        {/* Info Banner jika Fisik Sudah di Kitchen & Menunggu Pengiriman Reguler */}
        {retur.status === 'diterima_kitchen' && (
          <div className="p-3.5 bg-purple-50/80 rounded-xl border border-purple-200/80 flex items-start gap-2.5 text-xs">
            <Clock className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-purple-950 block">
                Fisik Ditimbang di Kitchen — Menunggu Pengiriman Reguler Outlet
              </span>
              <p className="text-[11px] text-purple-900/90 mt-0.5 leading-relaxed">
                Barang pengganti akan <strong>otomatis disertakan</strong> saat Central Kitchen memproses persetujuan stok reguler untuk outlet ini di menu <em>Permintaan</em>.
                {retur.catatan_kitchen && (
                  <span className="block font-semibold italic mt-1 text-purple-950">
                    Catatan Kitchen: &ldquo;{retur.catatan_kitchen}&rdquo;
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 border-t border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <div className="text-[10px] text-gray-400 italic">
            {retur.catatan_manager && <span>Catatan AM: "{retur.catatan_manager}"</span>}
          </div>

          <div className="flex items-center gap-2">
            {/* Tombol AM / RM */}
            {retur.status === 'diajukan' && isManager && (
              <button
                type="button"
                onClick={() => setModalManagerOpen(true)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-amber-800 hover:bg-amber-900 shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Review & Setujui
              </button>
            )}

            {/* Tombol Serahkan ke Kurir (Kru Outlet) */}
            {retur.status === 'disetujui_manager' && isMyOutlet && (
              <button
                type="button"
                onClick={() => setModalKurirOpen(true)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-blue-800 hover:bg-blue-900 shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Truck className="w-3.5 h-3.5" />
                Serahkan ke Kurir
              </button>
            )}

            {/* Tombol Timbang / Terbitkan SJ Kitchen (Central Kitchen) */}
            {(retur.status === 'dalam_pengiriman' || retur.status === 'diterima_kitchen') && isKitchen && (
              <button
                type="button"
                onClick={() => setModalKitchenOpen(true)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold text-white shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                  retur.status === 'diterima_kitchen'
                    ? 'bg-blue-800 hover:bg-blue-900'
                    : 'bg-purple-800 hover:bg-purple-900'
                }`}
              >
                {retur.status === 'diterima_kitchen' ? (
                  <>
                    <PackageCheck className="w-3.5 h-3.5" />
                    Terbitkan SJ Pengganti
                  </>
                ) : (
                  <>
                    <Scale className="w-3.5 h-3.5" />
                    Timbang & Opsi Kirim
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <ModalApproveManager
        retur={retur}
        isOpen={modalManagerOpen}
        onClose={() => setModalManagerOpen(false)}
      />

      <ModalSerahTerimaKurir
        retur={retur}
        isOpen={modalKurirOpen}
        onClose={() => setModalKurirOpen(false)}
      />

      <ModalVerifikasiKitchen
        retur={retur}
        isOpen={modalKitchenOpen}
        onClose={() => setModalKitchenOpen(false)}
      />

      {/* Lightbox Modal Bukti Foto */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="relative max-w-2xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 bg-amber-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold truncate">
                <Scale size={16} className="text-amber-400 shrink-0" />
                <span className="truncate">{selectedPhoto.title}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 bg-[#1e1b15] flex items-center justify-center min-h-[300px]">
              <img
                src={selectedPhoto.url}
                alt={selectedPhoto.title}
                className="max-h-[70vh] w-auto object-contain rounded-lg"
              />
            </div>
            <div className="p-3 bg-amber-50/50 text-center text-xs text-gray-500 font-medium border-t border-amber-100">
              Perhatikan kondisi fisik bahan dan angka display timbangan digital dari outlet.
            </div>
          </div>
        </div>
      )}

      {/* Modal Surat Jalan Pengganti (Preview & Cetak PDF) */}
      {retur.surat_jalan_pengganti && (
        <ModalSuratJalanPengganti
          suratJalanId={retur.surat_jalan_pengganti.id}
          retur={retur}
          isOpen={modalSuratJalanOpen}
          onClose={() => setModalSuratJalanOpen(false)}
        />
      )}
    </>
  )
}
