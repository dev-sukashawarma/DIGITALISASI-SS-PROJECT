'use client';

import { Pencil } from 'lucide-react';
import { rupiah } from '@/lib/format';
import type { PayrollStatus } from '@/lib/types';
import type { PayrollRow } from '@/hooks/usePayroll';

/* ------------------------------------------------------------------ */
/*  Status badge                                                       */
/* ------------------------------------------------------------------ */

const statusConfig: Record<
  PayrollStatus,
  { label: string; bg: string; text: string }
> = {
  draft: {
    label: 'Draft',
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-700',
  },
  finalized: {
    label: 'Final',
    bg: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-700',
  },
};

function StatusBadge({ status }: { status: PayrollStatus }) {
  const cfg = statusConfig[status] ?? statusConfig.draft;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.bg} ${cfg.text}`}
    >
      {cfg.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  PayrollTable                                                       */
/* ------------------------------------------------------------------ */

interface PayrollTableProps {
  rows: PayrollRow[];
  onEdit: (row: PayrollRow) => void;
}

export function PayrollTable({ rows, onEdit }: PayrollTableProps) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-suka-gray-400">
        <p className="text-sm">Belum ada data slip gaji untuk periode ini.</p>
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
              <th className="whitespace-nowrap px-4 py-3 font-semibold text-suka-ink">
                Outlet
              </th>
              <th className="whitespace-nowrap px-4 py-3 font-semibold text-suka-ink text-right">
                Gapok
              </th>
              <th className="whitespace-nowrap px-4 py-3 font-semibold text-suka-ink text-right">
                Tunj. Jabatan
              </th>
              <th className="whitespace-nowrap px-4 py-3 font-semibold text-suka-ink text-right">
                Tunj. Hadir
              </th>
              <th className="whitespace-nowrap px-4 py-3 font-semibold text-suka-ink text-right">
                Bonus
              </th>
              <th className="whitespace-nowrap px-4 py-3 font-semibold text-suka-ink text-right">
                Potongan
              </th>
              <th className="whitespace-nowrap px-4 py-3 font-semibold text-suka-ink text-right">
                Total
              </th>
              <th className="whitespace-nowrap px-4 py-3 font-semibold text-suka-ink text-center">
                Status
              </th>
              <th className="whitespace-nowrap px-4 py-3 font-semibold text-suka-ink text-center">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-suka-gray-100">
            {rows.map((row) => (
              <tr
                key={row.id}
                className="transition-colors hover:bg-suka-cream/30"
              >
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="font-medium text-suka-ink">
                    {row.outlet_staff?.name ?? '—'}
                  </div>
                  <div className="text-xs text-suka-gray-400">
                    {row.outlet_staff?.role ?? '—'}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-suka-gray-500">
                  {row.outlet_staff?.outlets?.name ?? '—'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-suka-gray-600">
                  {rupiah(row.basic_salary)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-suka-gray-600">
                  {rupiah(row.allowance_position)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-suka-gray-600">
                  {rupiah(row.allowance_presence)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-suka-gray-600">
                  {row.bonus ? rupiah(row.bonus) : '—'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-red-500">
                  {row.deductions ? `- ${rupiah(row.deductions)}` : '—'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums font-bold text-suka-ink">
                  {rupiah(row.total_salary)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-center">
                  <StatusBadge status={row.status} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-center">
                  {row.status === 'draft' ? (
                    <button
                      onClick={() => onEdit(row)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-suka-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-suka-ink shadow-sm transition-all hover:border-suka-orange hover:text-suka-orange"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                  ) : (
                    <span className="text-xs text-suka-gray-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
