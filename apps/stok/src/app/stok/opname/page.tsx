'use client'
import { useAuth } from '@/context/AuthContext'
import { useOpnameList } from '@/hooks/useOpname'
import { OpnameList } from '@/components/stok/OpnameList'

export default function OpnamePage() {
  const { outletStaff } = useAuth()
  const { opnameList, loading } = useOpnameList(outletStaff?.outlet_id)

  return (
    <main className="max-w-2xl mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">Opname Stok</h1>
      {loading ? <p>Memuat…</p> : <OpnameList items={opnameList} />}
    </main>
  )
}
