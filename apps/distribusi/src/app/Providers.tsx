'use client'

import { AuthProvider, createSupabaseBrowserClient } from '@suka/auth'
import type { OutletStaffProfile } from '@suka/auth'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { Toaster } from 'sonner'

export function Providers({
  children,
  initialStaff = null,
}: {
  children: React.ReactNode
  initialStaff?: OutletStaffProfile | null
}) {
  const supabase = createSupabaseBrowserClient()
  const [queryClient] = useState(() => new QueryClient())

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider supabase={supabase} initialStaff={initialStaff}>
          <Toaster richColors position="top-center" closeButton />
          {children}
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
