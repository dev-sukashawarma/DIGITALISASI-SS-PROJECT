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
  initialStaff?: OutletStaffProfile | null
  children: React.ReactNode
}> = ({ supabase, initialStaff = null, children }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<Session['user'] | null>(null)
  const [outletStaff, setOutletStaff] = useState<OutletStaffProfile | null>(initialStaff)
  const [loading, setLoading] = useState(true)
  const [staffError, setStaffError] = useState<string | null>(null)

  useEffect(() => {
    const abortController = new AbortController()

    async function loadStaff(userId: string | undefined) {
      if (!userId) {
        setOutletStaff(null)
        setStaffError(null)
        return
      }
      try {
        const { staff, error } = await getOutletStaff(supabase, userId)
        if (abortController.signal.aborted) return
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
      } catch (err) {
        if (!abortController.signal.aborted) {
          setStaffError('Gagal memuat data staff')
        }
      }
    }

    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (abortController.signal.aborted) return
        setSession(session)
        setUser(session?.user ?? null)
        // Staff sudah disuplai server (header x-suka-staff) → hindari fetch ulang.
        if (!initialStaff) {
          await loadStaff(session?.user?.id)
        }
        setLoading(false)
      } catch (err) {
        if (!abortController.signal.aborted) {
          setLoading(false)
        }
      }
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // init() sudah menangani sesi awal; INITIAL_SESSION selalu di-skip
        // agar tak ada fetch staff ganda (race `initialised`).
        if (event === 'INITIAL_SESSION') return
        if (abortController.signal.aborted) return
        setSession(session)
        setUser(session?.user ?? null)
        await loadStaff(session?.user?.id)
      }
    )
    return () => {
      abortController.abort()
      subscription.unsubscribe()
    }
  }, [supabase])

  const signOut = async () => {
    try {
      await Promise.race([
        supabase.auth.signOut({ scope: 'local' }),
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ])
    } catch {}
    if (typeof document !== 'undefined') {
      const domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined
      for (const raw of document.cookie.split(';')) {
        const name = raw.split('=')[0].trim()
        if (!name.startsWith('sb-')) continue
        document.cookie = `${name}=; Max-Age=0; path=/`
        if (domain) document.cookie = `${name}=; Max-Age=0; path=/; domain=${domain}`
      }
    }
    setSession(null)
    setUser(null)
    setOutletStaff(null)
    setStaffError(null)
    
    // Redirect to portal login
    window.location.href = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com'
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
