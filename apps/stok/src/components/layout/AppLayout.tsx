'use client'

import React, { useState } from 'react'
import { AppSidebar } from './AppSidebar'
import { BottomNav } from '@/components/common/BottomNav'
import { Menu, X, ChefHat } from 'lucide-react'
import { useAuth } from '@suka/auth'
import Link from 'next/link'

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { outletStaff } = useAuth()

  return (
    <div className="min-h-screen bg-[#fffdfa] text-suka-brown flex flex-col lg:flex-row">
      {/* ── Desktop Left Sidebar (>= lg) ── */}
      <div className="hidden lg:flex h-screen sticky top-0 shrink-0 z-30">
        <AppSidebar />
      </div>

      {/* ── Mobile Top Header (< lg) ── */}
      <header className="lg:hidden sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-suka-brown/10 px-4 py-3 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-xl bg-suka-cream/50 text-suka-brown hover:bg-suka-cream active:scale-95 transition-all cursor-pointer"
            aria-label="Buka Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-suka-orange to-orange-500 flex items-center justify-center text-white shadow-2xs">
              <ChefHat className="w-4 h-4" />
            </div>
            <span className="font-black text-sm text-suka-brown tracking-tight">
              SUKA STOK
            </span>
          </Link>
        </div>

        {outletStaff && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider bg-suka-cream text-suka-orange px-2.5 py-1 rounded-full border border-suka-orange/20 truncate max-w-[120px]">
              {outletStaff.name?.split(' ')[0]}
            </span>
          </div>
        )}
      </header>

      {/* ── Mobile Slide-over Drawer (< lg) ── */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            <div className="absolute top-3 right-3 z-20">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-xl bg-suka-cream/80 text-suka-brown hover:bg-suka-cream"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <AppSidebar onCloseMobile={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* ── Main Scrollable Content Area ── */}
      <main className="flex-1 min-w-0 overflow-y-auto pb-24 lg:pb-6">
        {children}
      </main>

      {/* ── Mobile Bottom Navigation Bar (< lg) ── */}
      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  )
}
