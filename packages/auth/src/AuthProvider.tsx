'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import type { OutletStaffProfile } from './types'
import { getOutletStaff } from './staff'
import { purgeStaleBrowserAuthCookies } from './supabase-client'

interface AuthContextType {
  session: Session | null
  user: Session['user'] | null
  outletStaff: OutletStaffProfile | null
  loading: boolean
  staffError: string | null
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function clearAllAuthCookiesInBrowser() {
  if (typeof document === 'undefined') return
  const domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined
  for (const raw of document.cookie.split(';')) {
    const name = raw.split('=')[0].trim()
    if (!name.startsWith('sb-') && name !== '_suka_gate') continue
    document.cookie = `${name}=; Max-Age=0; path=/`
    if (domain) document.cookie = `${name}=; Max-Age=0; path=/; domain=${domain}`
  }
}

function resolvePortalLoginUrlWithNext(): string {
  const isLocal =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  const base = isLocal
    ? 'http://localhost:3010'
    : process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com'
  if (typeof window === 'undefined') return base
  const target = window.location.href
  return `${base.replace(/\/+$/, '')}/?next=${encodeURIComponent(target)}`
}

function isBypassAuthPath(): boolean {
  if (typeof window === 'undefined') return false
  const p = window.location.pathname
  return p === '/login' || p.startsWith('/auth/sso') || p.startsWith('/public/')
}

export const AuthProvider: React.FC<{
  supabase: SupabaseClient
  initialStaff?: OutletStaffProfile | null
  /**
   * Endpoint GET same-origin (mis. `/api/auth/sso`) untuk memulihkan sesi browser dari
   * cookie server apabila `supabase.auth.getSession()` di browser mengembalikan `null`
   * padahal middleware baru saja memvalidasi `initialStaff`.
   */
  sessionSyncUrl?: string
  children: React.ReactNode
}> = ({ supabase, initialStaff = null, sessionSyncUrl, children }) => {
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
      } catch {
        if (!abortController.signal.aborted) {
          setStaffError('Gagal memuat data staff')
        }
      }
    }

    async function tryRecoverSessionFromServer(): Promise<Session | null> {
      if (!sessionSyncUrl || typeof window === 'undefined') return null
      try {
        const res = await fetch(sessionSyncUrl, {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          signal: abortController.signal,
        })
        if (!res.ok) return null
        const body = (await res.json().catch(() => null)) as {
          authenticated?: boolean
          access_token?: string
          refresh_token?: string
        } | null
        if (
          body?.authenticated &&
          typeof body.access_token === 'string' &&
          body.access_token.length > 0 &&
          typeof body.refresh_token === 'string' &&
          body.refresh_token.length > 0
        ) {
          purgeStaleBrowserAuthCookies()
          const { data, error } = await supabase.auth.setSession({
            access_token: body.access_token,
            refresh_token: body.refresh_token,
          })
          if (!error && data.session) {
            return data.session
          }
        }
        return null
      } catch {
        return null
      }
    }

    async function init() {
      try {
        // Pada halaman handoff `/auth/sso`, biarkan halaman itu sendiri menukar token terlebih dulu
        if (typeof window !== 'undefined' && window.location.pathname.startsWith('/auth/sso')) {
          setLoading(false)
          return
        }

        purgeStaleBrowserAuthCookies()
        let { data: { session: currentSession } } = await supabase.auth.getSession()
        if (abortController.signal.aborted) return

        // Anti-Zombie: bila SSR middleware mengirimkan `initialStaff`, tetapi client gagal
        // membaca/me-refresh cookie di browser (`currentSession === null`), pulihkan dari server!
        if (!currentSession && (initialStaff || sessionSyncUrl) && !isBypassAuthPath()) {
          currentSession = await tryRecoverSessionFromServer()
          if (abortController.signal.aborted) return
        }

        // Bila setelah pemulihan server sesi tetap tidak ada padahal halaman butuh login (`initialStaff` ada),
        // JANGAN PERNAH membiarkan UI tampil setengah hidup dengan `session = null` (yang menyebabkan
        // query RLS melempar "Gagal dimuat"). Bersihkan cookie mati & arahkan rapi ke Portal dengan `?next=`.
        if (!currentSession && initialStaff && !isBypassAuthPath()) {
          clearAllAuthCookiesInBrowser()
          setSession(null)
          setUser(null)
          setOutletStaff(null)
          if (typeof window !== 'undefined') {
            window.location.replace(resolvePortalLoginUrlWithNext())
          }
          return
        }

        setSession(currentSession)
        setUser(currentSession?.user ?? null)
        if (!initialStaff) {
          await loadStaff(currentSession?.user?.id)
        }
        setLoading(false)
      } catch {
        if (!abortController.signal.aborted) {
          setLoading(false)
        }
      }
    }
    void init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, nextSession) => {
        if (event === 'INITIAL_SESSION') return
        if (abortController.signal.aborted) return
        if (!nextSession) {
          // Bila GoTrue memancarkan SIGNED_OUT di tengah pemakaian karena refresh token gagal,
          // coba pulihkan dari server terlebih dahulu sebelum menjatuhkan sesi.
          if (sessionSyncUrl && !isBypassAuthPath()) {
            const recovered = await tryRecoverSessionFromServer()
            if (abortController.signal.aborted) return
            if (recovered) {
              setSession(recovered)
              setUser(recovered.user)
              return
            }
          }
          return
        }
        setSession(nextSession)
        setUser(nextSession.user)
        await loadStaff(nextSession.user.id)
      }
    )
    return () => {
      abortController.abort()
      subscription.unsubscribe()
    }
  }, [supabase, initialStaff, sessionSyncUrl])

  const signOut = async () => {
    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((resolve) => setTimeout(resolve, 1200)),
      ])
    } catch {}
    clearAllAuthCookiesInBrowser()
    setSession(null)
    setUser(null)
    setOutletStaff(null)
    setStaffError(null)

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
