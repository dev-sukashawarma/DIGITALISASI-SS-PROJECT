'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { MessageCircle } from 'lucide-react'
import { useRole } from '@/components/layout/RoleContext'

// Panel dimuat saat dibuka saja (tak menambah bundel halaman awal).
const PanelBotHrd = dynamic(() => import('./PanelBotHrd').then((m) => m.PanelBotHrd), { ssr: false })

const ROLE_BOT = new Set(['ADMIN_HR', 'OWNER', 'ADMIN', 'DEVELOPER'])

export function BotHrdWidget() {
  const { role } = useRole()
  const [buka, setBuka] = useState(false)
  if (!role || !ROLE_BOT.has(role)) return null
  return (
    <>
      {buka && (
        <div className="fixed inset-0 z-50 sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[600px] sm:max-h-[calc(100dvh-8rem)] sm:w-[400px]">
          <PanelBotHrd onTutup={() => setBuka(false)} />
        </div>
      )}
      {!buka && (
        <button
          type="button"
          onClick={() => setBuka(true)}
          className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-suka-orange text-white shadow-lg transition hover:scale-105 lg:bottom-6 lg:right-6"
          aria-label="Buka Bot HRD"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}
    </>
  )
}
