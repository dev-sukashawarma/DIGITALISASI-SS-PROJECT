'use client'
import { useAuth } from '@/context/AuthContext'
import { SuratJalanForm } from '@/components/distribusi/SuratJalanForm'

export default function NewSuratJalanPage() {
  const { outletStaff } = useAuth()
  if (!outletStaff) return <main className="p-4">Memuat…</main>

  return (
    <main className="max-w-2xl mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">Surat Jalan Baru</h1>
      <SuratJalanForm outletId={outletStaff.outlet_id} />
    </main>
  )
}
