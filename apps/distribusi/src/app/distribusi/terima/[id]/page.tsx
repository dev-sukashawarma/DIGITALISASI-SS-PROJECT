'use client'
import { use } from 'react'
import { VerifikasiForm } from '@/components/distribusi/VerifikasiForm'

export default function TerimaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <main className="max-w-2xl mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">Verifikasi Penerimaan</h1>
      <VerifikasiForm suratJalanId={id} />
    </main>
  )
}
