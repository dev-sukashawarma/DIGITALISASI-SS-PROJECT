'use client'

import { ReactNode, useMemo } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, createSupabaseBrowserClient } from '@suka/auth'
import type { OutletStaffProfile } from '@suka/auth'
import { GlobalRealtimeProvider } from '@/components/GlobalRealtimeProvider'

export function Providers({
  children,
  initialStaff = null,
}: {
  children: ReactNode
  initialStaff?: OutletStaffProfile | null
}) {
  const queryClient = useMemo(
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
      }),
    []
  )
  const supabase = createSupabaseBrowserClient()

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider supabase={supabase} initialStaff={initialStaff}>
        <GlobalRealtimeProvider>
          {children}
        </GlobalRealtimeProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
