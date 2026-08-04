'use client'

import { useState } from 'react'
import { AuthProvider, createSupabaseBrowserClient } from '@suka/auth'
import type { OutletStaffProfile } from '@suka/auth'
import { ApprovalsProvider } from '../lib/ApprovalsContext'

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
      <ApprovalsProvider>
        {children}
      </ApprovalsProvider>
    </AuthProvider>
  )
}
