'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Award, Lock, CheckCircle2, X } from 'lucide-react'
import { Button } from '@suka/design-system'
import type { TraineeRecord } from '@/hooks/useOnboarding'

interface CrewEvaluationModalProps {
  trainee: TraineeRecord | null
  onClose: () => void
  onSubmit: (data: {
    staff_id: string
    day_count_at_eval: number
    decision: 'pass_pkwt' | 'extend_ojt' | 'failed'
    scores: {
      technical: number
      sop: number
      hygiene: number
      attendance: number
      attitude: number
    }
    notes: string
  }) => Promise<void>
  submitting?: boolean
}

export function CrewEvaluationModal({
  trainee,
  onClose,
  onSubmit,
  submitting = false,
}: CrewEvaluationModalProps) {
  if (!trainee) return null

  const isLocked = trainee.day_count < 15
  const latestEval = trainee.latest_evaluation

  const [decision, setDecision] = useState<'pass_pkwt' | 'extend_ojt' | 'failed'>(
    latestEval?.decision || 'pass_pkwt'
  )
  const [technical, setTechnical] = useState<number>(latestEval?.scores?.technical ?? 80)
  const [sop, setSop] = useState<number>(latestEval?.scores?.sop ?? 85)
  const [hygiene, setHygiene] = useState<number>(latestEval?.scores?.hygiene ?? 85)
  const [attendance, setAttendance] = useState<number>(latestEval?.scores?.attendance ?? 90)
  const [attitude, setAttitude] = useState<number>(latestEval?.scores?.attitude ?? 85)
  const [notes, setNotes] = useState<string>(latestEval?.notes ?? '')

  const avgScore = Math.round((technical + sop + hygiene + attendance + attitude) / 5)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLocked) {
      toast.error('Form kelayakan belum dapat disubmit sebelum hari ke-15!')
      return
    }

    try {
      await onSubmit({
        staff_id: trainee.id,
        day_count_at_eval: trainee.day_count,
        decision,
        scores: { technical, sop, hygiene, attendance, attitude },
        notes,
      })
      toast.success('Form Evaluasi Kelayakan Crew berhasil disimpan!')
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan evaluasi')
    }
  }

  const inputCls =
    'w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-xs font-semibold outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange bg-white text-suka-ink'
  const labelCls = 'mb-1 block text-xs font-bold text-suka-brown'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl border border-suka-gray-200 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-xl p-2 text-suka-gray-500 hover:bg-stone-100 transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 border-b border-suka-gray-200 pb-3.5 mb-4">
          <div className="w-10 h-10 rounded-xl bg-orange-100 text-suka-orange flex items-center justify-center shrink-0">
            <Award size={22} />
          </div>
          <div>
            <h2 className="text-base font-bold text-suka-ink">Form Kelayakan Kerja Crew (AM)</h2>
            <p className="text-xs text-suka-gray-500">
              Evaluasi kinerja dan penetapan status kelayakan OJT oleh Area Manager
            </p>
          </div>
        </div>

        {/* Gating Notice if < 15 days */}
        {isLocked ? (
          <div className="mb-5 rounded-2xl bg-amber-50 p-4 border border-amber-200 text-amber-900 flex items-start gap-3">
            <Lock className="text-amber-700 shrink-0 mt-0.5" size={20} />
            <div className="text-xs space-y-1">
              <p className="font-bold text-amber-950">Form Kelayakan Terkunci</p>
              <p>
                Karyawan saat ini baru berada di <span className="font-bold">Hari ke-{trainee.day_count}</span> masa onboarding.
                Form kelayakan baru dapat diisi oleh Area Manager setelah memasuki <span className="font-bold">Hari ke-15</span>.
              </p>
              <p className="font-mono text-amber-800 pt-1">
                ⏳ Sisa waktu menunggu: <span className="font-bold">{trainee.days_until_evaluation} hari lagi</span>.
              </p>
            </div>
          </div>
        ) : (
          <div className="mb-5 rounded-2xl bg-emerald-50 p-3.5 border border-emerald-200 text-emerald-900 flex items-center justify-between text-xs font-semibold">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              <span>Karyawan telah mencapai Hari ke-{trainee.day_count} (Memenuhi syarat evaluasi)</span>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-200/80 text-emerald-900 font-bold text-[11px]">
              Siap Dinilai
            </span>
          </div>
        )}

        {/* Trainee Profile Bar */}
        <div className="mb-4 rounded-xl bg-stone-50 p-3 border border-stone-200 flex flex-wrap justify-between items-center gap-2 text-xs">
          <div>
            <span className="font-bold text-suka-ink block text-sm">{trainee.name}</span>
            <span className="text-stone-500">
              {trainee.outlet_name} &bull; Sub-role: <span className="font-semibold text-purple-700 capitalize">{trainee.sub_role.replace('_', ' ')}</span>
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-stone-400 block uppercase font-bold">Mulai Training</span>
            <span className="font-mono font-bold text-stone-800">
              {trainee.training_start_date || trainee.join_date || '-'}
            </span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="border-t border-stone-200 pt-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-suka-brown mb-3">
              1. Penilaian Aspek Kinerja (Skala 1 - 100)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Teknis &amp; Kecepatan Operasional ({technical})</label>
                <input
                  type="range"
                  min={50}
                  max={100}
                  disabled={isLocked}
                  value={technical}
                  onChange={(e) => setTechnical(Number(e.target.value))}
                  className="w-full accent-suka-orange cursor-pointer disabled:opacity-50"
                />
              </div>

              <div>
                <label className={labelCls}>Kepatuhan SOP Shawarma ({sop})</label>
                <input
                  type="range"
                  min={50}
                  max={100}
                  disabled={isLocked}
                  value={sop}
                  onChange={(e) => setSop(Number(e.target.value))}
                  className="w-full accent-suka-orange cursor-pointer disabled:opacity-50"
                />
              </div>

              <div>
                <label className={labelCls}>Kebersihan &amp; Hygiene ({hygiene})</label>
                <input
                  type="range"
                  min={50}
                  max={100}
                  disabled={isLocked}
                  value={hygiene}
                  onChange={(e) => setHygiene(Number(e.target.value))}
                  className="w-full accent-suka-orange cursor-pointer disabled:opacity-50"
                />
              </div>

              <div>
                <label className={labelCls}>Disiplin &amp; Ketepatan Waktu ({attendance})</label>
                <input
                  type="range"
                  min={50}
                  max={100}
                  disabled={isLocked}
                  value={attendance}
                  onChange={(e) => setAttendance(Number(e.target.value))}
                  className="w-full accent-suka-orange cursor-pointer disabled:opacity-50"
                />
              </div>

              <div className="sm:col-span-2">
                <label className={labelCls}>Attitude &amp; Kerja Sama Tim ({attitude})</label>
                <input
                  type="range"
                  min={50}
                  max={100}
                  disabled={isLocked}
                  value={attitude}
                  onChange={(e) => setAttitude(Number(e.target.value))}
                  className="w-full accent-suka-orange cursor-pointer disabled:opacity-50"
                />
              </div>
            </div>

            {/* Average Score Display */}
            <div className="mt-3 p-3 rounded-xl bg-amber-50/70 border border-amber-200 flex justify-between items-center text-xs">
              <span className="font-bold text-amber-900">Rata-rata Skor Evaluasi:</span>
              <span className="text-base font-black text-amber-950 font-mono">
                {avgScore} / 100 ({avgScore >= 85 ? 'Sangat Baik' : avgScore >= 75 ? 'Baik' : 'Perlu Bimbingan'})
              </span>
            </div>
          </div>

          <div className="border-t border-stone-200 pt-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-suka-brown mb-2">
              2. Rekomendasi Keputusan Area Manager
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label
                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  decision === 'pass_pkwt'
                    ? 'border-emerald-500 bg-emerald-50/70 text-emerald-900 font-bold'
                    : 'border-stone-200 hover:border-stone-300 text-stone-700'
                } ${isLocked ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <input
                  type="radio"
                  name="decision"
                  value="pass_pkwt"
                  checked={decision === 'pass_pkwt'}
                  onChange={() => setDecision('pass_pkwt')}
                  className="sr-only"
                />
                <span className="text-xs font-bold">Lulus ke PKWT</span>
                <span className="text-[10px] text-stone-500 text-center mt-0.5">
                  Resmi jadi kru kontrak
                </span>
              </label>

              <label
                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  decision === 'extend_ojt'
                    ? 'border-blue-500 bg-blue-50/70 text-blue-900 font-bold'
                    : 'border-stone-200 hover:border-stone-300 text-stone-700'
                } ${isLocked ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <input
                  type="radio"
                  name="decision"
                  value="extend_ojt"
                  checked={decision === 'extend_ojt'}
                  onChange={() => setDecision('extend_ojt')}
                  className="sr-only"
                />
                <span className="text-xs font-bold">Perpanjang OJT</span>
                <span className="text-[10px] text-stone-500 text-center mt-0.5">
                  1 bulan bimbingan
                </span>
              </label>

              <label
                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  decision === 'failed'
                    ? 'border-red-500 bg-red-50/70 text-red-900 font-bold'
                    : 'border-stone-200 hover:border-stone-300 text-stone-700'
                } ${isLocked ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <input
                  type="radio"
                  name="decision"
                  value="failed"
                  checked={decision === 'failed'}
                  onChange={() => setDecision('failed')}
                  className="sr-only"
                />
                <span className="text-xs font-bold">Tidak Lolos</span>
                <span className="text-[10px] text-stone-500 text-center mt-0.5">
                  Gugur masa OJT
                </span>
              </label>
            </div>
          </div>

          <div>
            <label htmlFor="eval-notes" className={labelCls}>Catatan Evaluasi Khusus untuk HR</label>
            <textarea
              id="eval-notes"
              rows={3}
              disabled={isLocked}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan kelebihan, kekurangan, atau rekomendasi outlet penempatan staf..."
              className={inputCls}
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-stone-200 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="rounded-xl px-4 py-2 font-bold text-xs"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isLocked || submitting}
              className="rounded-xl px-5 py-2 font-bold bg-suka-orange hover:bg-suka-orange/90 text-white text-xs disabled:opacity-50"
            >
              {submitting ? 'Menyimpan...' : 'Simpan Hasil Evaluasi'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
