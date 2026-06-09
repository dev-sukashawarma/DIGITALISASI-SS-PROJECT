'use client'
import { useAuth } from '@/context/AuthContext'
import { ManualEntryForm } from '@/components/stok/ManualEntryForm'

export default function NewLedgerPage() {
  const { outletStaff } = useAuth()
  if (!outletStaff) return <main className="p-4">Memuat…</main>
  return (
    <main className="max-w-2xl mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">Entri Manual Ledger</h1>
      <ManualEntryForm outletId={outletStaff.outlet_id} createdBy={outletStaff.id} />
    </main>
  )
}
