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
      className="flex items-center gap-2 px-3 py-2 sm:px-4 border border-white/20 hover:bg-white/10 active:bg-white/20 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-sm shadow-black/5 active:scale-95"
    >
      <LogOut size={14} />
      <span className="hidden sm:inline">Keluar</span>
    </button>
  )
}
