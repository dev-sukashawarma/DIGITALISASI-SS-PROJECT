'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Calendar } from 'lucide-react'

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
      setLocalFrom(searchParams.get('from') || '')
      setLocalTo(searchParams.get('to') || '')
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

  return (
    <div ref={rootRef} className="relative flex">
      <button
        onClick={() => setOpen(!open)}
        className={`px-4 py-1.5 text-sm font-bold rounded-md flex items-center justify-center gap-1.5 transition-colors ${
          isCustom || open ? 'bg-suka-orange text-white' : 'text-suka-gray-500 hover:bg-suka-gray-50'
        }`}
      >
        <Calendar className="w-4 h-4" />
        <span className="hidden sm:inline">Kustom</span>
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 p-4 w-[280px] bg-white border border-suka-brown/10 rounded-xl shadow-xl z-[100]">
          <h4 className="text-sm font-bold text-suka-brown mb-3">Pilih Rentang Tanggal</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-suka-gray-400 uppercase mb-1">Dari Tanggal</label>
              <input 
                type="date" 
                value={localFrom} 
                onChange={(e) => setLocalFrom(e.target.value)} 
                className="w-full px-3 py-2 border border-suka-brown/10 focus:border-suka-orange rounded-lg text-xs outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-suka-gray-400 uppercase mb-1">Sampai Tanggal</label>
              <input 
                type="date" 
                value={localTo} 
                onChange={(e) => setLocalTo(e.target.value)} 
                min={localFrom}
                className="w-full px-3 py-2 border border-suka-brown/10 focus:border-suka-orange rounded-lg text-xs outline-none"
              />
            </div>
            <button 
              onClick={handleApply}
              disabled={!localFrom || !localTo || localTo < localFrom}
              className="w-full mt-2 bg-suka-orange hover:bg-orange-600 disabled:bg-suka-gray-200 disabled:text-suka-gray-400 text-white font-bold py-2 rounded-lg text-xs transition-colors"
            >
              Terapkan
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
