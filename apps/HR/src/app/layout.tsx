import React from 'react'
import type { Metadata } from 'next'
import { getOutletStaff } from '@suka/auth'
import { createServerComponentClient } from '@/lib/supabase-server'
import { Providers } from './Providers'
import { Sidebar } from '@/components/layout/Sidebar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Header } from '@/components/layout/Header'
import { SwipeableLayout } from '@/components/layout/SwipeableLayout'
import { ScrollRestoration } from '@/components/layout/ScrollRestoration'
import './globals.css'

export const metadata: Metadata = {
  title: 'Suka Shawarma — HR Dashboard',
  description: 'Sistem Manajemen Sumber Daya Manusia, Absensi & Payroll Suka Shawarma',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerComponentClient()
  const { data: { user } } = await supabase.auth.getUser()
  let initialStaff = null

  if (user) {
    const { staff } = await getOutletStaff(supabase, user.id)
    initialStaff = staff
  }

  return (
    <html lang="id" className="h-full">
      <body className="h-full antialiased bg-[#FDF9F3]">
        <Providers initialStaff={initialStaff}>
          <div className="flex h-[100dvh] w-full overflow-hidden bg-[#FDF9F3] lg:bg-[#4A1713] relative">
            {/* Decorative Glow */}
            <div className="absolute bottom-[-10rem] left-[-10rem] w-[30rem] h-[30rem] bg-suka-orange/20 blur-[120px] rounded-full pointer-events-none z-0" />
            
            <Sidebar />
            
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-[#FDF9F3] lg:rounded-l-[2.5rem] shadow-[-10px_0_30px_rgba(0,0,0,0.2)] relative z-10 transition-all">
              <Header />
              <SwipeableLayout>
                <main id="hr-main-scroll" className="flex-1 overflow-y-auto w-full">
                  <ScrollRestoration selector="#hr-main-scroll" />
                  <div className="w-full p-3 sm:p-6 lg:p-8 pb-24 lg:pb-8">
                    {children}
                  </div>
                </main>
              </SwipeableLayout>
            </div>
            
            <BottomNav />
          </div>
        </Providers>
      </body>
    </html>
  )
}
