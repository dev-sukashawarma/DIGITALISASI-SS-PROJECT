'use client'

import type { ReactNode } from 'react'
import { Ban, LogOut, ClipboardCheck, Moon, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export type BlockType = 'user' | 'outlet' | 'attendance' | 'checklist' | 'closed'

export type ChecklistProgress = { total: number; done: number }

export default function BlockedOverlay({
  reason,
  type,
  progress,
}: {
  reason: string
  type: BlockType
  progress?: ChecklistProgress
}) {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const TITLE: Record<BlockType, string> = {
    attendance: 'Menunggu Kehadiran Kru',
    checklist: 'Checklist Buka Toko Belum Selesai',
    closed: 'Toko Sudah Tutup',
    user: 'Akun Dinonaktifkan',
    outlet: 'Cabang Dinonaktifkan',
  }

  const MESSAGE: Record<BlockType, string> = {
    attendance: 'Sistem POS akan otomatis terbuka ketika ada minimal 1 kru yang melakukan absen hadir hari ini.',
    checklist: 'Dashboard kasir akan otomatis terbuka setelah seluruh tugas checklist buka toko diselesaikan oleh kru.',
    closed: 'Semua kru sudah absen pulang. Sampai jumpa besok!',
    user: 'Akun Anda saat ini sedang dinonaktifkan oleh Administrator.',
    outlet: 'Cabang tempat Anda bertugas saat ini sedang dinonaktifkan oleh Administrator.',
  }

  const ICON: Record<BlockType, ReactNode> = {
    attendance: <Clock className="w-10 h-10 text-amber-600" />,
    checklist: <ClipboardCheck className="w-10 h-10 text-amber-600" />,
    closed: <Moon className="w-10 h-10 text-indigo-600" />,
    user: <Ban className="w-10 h-10 text-red-600" />,
    outlet: <Ban className="w-10 h-10 text-red-600" />,
  }

  const ICON_BG: Record<BlockType, string> = {
    attendance: 'bg-amber-100',
    checklist: 'bg-amber-100',
    closed: 'bg-indigo-100',
    user: 'bg-red-100',
    outlet: 'bg-red-100',
  }

  const showReasonBox = type === 'user' || type === 'outlet'
  const showProgress = type === 'checklist' && progress && progress.total > 0
  const progressPct = showProgress ? Math.round((progress!.done / progress!.total) * 100) : 0

  const PULSE_LABEL: Record<string, string> = {
    attendance: 'Menunggu Sinyal Absensi...',
    checklist: 'Menunggu Checklist Diselesaikan...',
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-gray-900/95 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-fade-in text-center">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl flex flex-col items-center animate-fade-up">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${ICON_BG[type]}`}>
          {ICON[type]}
        </div>
        <h1 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">
          {TITLE[type]}
        </h1>
        <p className="text-gray-500 font-medium mb-6">
          {MESSAGE[type]}
        </p>

        {showProgress && (
          <div className="w-full mb-6">
            <div className="flex items-center justify-between text-sm font-bold text-gray-700 mb-2">
              <span>Progress Checklist Buka Toko</span>
              <span>{progress!.done}/{progress!.total} tugas</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-amber-500 transition-all duration-700 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {showReasonBox ? (
          <div className="bg-red-50 text-red-900 text-sm font-bold p-4 rounded-xl w-full mb-8 border border-red-100 text-left">
            <span className="block text-red-400 text-xs font-semibold uppercase tracking-wider mb-1">Alasan Penonaktifan:</span>
            "{reason}"
          </div>
        ) : (type === 'attendance' || type === 'checklist') ? (
          <div className="w-full flex items-center justify-center p-4 bg-amber-50 rounded-xl mb-8 border border-amber-100">
             <div className="animate-pulse flex items-center gap-2 text-amber-700 font-medium">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                </span>
                {PULSE_LABEL[type]}
             </div>
          </div>
        ) : (
          <div className="w-full mb-8" />
        )}

        {showReasonBox ? (
          <button
            onClick={handleLogout}
            className="w-full bg-gray-900 text-white rounded-xl py-3.5 font-bold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-5 h-5" />
            Keluar / Logout
          </button>
        ) : null}
      </div>
    </div>
  )
}
