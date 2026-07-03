'use client'

import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@suka/auth'
import { Sparkles, Info, AlertTriangle } from 'lucide-react'
import { useRole } from '@/components/layout/RoleContext'

type Kind = 'motivasi' | 'info' | 'peringatan'

interface Message {
  id: string
  kind: Kind
  title: string | null
  body: string
  created_at: string
  expires_at: string | null
  target_type: string
  outlet_ids: string[]
}

const STYLE: Record<Kind, { icon: typeof Info; color: string; soft: string; label: string }> = {
  motivasi:   { icon: Sparkles,      color: '#f29744', soft: '#fff3e6', label: 'Motivasi' },
  info:       { icon: Info,          color: '#0a7d2c', soft: '#eafaef', label: 'Informasi' },
  peringatan: { icon: AlertTriangle, color: '#dc2626', soft: '#fdeaea', label: 'Peringatan' },
}

export default function OwnerMessageBanner() {
  const { role, outletId } = useRole()
  const [banners, setBanners] = useState<Message[]>([])
  const supabase = createSupabaseBrowserClient()

  useEffect(() => {
    // Sembunyikan untuk OWNER karena ini pesan dari mereka
    if (role === 'OWNER') {
      setBanners([])
      return
    }

    const fetchMessages = async () => {
      try {
        const now = new Date().toISOString()
        const { data } = await supabase
          .from('owner_messages')
          .select('*')
          .eq('is_active', true)
          .or(`expires_at.is.null,expires_at.gt.${now}`)
          .order('created_at', { ascending: false })
        
        if (data) {
          // Filter if needed (for example, specific outlets if the profile has an outlet_id)
          const filtered = (data as Message[]).filter(m => {
            if (m.target_type === 'all') return true
            if (m.target_type === 'specific' && outletId && m.outlet_ids?.includes(outletId)) return true
            return false
          })
          setBanners(filtered)
        } else {
          setBanners([])
        }
      } catch (e) {
        console.error('Error fetching owner messages:', e)
      }
    }

    if (role) {
      fetchMessages()
    }

    const channel = supabase
      .channel('admin-owner-messages-banner')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'owner_messages' }, () => {
        fetchMessages()
      })
      .subscribe()

    // Interval to refresh if there's expiration logic (e.g. 1 minute)
    const interval = setInterval(fetchMessages, 60000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [role, outletId, supabase])

  if (banners.length === 0) return null

  return (
    <div className="flex flex-col gap-2 w-full px-4 pt-4 pb-0 print:hidden z-50 shrink-0">
      {banners.map((m) => {
        const meta = STYLE[m.kind] ?? STYLE.motivasi
        const Icon = meta.icon

        return (
          <div 
            key={m.id} 
            className="w-full rounded-xl flex items-start sm:items-center gap-3 px-4 py-3 shadow-sm border animate-fade-in relative overflow-hidden"
            style={{ backgroundColor: meta.soft, borderColor: `${meta.color}30` }}
          >
            <div className="absolute top-0 left-0 bottom-0 w-1" style={{ backgroundColor: meta.color }} />
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'white', color: meta.color }}
            >
              <Icon className="w-4 h-4" />
            </div>
            
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-extrabold text-[#1e1b15] leading-tight mb-0.5">
                Info Pesan dari Owner {m.title ? `- ${m.title}` : ''}
              </h4>
              <p className="text-xs font-semibold text-[#3a322b] pr-4">{m.body}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
