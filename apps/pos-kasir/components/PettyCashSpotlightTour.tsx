'use client'

import { useState, useEffect, useCallback, useId } from 'react'
import { ArrowDownToLine, Sparkles, X, CheckCircle2 } from 'lucide-react'

interface PettyCashSpotlightTourProps {
  targetSelector?: string
  amount?: number
  description?: string
  onClose?: () => void
}

export default function PettyCashSpotlightTour({
  targetSelector = '[data-tour="terima-dana-btn"]',
  amount,
  description,
  onClose,
}: PettyCashSpotlightTourProps) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [isVisible, setIsVisible] = useState(true)
  const maskId = useId()

  const findAndMeasureTarget = useCallback(() => {
    const el = document.querySelector(targetSelector)
    if (el) {
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setTargetRect(rect)
        return true
      }
    }
    return false
  }, [targetSelector])

  useEffect(() => {
    // 1. Immediate check
    const found = findAndMeasureTarget()
    if (found) {
      const el = document.querySelector(targetSelector)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }

    // 2. Poll continuously every 150ms to ensure element capture
    const interval = setInterval(() => {
      findAndMeasureTarget()
    }, 150)

    // 3. Re-calculate on window resize and scroll
    const handleReposition = () => {
      findAndMeasureTarget()
    }

    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)

    return () => {
      clearInterval(interval)
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('scroll', handleReposition, true)
    }
  }, [targetSelector, findAndMeasureTarget])

  function handleDismiss() {
    setIsVisible(false)
    if (onClose) onClose()
  }

  if (!isVisible) return null

  const padding = 8
  const top = targetRect ? targetRect.top - padding : 0
  const left = targetRect ? targetRect.left - padding : 0
  const width = targetRect ? targetRect.width + padding * 2 : 0
  const height = targetRect ? targetRect.height + padding * 2 : 0

  // Intelligent positioning so tooltip NEVER overlaps target button
  const cardWidth = 320
  const cardHeight = 180
  const winWidth = typeof window !== 'undefined' ? window.innerWidth : 1200
  const winHeight = typeof window !== 'undefined' ? window.innerHeight : 800

  let cardTop = winHeight / 2 - cardHeight / 2
  let cardLeft = winWidth / 2 - cardWidth / 2
  let positionMode: 'left' | 'above' | 'below' | 'center' = 'center'

  if (targetRect) {
    // Check if we can place to the left of the button
    if (targetRect.left - cardWidth - 24 > 16) {
      positionMode = 'left'
      cardLeft = targetRect.left - cardWidth - 24
      cardTop = Math.max(
        16,
        Math.min(winHeight - cardHeight - 16, targetRect.top + targetRect.height / 2 - cardHeight / 2)
      )
    } else if (targetRect.top - cardHeight - 20 > 16) {
      // Place above target
      positionMode = 'above'
      cardTop = targetRect.top - cardHeight - 20
      cardLeft = Math.max(16, Math.min(winWidth - cardWidth - 16, targetRect.left + targetRect.width / 2 - cardWidth / 2))
    } else {
      // Place below target
      positionMode = 'below'
      cardTop = targetRect.bottom + 20
      cardLeft = Math.max(16, Math.min(winWidth - cardWidth - 16, targetRect.left + targetRect.width / 2 - cardWidth / 2))
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-auto overflow-hidden animate-fade-in">
      {/* Dynamic SVG Mask for Backdrop Hole Cutout */}
      {targetRect ? (
        <svg
          key={`mask-${top}-${left}-${width}-${height}`}
          className="fixed inset-0 w-full h-full pointer-events-none"
        >
          <defs>
            <mask id={maskId} x="0" y="0" width="100%" height="100%">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <rect
                x={left}
                y={top}
                width={width}
                height={height}
                rx="12"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(15, 23, 42, 0.7)"
            mask={`url(#${maskId})`}
          />
        </svg>
      ) : (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm pointer-events-none" />
      )}

      {/* Pulsing Glowing Ring & High-Vis Pointer around button */}
      {targetRect && (
        <>
          <div
            style={{
              position: 'fixed',
              top: `${top}px`,
              left: `${left}px`,
              width: `${width}px`,
              height: `${height}px`,
            }}
            className="rounded-xl border-2 border-blue-400 ring-4 ring-blue-500/40 animate-pulse pointer-events-none shadow-[0_0_30px_rgba(59,130,246,0.9)] z-[10000]"
          />

          {/* Glowing Pointer Tag pointing directly at button */}
          <div
            style={{
              position: 'fixed',
              top: `${targetRect.top + targetRect.height / 2 - 14}px`,
              left: `${targetRect.left - 125}px`,
            }}
            className="z-[10001] pointer-events-none animate-pulse flex items-center gap-1.5 bg-blue-600 text-white text-[11px] font-black px-3 py-1.5 rounded-full shadow-lg border border-blue-400 tracking-wide uppercase"
          >
            <span>TERIMA DANA</span>
            <span className="text-amber-300 text-sm">👉</span>
          </div>
        </>
      )}

      {/* Clean UI Interactive Guidance Card (Positioned neatly without overlapping target) */}
      <div
        className="fixed transition-all duration-300 z-[10002]"
        style={{
          top: `${cardTop}px`,
          left: `${cardLeft}px`,
        }}
      >
        <div className="w-[320px] max-w-[calc(100vw-32px)] bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 relative text-gray-900 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-start justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-1.5 text-blue-600 font-bold text-[11px] uppercase tracking-wider bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              <span>Petunjuk Kasir</span>
            </div>
            <button
              onClick={handleDismiss}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-lg transition-colors"
              title="Tutup Petunjuk"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <h4 className="font-bold text-sm text-gray-900 mb-1.5 flex items-center gap-2">
            <ArrowDownToLine className="w-4 h-4 text-blue-600 shrink-0" />
            Konfirmasi Uang Masuk
          </h4>

          <p className="text-xs text-gray-600 leading-relaxed mb-4">
            Silakan tekan tombol biru <b>"Terima Dana"</b> yang ditunjuk di sebelah kanan setelah Anda menerima fisik uang{' '}
            {amount ? (
              <span className="font-bold text-gray-900">
                Rp {amount.toLocaleString('id-ID')}
              </span>
            ) : (
              'top-up'
            )}{' '}
            secara nyata.
          </p>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              onClick={handleDismiss}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Saya Mengerti
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
