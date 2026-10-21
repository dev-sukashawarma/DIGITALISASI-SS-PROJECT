'use client'

import { useState } from 'react'
import { AuthProvider, createSupabaseBrowserClient } from '@suka/auth'
import type { OutletStaffProfile } from '@suka/auth'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApprovalsProvider } from '../lib/ApprovalsContext'

export function Providers({
  children,
  initialStaff = null,
}: {
  children: any
  initialStaff?: OutletStaffProfile | null
}) {
  const [supabase] = useState(() => createSupabaseBrowserClient())
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
    },
  }))

  return (
    <AuthProvider supabase={supabase} initialStaff={initialStaff}>
      <QueryClientProvider client={queryClient}>
        <ApprovalsProvider>
          {children}
        </ApprovalsProvider>
      </QueryClientProvider>
    </AuthProvider>
  )
}
