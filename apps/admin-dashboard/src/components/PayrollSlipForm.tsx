'use client';

import { useState, useEffect, useMemo } from 'react';
import { rupiah } from '@/lib/format';
import { Button } from '@suka/design-system';
import type { PayrollRow } from '@/hooks/usePayroll';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PayrollSlipFormProps {
  record: PayrollRow;
  onSubmit: (data: {
    id: string;
    basic_salary: number;
    allowance_position: number;
    allowance_presence: number;
    bonus: number;
    bonus_note: string | null;
    deductions: number;
    deduction_note: string | null;
  }) => void;
  submitting: boolean;
  onCancel: () => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const inputClass =
  'w-full rounded-xl border border-suka-gray-200 px-3 py-2.5 outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all bg-white text-suka-ink text-sm';

const labelClass = 'mb-1 block text-sm font-semibold text-suka-ink';

const readonlyClass =
  'w-full rounded-xl border border-suka-gray-100 bg-suka-cream/40 px-3 py-2.5 text-sm text-suka-gray-500 cursor-not-allowed';

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function PayrollSlipForm({
  record,
  onSubmit,
  submitting,
  onCancel,
}: PayrollSlipFormProps) {
  const [bonus, setBonus] = useState(record.bonus ?? 0);
  const [bonusNote, setBonusNote] = useState(record.bonus_note ?? '');
  const [deductions, setDeductions] = useState(record.deductions ?? 0);
  const [deductionNote, setDeductionNote] = useState(record.deduction_note ?? '');

  /* Reset when record changes */
  useEffect(() => {
    setBonus(record.bonus ?? 0);
    setBonusNote(record.bonus_note ?? '');
    setDeductions(record.deductions ?? 0);
    setDeductionNote(record.deduction_note ?? '');
  }, [record]);

  const totalSalary = useMemo(
    () =>
      record.basic_salary +
      record.allowance_position +
      record.allowance_presence +
      bonus -
      deductions,
    [record, bonus, deductions]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      id: record.id,
      basic_salary: record.basic_salary,
      allowance_position: record.allowance_position,
      allowance_presence: record.allowance_presence,
      bonus,
      bonus_note: bonusNote.trim() || null,
      deductions,
      deduction_note: deductionNote.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-2xl border border-suka-gray-200 bg-white p-6 shadow-xl"
      >
        {/* Header */}
        <h3 className="text-lg font-bold text-suka-ink">Edit Slip Gaji</h3>
        <p className="mt-0.5 text-sm text-suka-gray-400">
          {record.outlet_staff?.name ?? '—'} &middot;{' '}
          {MONTHS[(record.period_month ?? 1) - 1]} {record.period_year}
        </p>

        <div className="mt-5 space-y-4">
          {/* Readonly base info */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Gaji Pokok</label>
              <input className={readonlyClass} value={rupiah(record.basic_salary)} readOnly />
            </div>
            <div>
              <label className={labelClass}>Tunj. Jabatan</label>
              <input
                className={readonlyClass}
                value={rupiah(record.allowance_position)}
                readOnly
              />
            </div>
            <div>
              <label className={labelClass}>Tunj. Hadir</label>
              <input
                className={readonlyClass}
                value={rupiah(record.allowance_presence)}
                readOnly
              />
            </div>
          </div>

          {/* Editable fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Bonus</label>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={bonus || ''}
                onChange={(e) => setBonus(Number(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
            <div>
              <label className={labelClass}>Catatan Bonus</label>
              <input
                type="text"
                className={inputClass}
                value={bonusNote}
                onChange={(e) => setBonusNote(e.target.value)}
                placeholder="Opsional"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Potongan</label>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={deductions || ''}
                onChange={(e) => setDeductions(Number(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
            <div>
              <label className={labelClass}>Catatan Potongan</label>
              <input
                type="text"
                className={inputClass}
                value={deductionNote}
                onChange={(e) => setDeductionNote(e.target.value)}
                placeholder="Opsional"
              />
            </div>
          </div>

          {/* Calculated total */}
          <div className="rounded-xl bg-suka-cream/60 border border-suka-gray-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-suka-gray-500">
                Total Gaji
              </span>
              <span className="text-lg font-bold text-suka-ink">
                {rupiah(totalSalary)}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-xl border border-suka-gray-200 px-4 py-2.5 text-sm font-medium text-suka-gray-500 transition-colors hover:bg-suka-gray-50"
          >
            Batal
          </button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Menyimpan…' : 'Simpan Perubahan'}
          </Button>
        </div>
      </form>
    </div>
  );
}
