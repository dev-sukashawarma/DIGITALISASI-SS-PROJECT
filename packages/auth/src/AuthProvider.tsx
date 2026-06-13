'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import type { OutletStaffProfile } from './types'
import { getOutletStaff } from './staff'

interface AuthContextType {
  session: Session | null
  user: Session['user'] | null
  outletStaff: OutletStaffProfile | null
  loading: boolean
  staffError: string | null
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{
  supabase: SupabaseClient
  children: React.ReactNode
}> = ({ supabase, children }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<Session['user'] | null>(null)
  const [outletStaff, setOutletStaff] = useState<OutletStaffProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [staffError, setStaffError] = useState<string | null>(null)

  useEffect(() => {
    let initialised = false

    async function loadStaff(userId: string | undefined) {
      if (!userId) {
        setOutletStaff(null)
        setStaffError(null)
        return
      }
      const { staff, error } = await getOutletStaff(supabase, userId)
      if (error) {
        setStaffError(`Gagal memuat data staff: ${error}`)
        setOutletStaff(null)
      } else if (!staff) {
        setStaffError('Akun Anda belum terhubung dengan data staff. Hubungi admin / SPV.')
        setOutletStaff(null)
      } else {
        setStaffError(null)
        setOutletStaff(staff)
      }
    }

    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      setUser(session?.user ?? null)
      await loadStaff(session?.user?.id)
      setLoading(false)
      initialised = true
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'INITIAL_SESSION' && initialised) return
        setSession(session)
        setUser(session?.user ?? null)
        await loadStaff(session?.user?.id)
      }
    )
    return () => subscription.unsubscribe()
  }, [supabase])

  const signOut = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    setOutletStaff(null)
    setStaffError(null)
  }

  return (
    <AuthContext.Provider
      value={{ session, user, outletStaff, loading, staffError, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
