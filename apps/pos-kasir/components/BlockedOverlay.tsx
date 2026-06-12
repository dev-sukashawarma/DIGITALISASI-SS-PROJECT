'use client'

import { Ban, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function BlockedOverlay({ reason, type }: { reason: string, type: 'user' | 'outlet' }) {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-gray-900/95 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-fade-in text-center">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl flex flex-col items-center animate-fade-up">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
          <Ban className="w-10 h-10 text-red-600" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">
          {type === 'user' ? 'Akun Dinonaktifkan' : 'Cabang Dinonaktifkan'}
        </h1>
        <p className="text-gray-500 font-medium mb-6">
          {type === 'user' 
            ? 'Akun Anda saat ini sedang dinonaktifkan oleh Administrator.' 
            : 'Cabang tempat Anda bertugas saat ini sedang dinonaktifkan oleh Administrator.'}
        </p>
        
        <div className="bg-red-50 text-red-900 text-sm font-bold p-4 rounded-xl w-full mb-8 border border-red-100 text-left">
          <span className="block text-red-400 text-xs font-semibold uppercase tracking-wider mb-1">Alasan Penonaktifan:</span>
          "{reason}"
        </div>

        <button 
          onClick={handleLogout}
          className="w-full bg-gray-900 text-white rounded-xl py-3.5 font-bold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
        >
          <LogOut className="w-5 h-5" />
          Keluar / Logout
        </button>
      </div>
    </div>
  )
}
