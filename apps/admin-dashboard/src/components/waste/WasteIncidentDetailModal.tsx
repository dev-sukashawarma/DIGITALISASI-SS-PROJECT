'use client'

import { useEffect } from 'react'
import { X, ImageOff, CheckCircle2, AlertTriangle } from 'lucide-react'
import { rupiah } from '@/lib/format'
import type { WasteIncidentRow } from '@/hooks/useWasteIncidents'

interface WasteIncidentDetailModalProps {
  isOpen: boolean
  onClose: () => void
  row: WasteIncidentRow | null
}

const fmtWaktu = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
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
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !row) return null

  const adaLedger = row.ledger_row_count > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Detail waste ${row.bahan_nama}`}
        className="bg-white rounded-3xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-suka-gray-100 flex items-start justify-between gap-4 sticky top-0 bg-white z-10">
          <div>
            <h3 className="font-extrabold text-suka-brown tracking-tight">{row.bahan_nama}</h3>
            <p className="text-xs text-suka-gray-500 mt-0.5">
              {row.outlet_name.replace('SUKA SHAWARMA ', '')} · {row.reason}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="p-1.5 rounded-xl hover:bg-suka-cream transition-colors">
            <X className="w-4 h-4 text-suka-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Foto bukti */}
          <div>
            <p className="text-[11px] font-bold text-suka-gray-500 uppercase tracking-wider mb-2">Foto Bukti</p>
            {row.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={row.photo_url}
                alt={`Bukti waste ${row.bahan_nama}`}
                className="w-full max-h-80 object-contain rounded-2xl border border-suka-gray-200 bg-suka-cream/30"
              />
            ) : (
              <div className="w-full py-10 rounded-2xl border border-dashed border-suka-gray-200 bg-suka-cream/20 flex flex-col items-center gap-2">
                <ImageOff className="w-6 h-6 text-suka-gray-300" />
                <p className="text-xs font-semibold text-suka-gray-400">Tidak ada foto bukti</p>
              </div>
            )}
          </div>

          {/* Angka */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Qty (satuan besar)', value: `${row.qty.toLocaleString('id-ID', { maximumFractionDigits: 4 })} ${row.satuan_besar}` },
              { label: 'Qty (satuan kecil)', value: `${row.qty_kecil.toLocaleString('id-ID', { maximumFractionDigits: 2 })} ${row.satuan_kecil}` },
              { label: 'HPP / satuan kecil', value: rupiah(row.hpp_kecil) },
              { label: 'Nilai kerugian', value: rupiah(row.nilai), strong: true },
            ].map((f) => (
              <div key={f.label} className="p-3 rounded-2xl bg-suka-cream/40">
                <p className="text-[10px] font-bold text-suka-gray-500 uppercase tracking-wider">{f.label}</p>
                <p className={`mt-1 text-sm font-extrabold tabular-nums ${f.strong ? 'text-red-700' : 'text-suka-ink'}`}>{f.value}</p>
              </div>
            ))}
          </div>

          {/* Jejak waktu */}
          <div>
            <p className="text-[11px] font-bold text-suka-gray-500 uppercase tracking-wider mb-2">Jejak Waktu</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-suka-gray-600">Dilaporkan oleh <strong className="text-suka-ink">{row.reporter_name ?? '—'}</strong></span>
                <span className="text-suka-gray-500 whitespace-nowrap">{fmtWaktu(row.created_at)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-suka-gray-600">Disetujui oleh <strong className="text-suka-ink">{row.approver_name ?? '—'}</strong></span>
                <span className="text-suka-gray-500 whitespace-nowrap">{fmtWaktu(row.updated_at)}</span>
              </div>
              <div className="flex justify-between gap-3 pt-2 border-t border-suka-gray-100">
                <span className="text-suka-gray-600">Jeda lapor → approve</span>
                <span className="font-bold text-suka-brown">{formatJeda(row.created_at, row.updated_at)}</span>
              </div>
            </div>
          </div>

          {/* Status potongan stok */}
          <div className={`p-4 rounded-2xl border flex items-start gap-3 ${adaLedger ? 'bg-suka-green/5 border-suka-green/20' : 'bg-red-50 border-red-200'}`}>
            {adaLedger
              ? <CheckCircle2 className="w-5 h-5 text-suka-green shrink-0 mt-0.5" />
              : <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />}
            <div>
              <p className={`text-sm font-bold ${adaLedger ? 'text-suka-green' : 'text-red-700'}`}>
                {adaLedger
                  ? `Potongan stok tercatat (${row.ledger_row_count} baris ledger)`
                  : 'Tidak ada baris ledger — stok tidak pernah terpotong'}
              </p>
              <p className="text-[11px] text-suka-gray-500 mt-1 leading-relaxed">
                Yang diperiksa adalah keberadaan baris ledger, bukan kecocokan jumlahnya. Skala ledger
                bergantung pada <code>saldo_is_gram</code> tiap outlet sedangkan qty laporan selalu satuan
                besar, jadi perbandingan angka langsung akan menghasilkan alarm palsu.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
