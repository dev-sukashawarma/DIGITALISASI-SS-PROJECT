'use client'

import { useState } from 'react'
import { AuthProvider, createSupabaseBrowserClient } from '@suka/auth'
import type { OutletStaffProfile } from '@suka/auth'

export function Providers({
  children,
  initialStaff = null,
}: {
  children: any
  initialStaff?: OutletStaffProfile | null
}) {
  const [supabase] = useState(() => createSupabaseBrowserClient())

  return (
    <AuthProvider supabase={supabase} initialStaff={initialStaff}>
      {children}
    </AuthProvider>
  )
}
