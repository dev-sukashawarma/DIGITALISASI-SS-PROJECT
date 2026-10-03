'use client'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@suka/auth'
import { LogOut } from 'lucide-react'

export default function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient()
    try {
      await Promise.race([
        supabase.auth.signOut({ scope: 'local' }),
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ])
    } catch {}
    
    if (typeof document !== 'undefined') {
      const domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined
      for (const raw of document.cookie.split(';')) {
        const name = raw.split('=')[0].trim()
        if (!name.startsWith('sb-')) continue
        document.cookie = `${name}=; Max-Age=0; path=/`
        if (domain) document.cookie = `${name}=; Max-Age=0; path=/; domain=${domain}`
      }
    }
    
    router.push('/')
  }

  return (
    <button
      onClick={handleLogout}
      title="Keluar dari Portal"
      aria-label="Keluar dari Portal"
      className="flex items-center justify-center gap-1.5 h-7 px-2.5 sm:h-auto sm:px-4 sm:py-2 border border-white/20 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-xs active:scale-95 shrink-0"
    >
      <LogOut size={13} className="sm:size-3.5" />
      <span className="hidden sm:inline">Keluar</span>
    </button>
  )
}
