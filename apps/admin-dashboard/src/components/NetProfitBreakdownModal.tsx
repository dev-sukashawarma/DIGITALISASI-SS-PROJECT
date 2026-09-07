'use client'
import { useEffect } from 'react'
import { X, Calculator } from 'lucide-react'
import { rupiah } from '@/lib/format'
import { buildProfitWaterfall, type WaterfallInput } from '@/lib/profitWaterfall'

interface NetProfitBreakdownModalProps {
  isOpen: boolean
  onClose: () => void
  /** Judul konteks: periode & lingkup outlet yang sedang dilihat. */
  periodLabel: string
  scopeLabel: string
  input: WaterfallInput
}

export function NetProfitBreakdownModal({
  isOpen, onClose, periodLabel, scopeLabel, input,
}: NetProfitBreakdownModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const steps = buildProfitWaterfall(input)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Rincian pembentuk laba bersih"
        className="w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 py-4 border-b border-suka-gray-100 bg-suka-gray-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-suka-orange/10 flex items-center justify-center shrink-0">
              <Calculator className="w-5 h-5 text-suka-orange" />
            </div>
            <div>
              <h2 className="text-base font-black text-suka-brown tracking-tight">Rincian Laba Bersih</h2>
              <p className="text-[11px] text-suka-gray-500 font-medium mt-0.5">
                {scopeLabel} · {periodLabel} · porsi dihitung terhadap omzet kotor
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup rincian"
            className="p-2 rounded-xl text-suka-gray-400 hover:text-suka-brown hover:bg-suka-gray-100 transition-colors active:scale-95 shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-5 sm:p-6 space-y-1.5">
          {steps.map((step) => {
            const isTotal = step.kind === 'total'
            const isSubtotal = step.kind === 'subtotal'
            const negative = step.amount < 0

            if (isTotal || isSubtotal) {
              return (
                <div
                  key={step.key}
                  className={`flex items-center justify-between gap-4 rounded-2xl px-4 py-3 ${
                    isTotal
                      ? step.amount >= 0
                        ? 'bg-suka-cream/60 border-2 border-suka-orange/30'
                        : 'bg-rose-50/70 border-2 border-rose-200'
                      : 'bg-suka-gray-50 border border-suka-gray-200'
                  }`}
                >
                  <span className={`font-black tracking-tight ${isTotal ? 'text-sm sm:text-base uppercase' : 'text-sm'} ${
                    isTotal && step.amount < 0 ? 'text-rose-900' : 'text-suka-brown'
                  }`}>
                    {step.label}
                  </span>
                  <span className="text-right shrink-0">
                    <span className={`font-black tracking-tight ${isTotal ? 'text-lg sm:text-xl' : 'text-base'} ${
                      step.amount >= 0 ? (isTotal ? 'text-suka-brown' : 'text-emerald-700') : 'text-rose-600'
                    }`}>
                      {step.amount < 0 ? '-' : ''}{rupiah(Math.abs(step.amount))}
                    </span>
                    <span className="block text-[11px] font-bold text-suka-gray-500">
                      {step.pctOfGross.toFixed(1)}% dari omzet
                    </span>
                  </span>
                </div>
              )
            }

            return (
              <div
                key={step.key}
                className={`flex items-start justify-between gap-4 px-4 py-2 ${
                  step.kind === 'deduction' ? 'border-l-2 border-rose-200 ml-2' : ''
                }`}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-suka-gray-700">{step.label}</span>
                  {step.hint && (
                    <span className="block text-[11px] text-suka-gray-400 leading-snug">{step.hint}</span>
                  )}
                </span>
                <span className="text-right shrink-0">
                  <span className={`block text-sm font-bold ${negative ? 'text-rose-600' : 'text-suka-brown'}`}>
                    {negative ? '-' : ''}{rupiah(Math.abs(step.amount))}
                  </span>
                  <span className="block text-[11px] font-medium text-suka-gray-400">
                    {step.pctOfGross.toFixed(1)}%
                  </span>
                </span>
              </div>
            )
          })}
        </div>

        <div className="px-6 py-3 border-t border-suka-gray-100 bg-suka-gray-50/60">
          <p className="text-[11px] text-suka-gray-500 leading-snug">
            Kerugian waste dipotong setelah laba kotor, bukan bagian dari HPP resep — HPP hanya menghitung
            bahan yang benar-benar terpakai untuk menu terjual.
          </p>
        </div>
      </div>
    </div>
  )
}
