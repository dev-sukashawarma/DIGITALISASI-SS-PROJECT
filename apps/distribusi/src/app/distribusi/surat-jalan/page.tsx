'use client'
import { useAuth } from '@/context/AuthContext'
import { useSuratJalanList } from '@/hooks/useSuratJalan'
import { SuratJalanList } from '@/components/distribusi/SuratJalanList'

export default function SuratJalanListPage() {
  const { outletStaff } = useAuth()
  const { suratJalanList, loading } = useSuratJalanList()

  return (
    <main className="max-w-2xl mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">Surat Jalan</h1>
      {loading ? <p>Memuat…</p> : <SuratJalanList items={suratJalanList} />}
    </main>
  )
}
