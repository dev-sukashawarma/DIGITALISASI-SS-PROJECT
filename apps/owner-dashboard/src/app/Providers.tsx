'use client'

import { AuthProvider, createSupabaseBrowserClient } from '@suka/auth'
import type { OutletStaffProfile } from '@suka/auth'

export function Providers({
  children,
  initialStaff = null,
}: {
  children: React.ReactNode
  initialStaff?: OutletStaffProfile | null
}) {
  const supabase = createSupabaseBrowserClient()

  return (
    <AuthProvider supabase={supabase} initialStaff={initialStaff}>
      {children}
    </AuthProvider>
  )
}
