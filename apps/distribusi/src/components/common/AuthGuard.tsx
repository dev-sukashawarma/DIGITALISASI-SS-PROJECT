'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@suka/auth'

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

  return <>{children}</>
}
