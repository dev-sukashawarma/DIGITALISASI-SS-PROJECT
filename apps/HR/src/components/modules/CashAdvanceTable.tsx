'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Banknote } from 'lucide-react'
import { formatRupiah } from '@/lib/format'
import type { CashAdvanceStatus } from '@/lib/types'
import type { CashAdvanceRow } from '@/hooks/useCashAdvances'

const statusConfig: Record<
  CashAdvanceStatus,
  { label: string; bg: string; text: string }
> = {
  active: {
    label: 'Aktif',
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-700',
  },
  paid_off: {
    label: 'Lunas',
    bg: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-700',
  },
  pending: {
    label: 'Pending',
    bg: 'bg-blue-50 border-blue-200',
    text: 'text-blue-700',
  },
  rejected: {
    label: 'Ditolak',
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-700',
  },
}

function StatusBadge({ status }: { status: CashAdvanceStatus }) {
  const cfg = statusConfig[status] ?? statusConfig.active
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${cfg.bg} ${cfg.text}`}
    >
      {cfg.label}
    </span>
  )
}

function ExpandableRow({
  row,
  onAddPayment,
  onApprove,
  onReject,
}: {
  row: CashAdvanceRow
  onAddPayment: (row: CashAdvanceRow) => void
  onApprove?: (id: string) => void
  onReject?: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const payments = row.cash_advance_payments ?? []

  return (
    <>
      <tr className="transition-colors hover:bg-amber-50/30">
        <td className="whitespace-nowrap px-4 py-3">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mr-2 inline-flex items-center text-suka-gray-400 hover:text-suka-ink transition-colors cursor-pointer"
            aria-label={expanded ? 'Tutup detail' : 'Buka detail'}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          <span className="font-bold text-suka-ink text-sm">
            {row.outlet_staff?.name ?? '—'}
          </span>
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-xs font-mono font-semibold text-gray-700">
          {formatRupiah(row.amount)}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-xs font-mono font-black text-red-600">
          {formatRupiah(row.remaining)}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-center">
          <StatusBadge status={row.status} />
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500 font-mono">
          {row.created_at
            ? new Date(row.created_at).toLocaleDateString('id-ID', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })
            : '—'}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-center">
          {row.status === 'active' ? (
            <button
              onClick={() => onAddPayment(row)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-suka-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-suka-brown shadow-2xs hover:border-suka-orange hover:text-suka-orange transition-all cursor-pointer"
            >
              <Banknote className="h-3.5 w-3.5" />
              Bayar Cicilan
            </button>
          ) : row.status === 'pending' ? (
            <div className="flex justify-center gap-2">
              {onApprove && (
                <button
                  onClick={() => onApprove(row.id)}
                  className="px-3 py-1 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-bold transition-colors cursor-pointer"
                >
                  Setujui
                </button>
              )}
              {onReject && (
                <button
                  onClick={() => onReject(row.id)}
                  className="px-3 py-1 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-xs font-bold transition-colors cursor-pointer"
                >
                  Tolak
                </button>
              )}
            </div>
          ) : (
            <span className="text-xs text-suka-gray-400 font-medium">Lunas</span>
          )}
        </td>
      </tr>

      {/* Payment sub-table */}
      {expanded && (
        <tr>
          <td colSpan={6} className="bg-stone-50/80 px-6 py-3 border-y border-stone-200">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-suka-brown uppercase">Riwayat Pembayaran Cicilan:</span>
                {row.reason && (
                  <span className="text-xs text-gray-500 italic">Alasan pinjaman: {row.reason}</span>
                )}
              </div>

              {payments.length === 0 ? (
                <p className="py-2 text-center text-xs text-gray-400">Belum ada catatan pembayaran cicilan.</p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FDF9F3] border-b border-stone-200 text-suka-brown font-bold">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Tanggal Bayar</th>
                        <th className="px-3 py-2 text-right">Jumlah Dibayar</th>
                        <th className="px-3 py-2">Catatan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {payments.map((p, idx) => (
                        <tr key={p.id}>
                          <td className="px-3 py-1.5 text-gray-400 font-mono">{idx + 1}</td>
                          <td className="px-3 py-1.5 text-gray-600 font-mono">{p.payment_date}</td>
                          <td className="px-3 py-1.5 text-right font-mono font-bold text-emerald-700">
                            {formatRupiah(p.amount)}
                          </td>
                          <td className="px-3 py-1.5 text-gray-500">{p.note || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

interface CashAdvanceTableProps {
  rows: CashAdvanceRow[]
  onAddPayment: (row: CashAdvanceRow) => void
  onApprove?: (id: string) => void
  onReject?: (id: string) => void
}

export function CashAdvanceTable({
  rows,
  onAddPayment,
  onApprove,
  onReject,
}: CashAdvanceTableProps) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-suka-gray-400 bg-white rounded-2xl border border-suka-gray-200">
        <p className="text-sm font-medium">Belum ada riwayat kasbon karyawan.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-suka-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-suka-gray-200 bg-[#FDF9F3] text-suka-brown font-bold text-xs uppercase tracking-wider">
            <tr>
              <th className="whitespace-nowrap px-4 py-3.5">Nama Staf</th>
              <th className="whitespace-nowrap px-4 py-3.5 text-right">Total Pinjaman</th>
              <th className="whitespace-nowrap px-4 py-3.5 text-right">Sisa Hutang</th>
              <th className="whitespace-nowrap px-4 py-3.5 text-center">Status</th>
              <th className="whitespace-nowrap px-4 py-3.5">Tanggal Pengajuan</th>
              <th className="whitespace-nowrap px-4 py-3.5 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-suka-gray-100">
            {rows.map((row) => (
              <ExpandableRow
                key={row.id}
                row={row}
                onAddPayment={onAddPayment}
                onApprove={onApprove}
                onReject={onReject}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
