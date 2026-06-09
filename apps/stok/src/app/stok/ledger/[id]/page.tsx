'use client'
import { use } from 'react'
import { LedgerDetail } from '@/components/stok/LedgerDetail'

export default function LedgerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <main className="max-w-2xl mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">Detail Pergerakan</h1>
      <LedgerDetail ledgerId={id} />
    </main>
  )
}
