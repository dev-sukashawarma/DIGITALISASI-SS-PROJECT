'use client'

import React from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { HPPMenuBoard } from '@/components/hpp/HPPMenuBoard'
import { UserAvatarDropdown } from '@/components/common/UserAvatarDropdown'

export default function HPPMenuPage() {
  return (
    <AppLayout>
      <div className="min-h-screen bg-[#fffdfa] flex flex-col">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-suka-brown/10 px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-2xs">
          <div>
            <h1 className="font-black text-base sm:text-lg text-suka-brown leading-tight font-display tracking-tight">
              HPP Setiap Menu (Food Cost)
            </h1>
            <p className="text-[10px] text-suka-brown/60 font-extrabold tracking-widest uppercase mt-0.5">
              Analisis Margin & Komposisi Resep (BOM)
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <UserAvatarDropdown />
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          <HPPMenuBoard />
        </main>
      </div>
    </AppLayout>
  )
}
