'use client'

import { useEffect, useState } from 'react'
import { Sparkles, Info, AlertTriangle, X } from 'lucide-react'

type Kind = 'motivasi' | 'info' | 'peringatan'

interface Message {
  id: string
  kind: Kind
  title: string | null
  body: string
  created_at: string
  expires_at: string | null
}

const STYLE: Record<Kind, { icon: typeof Info; color: string; soft: string; label: string }> = {
  motivasi:   { icon: Sparkles,      color: '#f29744', soft: '#fff3e6', label: 'Motivasi' },
  info:       { icon: Info,          color: '#0a7d2c', soft: '#eafaef', label: 'Informasi' },
  peringatan: { icon: AlertTriangle, color: '#dc2626', soft: '#fdeaea', label: 'Peringatan' },
}

export default function OwnerMessageBanner() {
  const [banners, setBanners] = useState<Message[]>([])

  const loadBanners = () => {
    try {
      const stored = localStorage.getItem('kasir_active_banners')
      if (stored) {
        let parsed: Message[] = JSON.parse(stored)
        // Filter out expired banners locally
        const now = new Date().getTime()
        let changed = false
        parsed = parsed.filter(m => {
          if (m.expires_at) {
            const exp = new Date(m.expires_at).getTime()
            if (now > exp) {
              changed = true
              return false
            }
          }
          return true
        })
        if (changed) {
          localStorage.setItem('kasir_active_banners', JSON.stringify(parsed))
        }
        setBanners(parsed)
      } else {
        setBanners([])
      }
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadBanners()

    const handleUpdate = () => loadBanners()
    window.addEventListener('kasir_banners_updated', handleUpdate)
    
    // Interval to check expiration
    const interval = setInterval(loadBanners, 60000)

    return () => {
      window.removeEventListener('kasir_banners_updated', handleUpdate)
      clearInterval(interval)
    }
  }, [])

  const dismissForever = (id: string) => {
    const existing = JSON.parse(localStorage.getItem('kasir_active_banners') || '[]')
    const filtered = existing.filter((b: any) => b.id !== id)
    localStorage.setItem('kasir_active_banners', JSON.stringify(filtered))
    setBanners(filtered)
  }

  if (banners.length === 0) return null

  return (
    <div className="flex flex-col gap-2 w-full px-4 pt-4 pb-0 print:hidden">
      {banners.map((m) => {
        const meta = STYLE[m.kind] ?? STYLE.motivasi
        const Icon = meta.icon

        return (
          <div 
            key={m.id} 
            className="w-full rounded-xl flex items-start sm:items-center gap-3 px-4 py-3 shadow-sm border animate-fade-in"
            style={{ backgroundColor: meta.soft, borderColor: `${meta.color}30` }}
          >
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'white', color: meta.color }}
            >
              <Icon className="w-4 h-4" />
            </div>
            
            <div className="flex-1 min-w-0">
              {m.title && <h4 className="text-sm font-extrabold text-[#1e1b15] leading-tight mb-0.5">{m.title}</h4>}
              <p className="text-xs font-semibold text-[#3a322b] truncate pr-4">{m.body}</p>
            </div>

            <button 
              onClick={() => dismissForever(m.id)}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 text-[#877365] transition-colors"
              title="Tutup selamanya"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
