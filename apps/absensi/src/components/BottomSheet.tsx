'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

/** Durasi animasi masuk/keluar; unmount menunggu animasi keluar selesai. */
const DURASI_MS = 280
/** Tarikan sejauh ini (px) atau sekencang ini (px/ms) ke bawah menutup sheet. */
const AMBANG_TUTUP_PX = 120
const AMBANG_KECEPATAN = 0.6

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Tombol aksi yang selalu terlihat di bawah (tidak ikut ter-scroll). */
  footer?: ReactNode
}

/**
 * Panel dari bawah ala ModalBottomSheet di app native: pegangan geser, judul di tengah,
 * tombol tutup bundar, isi ter-scroll, aksi menempel di bawah. Tutup lewat geser ke bawah,
 * ketuk latar, tombol X, atau Escape.
 */
export function BottomSheet({ open, onClose, title, children, footer }: BottomSheetProps) {
  const [terpasang, setTerpasang] = useState(open)
  const [masuk, setMasuk] = useState(false)
  const [geser, setGeser] = useState(0)
  const [menyeret, setMenyeret] = useState(false)
  const seret = useRef<{ y: number; t: number } | null>(null)
  const panel = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (open) {
      setTerpasang(true)
      // Dua frame: pastikan panel sudah tergambar di posisi bawah sebelum transisi naik.
      let dalam = 0
      const luar = requestAnimationFrame(() => {
        dalam = requestAnimationFrame(() => setMasuk(true))
      })
      return () => {
        cancelAnimationFrame(luar)
        cancelAnimationFrame(dalam)
      }
    }
    setMasuk(false)
    setGeser(0)
    const t = setTimeout(() => setTerpasang(false), DURASI_MS)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!terpasang) return
    const overflowLama = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    panel.current?.focus({ preventScroll: true })
    return () => {
      document.body.style.overflow = overflowLama
      document.removeEventListener('keydown', onKey)
    }
  }, [terpasang])

  if (!terpasang || typeof document === 'undefined') return null

  const mulaiSeret = (e: React.PointerEvent) => {
    seret.current = { y: e.clientY, t: performance.now() }
    setMenyeret(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const saatSeret = (e: React.PointerEvent) => {
    if (!seret.current) return
    setGeser(Math.max(0, e.clientY - seret.current.y))
  }
  const akhiriSeret = (e: React.PointerEvent) => {
    if (!seret.current) return
    const jarak = Math.max(0, e.clientY - seret.current.y)
    const kecepatan = jarak / Math.max(1, performance.now() - seret.current.t)
    seret.current = null
    setMenyeret(false)
    if (jarak > AMBANG_TUTUP_PX || kecepatan > AMBANG_KECEPATAN) onCloseRef.current()
    else setGeser(0)
  }

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-end justify-center" role="presentation">
      <div
        aria-hidden="true"
        onClick={() => onCloseRef.current()}
        className={`absolute inset-0 bg-black/50 transition-opacity motion-reduce:transition-none ${
          masuk ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ transitionDuration: `${DURASI_MS}ms` }}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative w-full sm:max-w-xl max-h-[92dvh] flex flex-col bg-white rounded-t-[28px] shadow-2xl outline-none motion-reduce:transition-none"
        style={{
          transform: masuk ? `translateY(${geser}px)` : 'translateY(100%)',
          transition: menyeret ? 'none' : `transform ${DURASI_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`,
        }}
      >
        {/* Pegangan + judul = area geser. touch-none agar tarikan tidak men-scroll halaman. */}
        <div
          className="shrink-0 touch-none select-none cursor-grab active:cursor-grabbing"
          onPointerDown={mulaiSeret}
          onPointerMove={saatSeret}
          onPointerUp={akhiriSeret}
          onPointerCancel={akhiriSeret}
        >
          <div className="flex justify-center pt-3 pb-1" aria-hidden="true">
            <span className="h-1.5 w-10 rounded-full bg-slate-300" />
          </div>
          <div className="relative flex items-center justify-center px-14 py-3">
            <h2 className="text-lg font-bold text-slate-900 truncate">{title}</h2>
            <button
              type="button"
              aria-label="Tutup"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onCloseRef.current()}
              className="absolute right-4 w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-6 pb-4">{children}</div>

        {footer && (
          <div className="shrink-0 border-t border-slate-100 px-5 sm:px-6 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
