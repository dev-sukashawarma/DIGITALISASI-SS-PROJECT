'use client'

import { useState, useEffect, Suspense } from 'react'
import { PanelLeftOpen, PanelLeft, Flame } from 'lucide-react'
import Sidebar, { SidebarMode } from '@/components/dashboard/Sidebar'

interface DashboardShellProps {
  user: {
    email: string
    name: string | null
    role: string
  }
  children: React.ReactNode
}

export default function DashboardShell({ user, children }: DashboardShellProps) {
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('expanded')
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('marcom_sidebar_mode')
    if (saved === 'expanded' || saved === 'collapsed' || saved === 'hidden') {
      setSidebarMode(saved as SidebarMode)
    }
  }, [])

  const changeSidebarMode = (mode: SidebarMode) => {
    setSidebarMode(mode)
    if (typeof window !== 'undefined') {
      localStorage.setItem('marcom_sidebar_mode', mode)
    }
  }

  // Keyboard shortcut Ctrl+B or Cmd+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when user is typing in an input, textarea, or contentEditable
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        setSidebarMode((prev) => {
          const next: SidebarMode =
            prev === 'expanded' ? 'collapsed' : 'expanded'
          if (typeof window !== 'undefined') {
            localStorage.setItem('marcom_sidebar_mode', next)
          }
          return next
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const paddingClass =
    sidebarMode === 'expanded'
      ? 'lg:pl-64'
      : sidebarMode === 'collapsed'
      ? 'lg:pl-[72px]'
      : 'lg:pl-0'

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1A1715] font-sans antialiased selection:bg-amber-200 selection:text-amber-950">
      <Suspense fallback={null}>
        <Sidebar
          user={user}
          mode={sidebarMode}
          onModeChange={changeSidebarMode}
          isMobileOpen={isMobileOpen}
          onMobileToggle={setIsMobileOpen}
        />
      </Suspense>

      <div
        className={`flex flex-col min-h-screen transition-all duration-300 ease-in-out ${paddingClass}`}
      >
        {/* Desktop Topbar when sidebar is completely hidden (Full Screen Mode) */}
        {sidebarMode === 'hidden' && (
          <div className="hidden lg:flex items-center justify-between bg-[#1C1917] text-stone-200 px-4 py-2.5 border-b border-stone-800 shadow-xs sticky top-0 z-30 animate-in fade-in duration-200">
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => changeSidebarMode('expanded')}
                className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-100 hover:text-white border border-stone-700 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                title="Buka Sidebar Penuh (Ctrl+B)"
              >
                <PanelLeftOpen className="w-4 h-4 text-amber-400" />
                <span>Buka Sidebar</span>
              </button>
              <button
                type="button"
                onClick={() => changeSidebarMode('collapsed')}
                className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg hover:bg-stone-800/80 text-stone-400 hover:text-stone-200 text-xs font-medium transition-colors cursor-pointer"
                title="Buka Mode Mini (Icon Rail)"
              >
                <PanelLeft className="w-3.5 h-3.5 text-stone-400" />
                <span>Mode Mini</span>
              </button>
              <div className="flex items-center space-x-2 border-l border-stone-800 pl-3">
                <div className="w-6 h-6 rounded-md bg-stone-900 border border-stone-800 flex items-center justify-center p-0.5 overflow-hidden">
                  <img src="/logo.png" alt="MARCOM SS" className="w-full h-full object-contain" />
                </div>
                <span className="text-xs font-bold text-white tracking-tight">MARCOM SS</span>
                <span className="text-[11px] text-stone-400">· Suka Shawarma</span>
              </div>
            </div>

            <div className="flex items-center space-x-4 text-xs">
              <span className="text-stone-400 font-medium hidden xl:inline">
                Mode Layar Penuh (Sidebar Ditutup)
              </span>
              <a
                href={
                  typeof window !== 'undefined' &&
                  (window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1'))
                    ? 'http://localhost:3010'
                    : (process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com')
                }
                className="inline-flex items-center space-x-1.5 text-amber-300 hover:text-amber-200 transition-colors"
                title="Buka Portal Aplikasi Suka Shawarma"
              >
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>Portal Aplikasi</span>
              </a>
              <div className="flex items-center space-x-2 border-l border-stone-800 pl-3">
                <span className="w-6 h-6 rounded-md bg-stone-800 text-stone-200 flex items-center justify-center text-[10px] font-bold">
                  {user.email.slice(0, 2).toUpperCase()}
                </span>
                <span className="text-stone-300 font-medium max-w-[140px] truncate">
                  {user.name || user.email.split('@')[0]}
                </span>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-5 lg:p-6 xl:p-8 w-full space-y-6">
          {children}
        </main>
      </div>
    </div>
  )
}
