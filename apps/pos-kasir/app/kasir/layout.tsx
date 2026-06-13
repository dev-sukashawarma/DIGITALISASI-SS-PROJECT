'use client'

import { usePathname } from 'next/navigation'
import KasirNav from '@/components/KasirNav'

export default function KasirLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 lg:flex print:block">
      <KasirNav />
      <main className="flex-1 min-w-0 print:w-full print:max-w-none">
        <div className="max-w-6xl mx-auto px-4 sm:px-5 lg:px-8 py-6 lg:py-8 print:p-0 print:max-w-none">
          {children}
        </div>
      </main>
    </div>
  )
}
