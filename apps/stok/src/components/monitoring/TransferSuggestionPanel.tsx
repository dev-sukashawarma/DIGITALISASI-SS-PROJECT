'use client'

import React, { useMemo } from 'react'
import type { MonitoringItem } from '@/lib/types/monitoring'
import {
  computeTransferSuggestions,
  type TransferSuggestion,
} from '@/lib/stok/transferSuggestion'

interface TransferSuggestionPanelProps {
  items: MonitoringItem[]
  onTransfer: (suggestion: TransferSuggestion) => void
}

export function TransferSuggestionPanel({
  items,
  onTransfer,
}: TransferSuggestionPanelProps) {
  const suggestions = useMemo(
    () => computeTransferSuggestions(items),
    [items]
  )

  if (suggestions.length === 0) {
    return (
      <div className="p-4 bg-white border border-suka-brown/10 rounded-2xl text-center text-sm text-suka-brown/60">
        Semua stok seimbang ✅
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {suggestions.map((s, idx) => (
        <div
          key={`${s.bahan_baku_id}-${s.recipientOutletId}-${s.donorOutletId}-${idx}`}
          className="p-4 bg-white border border-suka-brown/10 rounded-2xl flex items-center justify-between gap-4"
        >
          <div className="space-y-1">
            <span
              className={`inline-block text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                s.recipientStatus === 'below'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {s.recipientStatus === 'below' ? 'Kritis' : 'Menipis'}
            </span>
            <p className="text-sm text-suka-brown">
              Kirim{' '}
              <span className="font-extrabold">
                {s.qty} {s.satuan} {s.item_name}
              </span>{' '}
              dari <span className="font-bold">{s.donorOutletName}</span> →{' '}
              <span className="font-bold">{s.recipientOutletName}</span>
            </p>
          </div>
          <button
            onClick={() => onTransfer(s)}
            className="shrink-0 px-4 py-2 text-sm font-semibold rounded-xl bg-suka-orange text-white hover:opacity-90 transition-opacity"
          >
            Transfer
          </button>
        </div>
      ))}
    </div>
  )
}
