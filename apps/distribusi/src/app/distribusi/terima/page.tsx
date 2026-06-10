'use client'
import { useAuth } from '@/context/AuthContext'
import { useSuratJalanList } from '@/hooks/useSuratJalan'
import { TerimaList } from '@/components/distribusi/TerimaList'

export default function TerimaPage() {
  const { outletStaff } = useAuth()
  const { suratJalanList, loading } = useSuratJalanList(outletStaff?.outlet_id, 'dikirim')

  return (
    <main className="max-w-2xl mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">Penerimaan Barang</h1>
      {loading ? <p>Memuat…</p> : <TerimaList items={suratJalanList} />}
    </main>
  )
}
