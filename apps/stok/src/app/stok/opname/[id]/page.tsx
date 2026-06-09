'use client'
import { use } from 'react'
import { OpnameDetail } from '@/components/stok/OpnameDetail'

export default function OpnameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <main className="max-w-2xl mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">Detail Opname</h1>
      <OpnameDetail opnameId={id} />
    </main>
  )
}
