'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Loader2, Printer } from 'lucide-react'
import { getReceiptPrintLog } from '@/app/actions/posReport'
import {
  receiptPrintTimeline,
  type ReceiptPrintLogRow,
  type ReceiptReprintLabel,
} from '@/lib/posReport/receiptReprint'

const timeFormat = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

/** Label "Struk ... dicetak Nx"; diklik untuk melihat kapan & oleh siapa tiap cetak.
 *  Log diambil sekali saat pertama dibuka, bukan ikut dimuat bersama laporan. */
export default function ReceiptReprintBadge({ orderId, label }: { orderId: string; label: ReceiptReprintLabel }) {
  const [open, setOpen] = useState(false)
  const [logs, setLogs] = useState<ReceiptPrintLogRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = async () => {
    const next = !open
    setOpen(next)
    if (!next || logs || loading) return
    setLoading(true)
    setError(null)
    try {
      setLogs((await getReceiptPrintLog(orderId)) as ReceiptPrintLogRow[])
    } catch {
      setError('Gagal memuat waktu cetak. Coba klik lagi.')
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  const timeline = logs ? receiptPrintTimeline(logs, label.kind, label.count) : null

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        className="inline-flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer transition-colors"
        title="Klik untuk melihat waktu setiap cetak"
      >
        <Printer className="w-3 h-3" />
        {label.text}
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {error && <span className="basis-full text-[10px] font-semibold text-red-600">{error}</span>}
      {open && timeline && (
        <div className="basis-full mt-1 rounded-lg border border-rose-100 bg-rose-50/40 px-2.5 py-2 text-[11px] font-medium text-gray-700 whitespace-normal">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-rose-700">
            Waktu cetak struk {label.kind === 'customer' ? 'customer' : 'dapur'}
          </div>
          <ol className="space-y-0.5">
            {timeline.untracked > 0 && (
              <li className="text-gray-400 italic">
                Cetak ke-1{timeline.untracked > 1 ? `–${timeline.untracked}` : ''}: waktu tidak tercatat (sebelum pencatatan aktif)
              </li>
            )}
            {timeline.entries.map((e) => (
              <li key={e.nth}>
                <span className="font-bold text-gray-900">Cetak ke-{e.nth}</span>
                {' · '}
                {timeFormat.format(new Date(e.printedAt))}
                {e.by ? ` · ${e.by}` : ''}
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  )
}
