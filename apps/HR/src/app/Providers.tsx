'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, createSupabaseBrowserClient } from '@suka/auth'
import type { OutletStaffProfile } from '@suka/auth'
import { Toaster } from 'sonner'
import { RoleProvider } from '@/components/layout/RoleContext'
import NextTopLoader from 'nextjs-toploader'

export function Providers({
  children,
  initialStaff = null,
}: {
  children: React.ReactNode
  initialStaff?: OutletStaffProfile | null
}) {
  const [supabase] = useState(() => createSupabaseBrowserClient())
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

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider supabase={supabase} initialStaff={initialStaff}>
        <RoleProvider>
          <NextTopLoader color="#ea580c" showSpinner={false} />
          {children}
          <Toaster richColors position="top-center" />
        </RoleProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
