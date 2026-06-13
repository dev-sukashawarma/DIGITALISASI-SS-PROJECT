'use client'

import { useMemo } from 'react'
import { AuthProvider, createSupabaseBrowserClient } from '@suka/auth'

export function Providers({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])

  return (
    <AuthProvider supabase={supabase}>
      {children}
    </AuthProvider>
  )
}
