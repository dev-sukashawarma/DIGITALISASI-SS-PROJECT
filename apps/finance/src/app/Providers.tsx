'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, createSupabaseBrowserClient, useAuth } from '@suka/auth'
import type { OutletStaffProfile } from '@suka/auth'
import { useFinanceRealtime } from '@/hooks/useFinanceRealtime'

function ActiveRealtimeSubscription() {
  useFinanceRealtime()
  return null
}

function RealtimeMount() {
  const pathname = usePathname()
  const { session, loading } = useAuth()
  if (loading || !session || pathname?.startsWith('/auth/sso')) {
    return null
  }
  return <ActiveRealtimeSubscription />
}

export function Providers({
  children,
  initialStaff = null,
}: {
  children: React.ReactNode
  initialStaff?: OutletStaffProfile | null
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  )
  const [supabase] = useState(() => createSupabaseBrowserClient())

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider
        supabase={supabase}
        initialStaff={initialStaff}
        sessionSyncUrl="/api/auth/sso"
      >
        <RealtimeMount />
        {children}
      </AuthProvider>
    </QueryClientProvider>
  )
}
