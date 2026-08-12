'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Banknote } from 'lucide-react';
import { rupiah } from '@/lib/format';
import type { CashAdvanceStatus } from '@/lib/types';
import type { CashAdvanceRow } from '@/hooks/useCashAdvances';

/* ------------------------------------------------------------------ */
/*  Status badge                                                       */
/* ------------------------------------------------------------------ */

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
};

function StatusBadge({ status }: { status: CashAdvanceStatus }) {
  const cfg = statusConfig[status] ?? statusConfig.active;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.bg} ${cfg.text}`}
    >
      {cfg.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Expandable Row                                                     */
/* ------------------------------------------------------------------ */

function ExpandableRow({
  row,
  onAddPayment,
  onApprove,
  onReject,
}: {
  row: CashAdvanceRow;
  onAddPayment: (row: CashAdvanceRow) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const payments = row.cash_advance_payments ?? [];

  return (
    <>
      <tr className="transition-colors hover:bg-suka-cream/30">
        <td className="whitespace-nowrap px-4 py-3">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mr-2 inline-flex items-center text-suka-gray-400 hover:text-suka-ink transition-colors"
            aria-label={expanded ? 'Tutup detail' : 'Buka detail'}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          <span className="font-medium text-suka-ink">
            {row.outlet_staff?.name ?? '—'}
          </span>
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-suka-gray-600">
          {rupiah(row.amount)}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums font-semibold text-suka-ink">
          {rupiah(row.remaining)}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-center">
          <StatusBadge status={row.status} />
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-suka-gray-500">
          {row.created_at
            ? new Date(row.created_at).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', 
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-suka-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-suka-ink shadow-sm transition-all hover:border-suka-orange hover:text-suka-orange"
            >
              <Banknote className="h-3.5 w-3.5" />
              Bayar Cicilan
            </button>
          ) : row.status === 'pending' ? (
            <div className="flex justify-center gap-2">
              {onApprove && (
                <button
                  onClick={() => onApprove(row.id)}
                  className="px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-medium transition-colors"
                >
                  Setujui
                </button>
              )}
              {onReject && (
                <button
                  onClick={() => onReject(row.id)}
                  className="px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-xs font-medium transition-colors"
                >
                  Tolak
                </button>
              )}
            </div>
          ) : (
            <span className="text-xs text-suka-gray-300">—</span>
          )}
        </td>
      </tr>

      {/* Payment sub-table */}
      {expanded && (
        <tr>
          <td colSpan={6} className="bg-suka-cream/20 px-4 pb-4 pt-1">
            {payments.length === 0 ? (
              <p className="py-3 text-center text-xs text-suka-gray-400">
                Belum ada pembayaran cicilan.
              </p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-suka-gray-100 bg-white">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-suka-gray-100 bg-suka-cream/40">
                      <th className="px-3 py-2 font-semibold text-suka-gray-500">
                        #
                      </th>
                      <th className="px-3 py-2 font-semibold text-suka-gray-500">
                        Tanggal
                      </th>
                      <th className="px-3 py-2 font-semibold text-suka-gray-500 text-right">
                        Jumlah
                      </th>
                      <th className="px-3 py-2 font-semibold text-suka-gray-500">
                        Catatan
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-suka-gray-50">
                    {payments
                      .sort(
                        (a, b) =>
                          new Date(a.created_at ?? 0).getTime() -
                          new Date(b.created_at ?? 0).getTime()
                      )
                      .map((p, idx) => (
                        <tr key={p.id}>
                          <td className="px-3 py-2 text-suka-gray-400">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-2 text-suka-gray-600">
                            {p.payment_date
                              ? new Date(p.payment_date).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', 
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                  }
                                )
                              : '—'}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium text-emerald-600">
                            {rupiah(p.amount)}
                          </td>
                          <td className="px-3 py-2 text-suka-gray-500">
                            {p.note || '—'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Reason */}
            {row.reason && (
              <p className="mt-2 text-xs text-suka-gray-400">
                <span className="font-semibold">Alasan:</span> {row.reason}
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  CashAdvanceTable                                                   */
/* ------------------------------------------------------------------ */

interface CashAdvanceTableProps {
  rows: CashAdvanceRow[];
  onAddPayment: (row: CashAdvanceRow) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

export function CashAdvanceTable({ rows, onAddPayment, onApprove, onReject }: CashAdvanceTableProps) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-suka-gray-400">
        <p className="text-sm">Belum ada data kasbon.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-suka-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-suka-gray-200 bg-suka-cream/60">
              <th className="whitespace-nowrap px-4 py-3 font-semibold text-suka-ink">
                Nama
              </th>
              <th className="whitespace-nowrap px-4 py-3 font-semibold text-suka-ink text-right">
                Jumlah Pinjaman
              </th>
              <th className="whitespace-nowrap px-4 py-3 font-semibold text-suka-ink text-right">
                Sisa
              </th>
              <th className="whitespace-nowrap px-4 py-3 font-semibold text-suka-ink text-center">
                Status
              </th>
              <th className="whitespace-nowrap px-4 py-3 font-semibold text-suka-ink">
                Tanggal
              </th>
              <th className="whitespace-nowrap px-4 py-3 font-semibold text-suka-ink text-center">
                Aksi
              </th>
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
  );
}
