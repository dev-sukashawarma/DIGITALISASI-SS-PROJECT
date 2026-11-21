'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Banknote, Receipt, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate, formatRupiah } from '@/lib/format'
import type { CashAdvanceStatus } from '@/lib/types'
import type { CashAdvanceRow } from '@/hooks/useCashAdvances'
import { bolehCatatCicilan, labelStatusKasbon, statusEfektifKasbon } from '@/lib/kasbon/statusKasbon'
import { tautanWaKasbon } from '@/lib/whatsappKasbon'

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
    label: 'Menunggu Persetujuan',
    bg: 'bg-blue-50 border-blue-200',
    text: 'text-blue-700',
  },
  menunggu_cair: {
    label: 'Menunggu pencairan',
    bg: 'bg-orange-50 border-orange-200',
    text: 'text-orange-700',
  },
  rejected: {
    label: 'Ditolak',
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-700',
  },
}

function StatusBadge({ status, ditolakFinance = false }: { status: CashAdvanceStatus; ditolakFinance?: boolean }) {
  const cfg = statusConfig[status] ?? statusConfig.pending
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${cfg.bg} ${cfg.text}`}
    >
      {labelStatusKasbon(status, ditolakFinance)}
    </span>
  )
}

function ApprovalFinanceCell({
  row,
  effectiveStatus,
  ditolakFinance,
  proofUrl,
  loadingProofs,
  onViewProof,
}: {
  row: CashAdvanceRow
  effectiveStatus: CashAdvanceStatus
  ditolakFinance: boolean
  proofUrl: string | null
  loadingProofs: boolean
  onViewProof?: (row: CashAdvanceRow) => void
}) {
  if (effectiveStatus === 'pending') {
    return <span className="text-xs text-suka-gray-400">Menunggu HR</span>
  }

  if (effectiveStatus === 'menunggu_cair') {
    return (
      <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-[11px] font-bold text-orange-700">
        Menunggu Pencairan
      </span>
    )
  }

  if (effectiveStatus === 'rejected') {
    if (!ditolakFinance) {
      return <span className="text-xs text-suka-gray-400">—</span>
    }
    return (
      <div className="space-y-0.5">
        <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[11px] font-bold text-red-700">
          Ditolak Finance
        </span>
        {(row.ditolak_finance_at || row.ditolak_finance_oleh_name) && (
          <div className="text-[10px] font-medium text-suka-gray-500">
            {row.ditolak_finance_at ? formatDate(row.ditolak_finance_at) : ''}
            {row.ditolak_finance_oleh_name ? ` · ${row.ditolak_finance_oleh_name}` : ''}
          </div>
        )}
      </div>
    )
  }

  if (!row.dicairkan_at && !row.bukti_cair) {
    return <span className="text-xs text-suka-gray-400">Sebelum alur finance</span>
  }

  const metodeLabel = row.metode_cair === 'tunai' ? 'Tunai' : 'Transfer'
  const waHref = tautanWaKasbon({
    phone: row.staff_phone,
    staffName: row.outlet_staff?.name ?? 'Staf',
    amount: row.amount,
    metodeCair: row.metode_cair,
    dicairkanAt: row.dicairkan_at,
    proofUrl,
  })

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
          Disetujui · {metodeLabel}
        </span>
      </div>
      {(row.dicairkan_at || row.dicairkan_oleh_name) && (
        <div className="text-[10px] font-medium text-suka-gray-500">
          {row.dicairkan_at ? formatDate(row.dicairkan_at) : ''}
          {row.dicairkan_oleh_name ? ` · ${row.dicairkan_oleh_name}` : ''}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        {row.bukti_cair && onViewProof ? (
          <button
            type="button"
            onClick={() => onViewProof(row)}
            className="inline-flex items-center gap-1 rounded-lg border border-suka-orange/40 bg-orange-50/80 px-2 py-1 text-[11px] font-bold text-suka-brown hover:bg-orange-100 transition-colors cursor-pointer"
            title="Lihat / Unduh / Kirim Bukti Transfer"
          >
            <Receipt className="h-3 w-3 text-suka-orange" />
            <span>Bukti TF</span>
          </button>
        ) : (
          <span className="text-[10px] text-suka-gray-400 italic">Tanpa bukti</span>
        )}

        {waHref ? (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 transition-colors"
            title={
              loadingProofs && row.bukti_cair && !proofUrl
                ? 'Memuat tautan bukti transfer...'
                : 'Kirim info & bukti transfer langsung via WhatsApp'
            }
          >
            <MessageCircle className="h-3 w-3" />
            <span>Kirim WA</span>
          </a>
        ) : (
          <button
            type="button"
            onClick={() => toast.error('Nomor WhatsApp staf belum terdaftar di data karyawan')}
            className="inline-flex items-center gap-1 rounded-lg border border-suka-gray-200 bg-suka-gray-50 px-2 py-1 text-[11px] font-semibold text-suka-gray-400 hover:bg-suka-gray-100 transition-colors cursor-pointer"
            title="Nomor WhatsApp staf belum terdaftar"
          >
            <MessageCircle className="h-3 w-3" />
            <span>Kirim WA</span>
          </button>
        )}
      </div>
    </div>
  )
}

function ExpandableRow({
  row,
  proofUrl,
  loadingProofs,
  onAddPayment,
  onApprove,
  onReject,
  onViewProof,
}: {
  row: CashAdvanceRow
  proofUrl: string | null
  loadingProofs: boolean
  onAddPayment: (row: CashAdvanceRow) => void
  onApprove?: (row: CashAdvanceRow) => void
  onReject?: (id: string) => void
  onViewProof?: (row: CashAdvanceRow) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const payments = row.cash_advance_payments ?? []
  const effectiveStatus = statusEfektifKasbon(row)
  const ditolakFinance = Boolean(row.ditolak_finance_at)

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
          <div>{formatRupiah(row.amount)}</div>
          {row.amount_requested != null && row.amount_requested !== row.amount && (
            <div className="text-[10px] text-amber-700 font-sans font-medium">
              Diajukan: {formatRupiah(row.amount_requested)}
            </div>
          )}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-xs font-mono font-black text-red-600">
          {formatRupiah(row.remaining)}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-center">
          <StatusBadge status={effectiveStatus} ditolakFinance={ditolakFinance} />
        </td>
        <td className="whitespace-nowrap px-4 py-3">
          <ApprovalFinanceCell
            row={row}
            effectiveStatus={effectiveStatus}
            ditolakFinance={ditolakFinance}
            proofUrl={proofUrl}
            loadingProofs={loadingProofs}
            onViewProof={onViewProof}
          />
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
          {effectiveStatus === 'pending' ? (
            <div className="flex justify-center gap-2">
              {onApprove && (
                <button
                  onClick={() => onApprove(row)}
                  className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                >
                  Setujui
                </button>
              )}
              {onReject && (
                <button
                  onClick={() => onReject(row.id)}
                  className="px-3 py-1.5 rounded-lg border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                >
                  Tolak
                </button>
              )}
            </div>
          ) : bolehCatatCicilan(effectiveStatus) ? (
            <button
              onClick={() => onAddPayment(row)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-suka-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-suka-brown shadow-2xs hover:border-suka-orange hover:text-suka-orange transition-all cursor-pointer"
            >
              <Banknote className="h-3.5 w-3.5" />
              Bayar Cicilan
            </button>
          ) : effectiveStatus === 'menunggu_cair' ? (
            <span className="text-xs text-orange-600 font-medium">Menunggu finance</span>
          ) : effectiveStatus === 'paid_off' ? (
            <span className="text-xs text-suka-gray-400 font-medium">Lunas</span>
          ) : (
            <span className="text-xs text-red-500 font-medium">Ditolak</span>
          )}
        </td>
      </tr>

      {/* Payment sub-table */}
      {expanded && (
        <tr>
          <td colSpan={7} className="bg-stone-50/80 px-6 py-3 border-y border-stone-200">
            <div className="space-y-2">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <span className="text-xs font-bold text-suka-brown uppercase">Riwayat Pembayaran Cicilan:</span>
                <div className="flex items-center gap-3 text-xs">
                  {row.installment_months && (
                    <span className="text-suka-gray-600 font-medium">Tenor: {row.installment_months} Bulan</span>
                  )}
                  {row.reason && (
                    <span className="text-gray-500 italic">Alasan: {row.reason}</span>
                  )}
                  {row.approval_note && (
                    <span className="text-emerald-700 font-medium">Catatan Approval: {row.approval_note}</span>
                  )}
                  {row.rejection_note && (
                    <span className="text-red-600 font-medium">Alasan Ditolak: {row.rejection_note}</span>
                  )}
                </div>
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
  proofUrls?: Record<string, string>
  loadingProofs?: boolean
  onAddPayment: (row: CashAdvanceRow) => void
  onApprove?: (row: CashAdvanceRow) => void
  onReject?: (id: string) => void
  onViewProof?: (row: CashAdvanceRow) => void
}

export function CashAdvanceTable({
  rows,
  proofUrls = {},
  loadingProofs = false,
  onAddPayment,
  onApprove,
  onReject,
  onViewProof,
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
              <th className="whitespace-nowrap px-4 py-3.5">Approval Finance</th>
              <th className="whitespace-nowrap px-4 py-3.5">Tanggal Pengajuan</th>
              <th className="whitespace-nowrap px-4 py-3.5 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-suka-gray-100">
            {rows.map((row) => (
              <ExpandableRow
                key={row.id}
                row={row}
                proofUrl={row.bukti_cair ? (proofUrls[row.bukti_cair] ?? null) : null}
                loadingProofs={loadingProofs}
                onAddPayment={onAddPayment}
                onApprove={onApprove}
                onReject={onReject}
                onViewProof={onViewProof}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
