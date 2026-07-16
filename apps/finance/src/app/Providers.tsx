'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, createSupabaseBrowserClient } from '@suka/auth'
import type { OutletStaffProfile } from '@suka/auth'
import { useFinanceRealtime } from '@/hooks/useFinanceRealtime'

function RealtimeMount() {
  useFinanceRealtime()
  return null
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
      <AuthProvider supabase={supabase} initialStaff={initialStaff}>
        <RealtimeMount />
        {children}
      </AuthProvider>
    </QueryClientProvider>
  )
}
