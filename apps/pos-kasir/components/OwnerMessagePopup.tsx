'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useMyOutlet } from '@/lib/useMyOutlet'
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
  motivasi:   { icon: Sparkles,      color: '#f29744', soft: '#fff3e6', label: 'Pesan Motivasi' },
  info:       { icon: Info,          color: '#0a7d2c', soft: '#eafaef', label: 'Informasi' },
  peringatan: { icon: AlertTriangle, color: '#dc2626', soft: '#fdeaea', label: 'Peringatan' },
}

/**
 * Popup pesan dari owner. Ambil pesan aktif yang belum dibaca, tampilkan satu
 * per satu sebagai modal di tengah layar. Kasir wajib klik "OK" → ditandai
 * sudah dibaca (tidak muncul lagi). Realtime: pesan baru langsung muncul.
 */
export default function OwnerMessagePopup() {
  const { outletId, loaded } = useMyOutlet()
  const [queue, setQueue] = useState<Message[]>([])
  const seenRef = useRef<Set<string>>(new Set())

  const fetchMessages = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.rpc('get_my_active_messages')
    if (!Array.isArray(data)) return
    setQueue((prev) => {
      const existing = new Set(prev.map((m) => m.id))
      const additions = (data as Message[]).filter((m) => !existing.has(m.id) && !seenRef.current.has(m.id))
      return additions.length ? [...prev, ...additions] : prev
    })
  }, [])

  useEffect(() => {
    if (!loaded || !outletId) return
    fetchMessages()

    const supabase = createClient()
    const channel = supabase
      .channel('kasir-owner-messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'owner_messages' }, (payload) => {
        if (payload.eventType === 'UPDATE' && payload.new && payload.new.is_active === false) {
           try {
             const existing = JSON.parse(localStorage.getItem('kasir_active_banners') || '[]')
             const filtered = existing.filter((b: any) => b.id !== payload.new.id)
             localStorage.setItem('kasir_active_banners', JSON.stringify(filtered))
             window.dispatchEvent(new Event('kasir_banners_updated'))
           } catch (e) {}
        }
        fetchMessages()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loaded, outletId, fetchMessages])

  const current = queue[0]

  const dismiss = async () => {
    if (!current) return
    seenRef.current.add(current.id)
    
    try {
      const existing = JSON.parse(localStorage.getItem('kasir_active_banners') || '[]')
      const newBanners = [...existing.filter((b: any) => b.id !== current.id), current]
      localStorage.setItem('kasir_active_banners', JSON.stringify(newBanners))
      window.dispatchEvent(new Event('kasir_banners_updated'))
    } catch (e) {}

    const supabase = createClient()
    await supabase.rpc('mark_message_read', { p_message_id: current.id })
    setQueue((prev) => prev.slice(1))
  }

  if (!current) return null

  const meta = STYLE[current.kind] ?? STYLE.motivasi
  const Icon = meta.icon

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 print:hidden">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" />

      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-fade-in">
        {/* Header bar warna sesuai jenis */}
        <div className="px-6 py-5 text-center" style={{ backgroundColor: meta.soft }}>
          <div
            className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-2 shadow-sm"
            style={{ backgroundColor: '#fff' }}
          >
            <Icon className="w-8 h-8" style={{ color: meta.color }} />
          </div>
          <p className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: meta.color }}>
            {meta.label}
          </p>
          {current.title && (
            <h3 className="text-lg font-extrabold text-[#1e1b15] mt-1 leading-tight">{current.title}</h3>
          )}
        </div>

        {/* Isi */}
        <div className="px-6 py-6">
          <p className="text-center text-[15px] font-medium text-[#3a322b] leading-relaxed whitespace-pre-wrap">
            {current.body}
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <button
            onClick={dismiss}
            className="w-full py-3.5 rounded-2xl text-white font-extrabold text-sm transition-all active:scale-95 shadow-sm flex items-center justify-center gap-2"
            style={{ backgroundColor: meta.color }}
          >
            <X className="w-4 h-4" />
            Mengerti, Tutup
          </button>
          {queue.length > 1 && (
            <p className="text-center text-[11px] font-bold text-[#a98b73] mt-2">
              +{queue.length - 1} pesan lagi setelah ini
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
