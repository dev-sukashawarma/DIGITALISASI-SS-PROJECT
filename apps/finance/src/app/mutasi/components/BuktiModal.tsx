'use client'

import { useEffect } from 'react'
import { X, ExternalLink } from 'lucide-react'

/** Pratinjau bukti transaksi di dalam halaman (gambar atau PDF). */
export function BuktiModal({ url, judul, onClose }: { url: string; judul?: string; onClose: () => void }) {
  const pdf = /\.pdf(\?|$)/i.test(url)

  useEffect(() => {
    const tutup = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', tutup)
    return () => window.removeEventListener('keydown', tutup)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-suka-gray-100 px-4 py-3">
          <p className="truncate text-sm font-bold text-suka-ink">{judul || 'Bukti transaksi'}</p>
          <div className="flex shrink-0 items-center gap-1">
            <a href={url} target="_blank" rel="noreferrer" title="Buka di tab baru"
              className="rounded-lg p-1.5 text-suka-gray-400 hover:bg-suka-gray-100 hover:text-suka-ink">
              <ExternalLink size={18} />
            </a>
            <button onClick={onClose} aria-label="Tutup" className="rounded-lg p-1.5 text-suka-gray-400 hover:bg-suka-gray-100 hover:text-suka-ink">
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center overflow-auto bg-suka-gray-50 p-3">
          {pdf ? (
            <iframe src={url} title={judul || 'Bukti'} className="h-[75vh] w-full rounded-lg bg-white" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={judul || 'Bukti'} className="max-h-[78vh] w-auto rounded-lg object-contain" />
          )}
        </div>
      </div>
    </div>
  )
}
