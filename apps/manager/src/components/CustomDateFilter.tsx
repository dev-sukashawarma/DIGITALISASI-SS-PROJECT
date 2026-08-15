'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Calendar, X } from 'lucide-react'

const getTodayJakarta = () => {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}

export function CustomDateFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const period = searchParams.get('period') || 'today'
  const isCustom = period === 'custom'
  
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  
  const [localFrom, setLocalFrom] = useState(searchParams.get('from') || '')
  const [localTo, setLocalTo] = useState(searchParams.get('to') || '')

  useEffect(() => {
    if (open) {
      const today = getTodayJakarta()
      setLocalFrom(searchParams.get('from') || today)
      setLocalTo(searchParams.get('to') || today)
    }
  }, [open, searchParams])

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const handleApply = () => {
    if (localFrom && localTo) {
      const params = new URLSearchParams(searchParams.toString())
      params.set('period', 'custom')
      params.set('from', localFrom)
      params.set('to', localTo)
      router.push(`?${params.toString()}`)
      setOpen(false)
    }
  }

  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')

  return (
    <div ref={rootRef} className="relative flex items-center">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title="Pilih Rentang Tanggal Kustom"
        className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
          isCustom || open
            ? 'bg-suka-orange text-white shadow-xs'
            : 'text-suka-brown/70 hover:text-suka-brown hover:bg-white/50'
        }`}
      >
        <Calendar className="w-3.5 h-3.5" />
        <span>
          {isCustom && fromParam && toParam
            ? `${fromParam} - ${toParam}`
            : 'Kustom'}
        </span>
      </button>

      {open && (
        <>
          {/* Backdrop for mobile */}
          <div 
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] md:hidden" 
            onClick={() => setOpen(false)} 
          />
          
          <div className="fixed md:absolute top-1/2 md:top-full left-1/2 md:left-auto md:right-0 -translate-x-1/2 md:translate-x-0 -translate-y-1/2 md:translate-y-0 mt-0 md:mt-2 p-5 w-[calc(100vw-2rem)] max-w-[320px] bg-white border border-suka-brown/10 rounded-2xl shadow-[0_10px_40px_rgba(44,24,16,0.15)] z-50">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-black text-suka-brown uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-suka-orange" />
                Pilih Rentang Tanggal
              </h4>
              <button 
                type="button" 
                onClick={() => setOpen(false)} 
                className="p-1 text-suka-gray-400 hover:text-suka-brown rounded-lg hover:bg-suka-brown/5 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-extrabold text-suka-gray-400 uppercase tracking-wider mb-1">Dari Tanggal</label>
                <input 
                  type="date" 
                  value={localFrom} 
                  onChange={(e) => setLocalFrom(e.target.value)} 
                  className="w-full px-3 py-2 border border-suka-brown/15 focus:border-suka-orange focus:ring-1 focus:ring-suka-orange rounded-xl text-xs outline-none font-bold text-suka-brown bg-suka-brown/[0.02]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-suka-gray-400 uppercase tracking-wider mb-1">Sampai Tanggal</label>
                <input 
                  type="date" 
                  value={localTo} 
                  onChange={(e) => setLocalTo(e.target.value)} 
                  min={localFrom}
                  className="w-full px-3 py-2 border border-suka-brown/15 focus:border-suka-orange focus:ring-1 focus:ring-suka-orange rounded-xl text-xs outline-none font-bold text-suka-brown bg-suka-brown/[0.02]"
                />
              </div>
              <div className="pt-2 flex gap-2">
                <button 
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 px-3 py-2 border border-suka-brown/10 hover:bg-suka-brown/5 text-suka-brown font-extrabold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button 
                  type="button" 
                  onClick={handleApply}
                  disabled={!localFrom || !localTo || localTo < localFrom}
                  className="flex-1 bg-suka-orange hover:bg-orange-600 disabled:bg-suka-gray-200 disabled:text-suka-gray-400 text-white font-extrabold py-2 rounded-xl text-xs transition-colors shadow-xs cursor-pointer disabled:cursor-not-allowed"
                >
                  Terapkan
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
