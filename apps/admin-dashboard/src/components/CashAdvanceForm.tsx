'use client';

import { useState } from 'react';
import { Button, CurrencyInput } from '@suka/design-system';
import { useStaff } from '@/hooks/useStaff';
import { rupiah } from '@/lib/format';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CashAdvanceFormProps {
  mode: 'kasbon' | 'payment';
  onSubmit: (data: Record<string, any>) => void;
  submitting: boolean;
  onCancel?: () => void;
  maxAmount?: number;
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const inputClass =
  'w-full rounded-xl border border-suka-gray-200 px-3 py-2.5 outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all bg-white text-suka-ink text-sm';

const labelClass = 'mb-1 block text-sm font-semibold text-suka-ink';

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function CashAdvanceForm({
  mode,
  onSubmit,
  submitting,
  onCancel,
  maxAmount,
}: CashAdvanceFormProps) {
  /* Kasbon mode state */
  const [staffId, setStaffId] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [reason, setReason] = useState('');

  /* Payment mode state */
  const [payAmount, setPayAmount] = useState<number>(0);
  const [note, setNote] = useState('');

  const { data: staffList = [] } = useStaff();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'kasbon') {
      if (!staffId || !amount) return;
      onSubmit({ staff_id: staffId, amount, reason: reason.trim() });
    } else {
      if (!payAmount || payAmount <= 0) return;
      onSubmit({ amount: payAmount, note: note.trim() || null });
    }
  };

  const resetForm = () => {
    setStaffId('');
    setAmount(0);
    setReason('');
    setPayAmount(0);
    setNote('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-suka-gray-200 bg-white p-6 shadow-xl"
      >
        <h3 className="text-lg font-bold text-suka-ink">
          {mode === 'kasbon' ? 'Tambah Kasbon Baru' : 'Bayar Cicilan'}
        </h3>
        <p className="mt-0.5 text-sm text-suka-gray-400">
          {mode === 'kasbon'
            ? 'Buat pinjaman kasbon untuk staf.'
            : `Maksimal pembayaran: ${maxAmount != null ? rupiah(maxAmount) : '—'}`}
        </p>

        <div className="mt-5 space-y-4">
          {mode === 'kasbon' ? (
            <>
              {/* Staff dropdown */}
              <div>
                <label className={labelClass}>Staf</label>
                <select
                  className={inputClass}
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                  required
                >
                  <option value="">Pilih staf…</option>
                  {staffList.filter(s => s.role !== 'kiosk').map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {s.role}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div>
                <CurrencyInput
                  label="Jumlah Pinjaman"
                  className={inputClass}
                  value={amount}
                  onChange={setAmount}
                  required
                />
              </div>

              {/* Reason */}
              <div>
                <label className={labelClass}>Alasan</label>
                <textarea
                  rows={3}
                  className={inputClass}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Alasan pinjaman (opsional)"
                />
              </div>
            </>
          ) : (
            <>
              {/* Payment amount */}
              <div>
                <CurrencyInput
                  label="Jumlah Bayar"
                  className={inputClass}
                  value={payAmount}
                  onChange={(v) => setPayAmount(maxAmount != null ? Math.min(v, maxAmount) : v)}
                  required
                />
              </div>

              {/* Note */}
              <div>
                <label className={labelClass}>Catatan</label>
                <textarea
                  rows={3}
                  className={inputClass}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Catatan pembayaran (opsional)"
                />
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              resetForm();
              onCancel?.();
            }}
            disabled={submitting}
            className="rounded-xl border border-suka-gray-200 px-4 py-2.5 text-sm font-medium text-suka-gray-500 transition-colors hover:bg-suka-gray-50"
          >
            Batal
          </button>
          <Button type="submit" disabled={submitting}>
            {submitting
              ? 'Menyimpan…'
              : mode === 'kasbon'
                ? 'Simpan Kasbon'
                : 'Bayar'}
          </Button>
        </div>
      </form>
    </div>
  );
}
