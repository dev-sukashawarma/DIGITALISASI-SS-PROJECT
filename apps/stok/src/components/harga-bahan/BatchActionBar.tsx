import React from 'react'
import { RefreshCw, X, CheckSquare } from 'lucide-react'

interface BatchActionBarProps {
  selectedCount: number
  onClearSelection: () => void
  onOpenBatchSync: () => void
  canEditMaster?: boolean
}

export function BatchActionBar({
  selectedCount,
  onClearSelection,
  onOpenBatchSync,
  canEditMaster = true
}: BatchActionBarProps) {
  if (selectedCount === 0 || !canEditMaster) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-suka-brown text-white px-5 py-3 rounded-2xl shadow-2xl border border-white/15 flex items-center gap-4 animate-slide-up">
      <div className="flex items-center gap-2 text-xs font-bold">
        <CheckSquare className="w-4 h-4 text-suka-orange" />
        <span>
          <strong className="text-suka-orange font-black">{selectedCount}</strong> bahan baku dipilih
        </span>
      </div>

      <div className="h-4 w-px bg-white/20" />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClearSelection}
          className="text-[11px] font-bold text-white/70 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10 transition-all flex items-center gap-1 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
          Batal
        </button>

        <button
          type="button"
          onClick={onOpenBatchSync}
          className="px-3.5 py-1.5 bg-suka-orange hover:bg-orange-500 active:scale-95 text-white text-xs font-black rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Sinkronkan {selectedCount} Item ke Master
        </button>
      </div>
    </div>
  )
}
