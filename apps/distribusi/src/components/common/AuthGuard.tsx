'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

/**
 * Floating account control. Rendered on every protected page so the user can
 * always see who is logged in and sign out — never stuck on a page without a
 * way out.
 */
function GlobalAccountBar() {
  const { outletStaff, signOut } = useAuth()
  const router = useRouter()

  const handleLogout = async () => {
    await signOut()
    router.replace('/login')
  }

  return (
    <div className="fixed bottom-4 left-4 z-[60] flex items-center gap-3 bg-white/95 backdrop-blur border border-suka-brown/10 shadow-lg rounded-full pl-4 pr-2 py-2">
      <div className="flex flex-col leading-tight">
        <span className="text-xs font-bold text-suka-brown">{outletStaff?.name || 'Staff'}</span>
        <span className="text-[10px] uppercase tracking-wide text-suka-brown/50">
          {outletStaff?.role || '—'}
        </span>
      </div>
      <button
        onClick={handleLogout}
        className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-full transition-colors"
      >
        Logout
      </button>
    </div>
  )
}

/**
 * Client-side auth guard. Redirects to /login when there is no session.
 * Renders children only once a session is loaded.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !session) {
      router.replace('/login')
    }
  }, [loading, session, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Memuat…</p>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <>
      {children}
      <GlobalAccountBar />
    </>
  )
}
