'use client'

import { useMemo } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, createSupabaseBrowserClient } from '@suka/auth'
import type { OutletStaffProfile } from '@suka/auth'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { ToastProvider } from '@/lib/feedback/toast'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,        // cache 60 detik — data lama tetap tampil saat navigasi balik
      gcTime: 5 * 60_000,       // simpan di memori 5 menit setelah komponen unmount
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

export function Providers({
  children,
  initialStaff = null,
}: {
  children: React.ReactNode
  initialStaff?: OutletStaffProfile | null
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider supabase={supabase} initialStaff={initialStaff}>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
