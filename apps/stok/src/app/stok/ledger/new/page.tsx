'use client'
import { useAuth } from '@suka/auth'
import { ManualEntryForm } from '@/components/stok/ManualEntryForm'
import Link from 'next/link'

export default function NewLedgerPage() {
  const { outletStaff } = useAuth()
  if (!outletStaff) return <div className="text-center py-20 text-xs font-bold text-gray-500 animate-pulse">Memuat…</div>
  return (
    <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-12">
      <header className="bg-[#fff8f1] border-b border-[#d9c2b2]/30 px-4 py-4 flex items-center justify-between shadow-[0_2px_8px_rgba(144,77,0,0.03)] sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Link href="/stok/ledger" className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-[#d9c2b2]/30 text-[#f29744] hover:bg-orange-50 active:scale-95 transition-all shadow-sm" title="Kembali ke Ledger">
            <span className="text-base">←</span>
          </Link>
          <h1 className="font-bold text-sm text-[#701604] uppercase tracking-tight leading-tight">Entri Manual Ledger</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 mt-8">
        <ManualEntryForm outletId={outletStaff.outlet_id} createdBy={outletStaff.id} />
      </main>
    </div>
  )
}
