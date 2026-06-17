'use client'
import { useAuth } from '@suka/auth'
import { PermintaanForm } from '@/components/permintaan/PermintaanForm'
import { PermintaanList } from '@/components/permintaan/PermintaanList'
import { ApprovalList } from '@/components/permintaan/ApprovalList'

const KITCHEN_OUTLET_ID = '550e8400-e29b-41d4-a716-446655440001'

export default function PermintaanPage() {
  const { outletStaff, loading } = useAuth()

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><p className="text-gray-500">Memuat…</p></div>
  }
  if (!outletStaff) return null

  const isKitchen = outletStaff.outlet_id === KITCHEN_OUTLET_ID
    || ['admin', 'spv', 'owner'].includes(outletStaff.role)

  return (
    <div className="bg-[#fff8f1] min-h-screen">
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <h1 className="text-xl font-extrabold text-[#701604] tracking-tight">
          Permintaan Bahan Baku
        </h1>

        {isKitchen ? (
          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#f29744]">Menunggu Persetujuan</h2>
            <ApprovalList />
          </section>
        ) : (
          <>
            {outletStaff.outlet_id && <PermintaanForm outletId={outletStaff.outlet_id} />}
            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#f29744]">Riwayat Permintaan</h2>
              {outletStaff.outlet_id && <PermintaanList outletId={outletStaff.outlet_id} />}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
