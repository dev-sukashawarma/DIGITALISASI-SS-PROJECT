'use client'
import { useAuth } from '@/context/AuthContext'
import { OpnameForm } from '@/components/stok/OpnameForm'

export default function NewOpnamePage() {
  const { outletStaff } = useAuth()
  if (!outletStaff) return <main className="p-4">Memuat…</main>
  return (
    <main className="max-w-2xl mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">Opname Baru</h1>
      <OpnameForm outletId={outletStaff.outlet_id} createdBy={outletStaff.id} />
    </main>
  )
}
