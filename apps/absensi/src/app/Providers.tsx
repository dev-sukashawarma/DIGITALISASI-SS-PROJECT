'use client'

import { useMemo } from 'react'
import { AuthProvider, createSupabaseBrowserClient } from '@suka/auth'
import type { OutletStaffProfile } from '@suka/auth'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { ToastProvider } from '@/lib/feedback/toast'

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
      <AuthProvider supabase={supabase} initialStaff={initialStaff}>
        <ToastProvider>
          {children}
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
