'use client'

import { AuthProvider, createSupabaseBrowserClient } from '@suka/auth'
import type { OutletStaffProfile } from '@suka/auth'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

export function Providers({
  children,
  initialStaff = null,
}: {
  children: React.ReactNode
  initialStaff?: OutletStaffProfile | null
}) {
  const supabase = createSupabaseBrowserClient()

  return (
    <ErrorBoundary>
      <AuthProvider supabase={supabase} initialStaff={initialStaff}>
        {children}
      </AuthProvider>
    </ErrorBoundary>
  )
}
