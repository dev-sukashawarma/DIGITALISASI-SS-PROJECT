'use client'

import { useState } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import { getReceiptPrintLog } from '@/app/actions/posReport'
import { receiptPrintTimeline, type ReceiptChip, type ReceiptPrintLogRow } from '@/lib/posReport/receiptReprint'

const timeFormat = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
})

const TONE = {
  ok: { chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  late: { chip: 'bg-amber-50 text-amber-800 ring-amber-200', dot: 'bg-amber-500' },
  skipped: { chip: 'bg-red-50 text-red-700 ring-red-200', dot: 'bg-red-500' },
} as const

/** Chip status struk (Customer / Dapur). Bila dicetak lebih dari sekali, chip bisa
 *  diklik untuk melihat waktu & pencetak tiap cetak; log diambil sekali saat dibuka. */
export default function ReceiptChipBadge({ orderId, chip }: { orderId: string; chip: ReceiptChip }) {
  const [open, setOpen] = useState(false)
  const [logs, setLogs] = useState<ReceiptPrintLogRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const expandable = chip.count > 1
  const tone = TONE[chip.tone]

  const toggle = async () => {
    const next = !open
    setOpen(next)
    if (!next || logs || loading) return
    setLoading(true)
    setError(false)
    try {
      setLogs((await getReceiptPrintLog(orderId)) as ReceiptPrintLogRow[])
    } catch {
      setError(true)
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  const content = (
    <>
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      <span className="font-semibold opacity-70">{chip.name}</span>
      <span>{chip.status}</span>
      {expandable && (
        <span className="ml-0.5 rounded bg-white/80 px-1 font-bold tabular-nums">{chip.count}x</span>
      )}
      {expandable && (loading
        ? <Loader2 className="h-3 w-3 animate-spin" />
        : <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />)}
    </>
  )
  const chipClass = `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${tone.chip}`
  const timeline = logs ? receiptPrintTimeline(logs, chip.kind, chip.count) : null

  return (
    <>
      {expandable ? (
        <button type="button" onClick={toggle} title="Klik untuk melihat waktu setiap cetak"
          className={`${chipClass} cursor-pointer hover:brightness-95 transition`}>
          {content}
        </button>
      ) : (
        <span className={chipClass}>{content}</span>
      )}
      {error && <span className="basis-full text-[11px] text-red-600">Gagal memuat waktu cetak. Coba klik lagi.</span>}
      {open && timeline && (
        <div className="basis-full mt-1 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm whitespace-normal">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Riwayat cetak struk {chip.name.toLowerCase()}
          </div>
          <ol className="space-y-1 text-[11px] text-gray-600">
            {timeline.untracked > 0 && (
              <li className="text-gray-400">
                Cetak ke-1{timeline.untracked > 1 ? `–${timeline.untracked}` : ''} · waktu tidak tercatat
              </li>
            )}
            {timeline.entries.map((e) => (
              <li key={e.nth} className="flex flex-wrap gap-x-2">
                <span className="w-14 font-semibold text-gray-900">Ke-{e.nth}</span>
                <span className="tabular-nums">{timeFormat.format(new Date(e.printedAt))}</span>
                {e.by && <span className="text-gray-400">· {e.by}</span>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  )
}
