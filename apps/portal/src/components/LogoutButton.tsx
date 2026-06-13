'use client'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@suka/auth'

export default function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700
                 hover:border-gray-400 hover:bg-gray-50"
    >
      Keluar
    </button>
  )
}
