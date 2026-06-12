import { LedgerDetail } from '@/components/stok/LedgerDetail'
import Link from 'next/link'

export function generateStaticParams() {
  return []
}

export const dynamicParams = false

export default async function LedgerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-12">
      <header className="bg-[#fff8f1] border-b border-[#d9c2b2]/30 px-4 py-4 flex items-center justify-between shadow-[0_2px_8px_rgba(144,77,0,0.03)] sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Link href="/stok/ledger" className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-[#d9c2b2]/30 text-[#f29744] hover:bg-orange-50 active:scale-95 transition-all shadow-sm" title="Kembali ke Ledger">
            <span className="text-base">←</span>
          </Link>
          <h1 className="font-bold text-sm text-[#701604] uppercase tracking-tight leading-tight">Detail Pergerakan Stok</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 mt-8">
        <LedgerDetail ledgerId={id} />
      </main>
    </div>
  )
}
