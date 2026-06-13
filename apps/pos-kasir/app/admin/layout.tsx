'use client'

import { usePathname } from 'next/navigation'
import AdminNav from '@/components/AdminNav'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLogin = pathname === '/admin/login'

  if (isLogin) {
    return <div className="min-h-screen bg-white">{children}</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 md:flex print:block">
      <AdminNav />
      <main className="flex-1 min-w-0 print:w-full print:max-w-none">
        <div className="max-w-6xl mx-auto px-4 sm:px-5 md:px-8 py-6 md:py-8 print:p-0 print:max-w-none">
          {children}
        </div>
      </main>
    </div>
  )
}
