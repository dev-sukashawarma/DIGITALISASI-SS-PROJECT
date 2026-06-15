'use client'

import { ReactNode, useMemo } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, createSupabaseBrowserClient } from '@suka/auth'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

export function Providers({ children }: { children: ReactNode }) {
  const queryClient = useMemo(() => new QueryClient(), [])
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <AuthProvider supabase={supabase}>{children}</AuthProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  )
}
