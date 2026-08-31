'use client'

import { AuthProvider, createSupabaseBrowserClient } from '@suka/auth'
import type { OutletStaffProfile } from '@suka/auth'

export function Providers({
  children,
  initialStaff,
}: {
  children: React.ReactNode
  initialStaff: OutletStaffProfile | null
}) {
  return (
    <AuthProvider supabase={createSupabaseBrowserClient()} initialStaff={initialStaff}>
      {children}
    </AuthProvider>
  )
}
