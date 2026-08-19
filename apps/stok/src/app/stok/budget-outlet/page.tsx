'use client'
import Link from 'next/link'
import { useAuth } from '@suka/auth'
import { BottomNav } from '@/components/common/BottomNav'
import { BudgetOutletList } from '@/components/permintaan/BudgetOutletList'

export default function BudgetOutletPage() {
  const { outletStaff, loading } = useAuth()

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><p className="text-gray-500">Memuat…</p></div>
  }
  if (!outletStaff || outletStaff.role !== 'owner') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 px-4 text-center">
        <p className="text-suka-brown font-bold">Halaman ini khusus owner.</p>
        <Link href="/dashboard" className="text-suka-orange font-bold underline">Kembali ke Dashboard</Link>
      </div>
    )
  }

  return (
    <div className="bg-[#fff8f1] min-h-screen pb-28">
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-white border border-[#d9c2b2]/30 text-[#f29744] hover:bg-orange-50 active:scale-95 transition-all shadow-sm"
            title="Kembali ke Dashboard"
          >
            <span className="text-base">←</span>
          </Link>
          <h1 className="text-xl font-extrabold text-[#701604] tracking-tight truncate">
            Budget Pembelian per Outlet
          </h1>
        </div>
        <BudgetOutletList />
      </main>
      <BottomNav />
    </div>
  )
}
