'use client'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@suka/auth'
import { Button } from '@suka/design-system'
import { LogOut } from 'lucide-react'

export default function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleLogout}
      className="flex items-center gap-1.5 active:scale-[0.98]"
    >
      <LogOut size={14} />
      <span>Keluar</span>
    </Button>
  )
}
