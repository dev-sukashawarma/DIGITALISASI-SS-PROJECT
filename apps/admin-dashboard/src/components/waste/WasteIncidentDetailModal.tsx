'use client'

import React, { useEffect } from 'react'
import { X, ImageOff, CheckCircle2, AlertTriangle, ShieldAlert, Clock, User, CheckCheck } from 'lucide-react'
import { rupiah } from '@/lib/format'
import type { WasteIncidentRow } from '@/hooks/useWasteIncidents'
import { CLAIMABLE_REASON } from '@/lib/wasteReasons'

interface WasteIncidentDetailModalProps {
  isOpen: boolean
  onClose: () => void
  row: WasteIncidentRow | null
}

const fmtWaktu = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(iso))

/** Jeda lapor -> approve dalam bahasa manusia. */
function formatJeda(fromIso: string, toIso: string): string {
  const ms = Date.parse(toIso) - Date.parse(fromIso)
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const menit = Math.floor(ms / 60000)
  if (menit < 60) return `${menit} menit`
  const jam = Math.floor(menit / 60)
  if (jam < 24) return `${jam} jam ${menit % 60} menit`
  const hari = Math.floor(jam / 24)
  return `${hari} hari ${jam % 24} jam`
}

export function WasteIncidentDetailModal({ isOpen, onClose, row }: WasteIncidentDetailModalProps) {
  // Hook WAJIB di atas early-return (React #310).
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !row) return null

  const adaLedger = row.ledger_row_count > 0
  const isClaimable = row.reason === CLAIMABLE_REASON

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Detail waste ${row.bahan_nama}`}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-suka-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-suka-gray-100 flex items-start justify-between gap-4 sticky top-0 bg-white/95 backdrop-blur-md z-10">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold text-suka-brown text-lg tracking-tight">{row.bahan_nama}</h3>
              <span
                className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  isClaimable
                    ? 'bg-blue-50 text-blue-700 border border-blue-200/80'
                    : 'bg-suka-cream text-suka-brown border border-suka-brown/10'
                }`}
              >
                {row.reason}
              </span>
            </div>
            <p className="text-xs text-suka-gray-500 font-semibold mt-1">
              Outlet: <strong>{row.outlet_name.replace('SUKA SHAWARMA ', '')}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="p-2 rounded-2xl hover:bg-suka-cream text-suka-gray-400 hover:text-suka-ink transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Banner Klaim Supplier jika relevan */}
          {isClaimable && (
            <div className="p-4 rounded-2xl bg-blue-50/90 border border-blue-200/80 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-blue-950 uppercase tracking-wider">
                  Potensi Klaim Penggantian Supplier
                </p>
                <p className="text-[11px] text-blue-900 mt-1 leading-relaxed">
                  Laporan ini diklasifikasikan sebagai mutu buruk supplier senilai <strong>{rupiah(row.nilai)}</strong>.
                  Gunakan foto bukti di bawah untuk mengajukan retur atau potongan tagihan pembelian (credit note) ke vendor bahan baku.
                </p>
              </div>
            </div>
          )}

          {/* Foto bukti */}
          <div>
            <p className="text-[11px] font-bold text-suka-gray-500 uppercase tracking-wider mb-2">Foto Bukti Fisik</p>
            {row.photo_url ? (
              <div className="relative rounded-2xl overflow-hidden border border-suka-gray-200 bg-suka-cream/30 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={row.photo_url}
                  alt={`Bukti waste ${row.bahan_nama}`}
                  className="w-full max-h-80 object-contain rounded-xl mx-auto"
                />
              </div>
            ) : (
              <div className="w-full py-10 rounded-2xl border border-dashed border-suka-gray-200 bg-suka-cream/20 flex flex-col items-center gap-2">
                <ImageOff className="w-6 h-6 text-suka-gray-300" />
                <p className="text-xs font-semibold text-suka-gray-400">Tidak ada lampiran foto bukti</p>
              </div>
            )}
          </div>

          {/* Angka & Biaya */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: 'Qty Satuan Besar',
                value: `${row.qty.toLocaleString('id-ID', { maximumFractionDigits: 4 })} ${row.satuan_besar}`,
              },
              {
                label: 'Qty Satuan Kecil',
                value: `${row.qty_kecil.toLocaleString('id-ID', { maximumFractionDigits: 2 })} ${row.satuan_kecil}`,
              },
              {
                label: 'HPP / Satuan Kecil',
                value: rupiah(row.hpp_kecil),
              },
              {
                label: 'Nilai Kerugian',
                value: rupiah(row.nilai),
                strong: true,
              },
            ].map((f) => (
              <div key={f.label} className="p-3.5 rounded-2xl bg-suka-cream/50 border border-suka-brown/5">
                <p className="text-[10px] font-bold text-suka-gray-500 uppercase tracking-wider">{f.label}</p>
                <p className={`mt-1.5 text-sm font-extrabold tabular-nums ${f.strong ? 'text-rose-700 text-base' : 'text-suka-ink'}`}>
                  {f.value}
                </p>
              </div>
            ))}
          </div>

          {/* Jejak Waktu & Approval */}
          <div className="p-4 rounded-2xl bg-white border border-suka-gray-200/80 space-y-3">
            <p className="text-[11px] font-bold text-suka-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-suka-gray-400" />
              <span>Audit Jejak Waktu &amp; Penanggung Jawab</span>
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center gap-3">
                <span className="text-suka-gray-600 flex items-center gap-1.5">
                  <User className="w-3 h-3 text-suka-gray-400" />
                  <span>Dilaporkan oleh <strong className="text-suka-ink">{row.reporter_name ?? '—'}</strong></span>
                </span>
                <span className="text-suka-gray-500 font-medium tabular-nums">{fmtWaktu(row.created_at)}</span>
              </div>
              <div className="flex justify-between items-center gap-3">
                <span className="text-suka-gray-600 flex items-center gap-1.5">
                  <CheckCheck className="w-3 h-3 text-emerald-600" />
                  <span>Disetujui oleh <strong className="text-suka-ink">{row.approver_name ?? '—'}</strong></span>
                </span>
                <span className="text-suka-gray-500 font-medium tabular-nums">{fmtWaktu(row.updated_at)}</span>
              </div>
              <div className="flex justify-between items-center gap-3 pt-2 border-t border-suka-gray-100 font-medium">
                <span className="text-suka-gray-600">Durasi Respons (Lapor → Approve)</span>
                <span className="font-bold text-suka-brown">{formatJeda(row.created_at, row.updated_at)}</span>
              </div>
            </div>
          </div>

          {/* Status potongan stok ledger */}
          <div
            className={`p-4 rounded-2xl border flex items-start gap-3 ${
              adaLedger ? 'bg-emerald-50/70 border-emerald-200' : 'bg-rose-50/80 border-rose-200'
            }`}
          >
            {adaLedger ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className={`text-xs font-bold ${adaLedger ? 'text-emerald-800' : 'text-rose-800'}`}>
                {adaLedger
                  ? `Potongan stok tercatat pada database (${row.ledger_row_count} baris kartu stok)`
                  : 'Peringatan: Tidak ada baris ledger stok — saldo stok fisik belum terpotong'}
              </p>
              <p className="text-[11px] text-suka-gray-500 mt-1 leading-relaxed">
                Pemeriksaan memastikan stok bahan baku di POS/Backoffice otomatis dipotong sesuai kuantitas waste yang disetujui.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
