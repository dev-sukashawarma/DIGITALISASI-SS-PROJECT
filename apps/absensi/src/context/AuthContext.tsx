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
}

interface AuthContextType {
  session: Session | null
  user: any
  outletStaff: OutletStaffProfile | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<any>(null)
  const [outletStaff, setOutletStaff] = useState<OutletStaffProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setSession(session)
      setUser(session?.user ?? null)

      if (session?.user.id) {
        const { data: staff } = await supabase
          .from('outlet_staff')
          .select()
          .eq('id', session.user.id)
          .maybeSingle()
        setOutletStaff(staff ?? null)
      }

      setLoading(false)
    }

    getSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user.id) {
        const { data: staff } = await supabase
          .from('outlet_staff')
          .select()
          .eq('id', session.user.id)
          .maybeSingle()
        setOutletStaff(staff ?? null)
      } else {
        setOutletStaff(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    setOutletStaff(null)
  }

  return (
    <AuthContext.Provider value={{ session, user, outletStaff, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
