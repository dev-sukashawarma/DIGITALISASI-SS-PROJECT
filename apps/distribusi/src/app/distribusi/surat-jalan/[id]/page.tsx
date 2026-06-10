'use client'
import { use } from 'react'
import { SuratJalanDetail } from '@/components/distribusi/SuratJalanDetail'

export default function SuratJalanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <main className="max-w-2xl mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">Detail Surat Jalan</h1>
      <SuratJalanDetail suratJalanId={id} />
    </main>
  )
}
