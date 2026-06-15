'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase'

interface OutletStaffProfile {
  id: string
  outlet_id: string
  name: string
  role: 'crew' | 'kasir' | 'spv' | 'kepala_outlet'
  status: 'active' | 'inactive' | 'on_leave'
  face_descriptor?: any
  ref_photo_url?: string
  outlets?: { name: string } | null
}

interface AuthContextType {
  session: Session | null
  user: any
  outletStaff: OutletStaffProfile | null
  loading: boolean
  /** Non-null ketika session ada tapi outlet_staff tidak ditemukan / error query */
  staffError: string | null
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<any>(null)
  const [outletStaff, setOutletStaff] = useState<OutletStaffProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [staffError, setStaffError] = useState<string | null>(null)

  const supabase = createClient()

  /** Fetch outlet_staff row for the given auth user id. */
  async function fetchOutletStaff(userId: string) {
    const { data: staff, error } = await supabase
      .from('outlet_staff')
      .select('*, outlets!outlet_staff_outlet_id_fkey(name)')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error('[AuthContext] outlet_staff query error:', error)
      setStaffError(`Gagal memuat data staff: ${error.message}`)
      setOutletStaff(null)
      return
    }

    if (!staff) {
      console.warn('[AuthContext] No outlet_staff record found for user:', userId)
      setStaffError('Akun Anda belum terhubung dengan data staff outlet. Hubungi admin / SPV.')
      setOutletStaff(null)
      return
    }

    setStaffError(null)
    setOutletStaff(staff as OutletStaffProfile)
  }

  useEffect(() => {
    // Flag agar onAuthStateChange tidak memproses INITIAL_SESSION secara duplikat
    // saat getSession sudah menangani inisialisasi.
    let initialised = false

    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setSession(session)
      setUser(session?.user ?? null)

      if (session?.user.id) {
        await fetchOutletStaff(session.user.id)
      }

      setLoading(false)
      initialised = true
    }

    getSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      // Lewati INITIAL_SESSION jika getSession sudah selesai — hindari query ganda.
      if (_event === 'INITIAL_SESSION' && initialised) return

      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user.id) {
        await fetchOutletStaff(session.user.id)
      } else {
        setOutletStaff(null)
        setStaffError(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    setOutletStaff(null)
    setStaffError(null)
  }

  return (
    <AuthContext.Provider value={{ session, user, outletStaff, loading, staffError, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

