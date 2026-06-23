'use client'
import { useState } from 'react'
import { useAuth } from '@suka/auth'
import { useOutletScope } from '@/hooks/useOutletScope'
import { PermintaanForm } from '@/components/permintaan/PermintaanForm'
import { PermintaanList } from '@/components/permintaan/PermintaanList'
import { ApprovalList } from '@/components/permintaan/ApprovalList'
import { OutletSwitcher } from '@/components/common/OutletSwitcher'

const KITCHEN_OUTLET_ID = '550e8400-e29b-41d4-a716-446655440001'

export default function PermintaanPage() {
  const { outletStaff, loading } = useAuth()
  const { selectedOutletId } = useOutletScope()
  const [refreshKey, setRefreshKey] = useState(0)

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><p className="text-gray-500">Memuat…</p></div>
  }
  if (!outletStaff) return null

  const isKitchen = selectedOutletId === KITCHEN_OUTLET_ID
    || ['admin', 'spv', 'owner', 'kitchen'].includes(outletStaff.role)

  const handleSubmitSuccess = () => {
    setRefreshKey(k => k + 1)
  }

  return (
    <div className="bg-[#fff8f1] min-h-screen">
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-extrabold text-[#701604] tracking-tight">
            Permintaan Bahan Baku
          </h1>
          <OutletSwitcher />
        </div>

        {isKitchen ? (
          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#f29744]">Menunggu Persetujuan</h2>
            <ApprovalList />
          </section>
        ) : (
          <>
            {selectedOutletId && <PermintaanForm outletId={selectedOutletId} onSubmitSuccess={handleSubmitSuccess} />}
            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#f29744]">Riwayat Permintaan</h2>
              {selectedOutletId && <PermintaanList key={`${selectedOutletId}-${refreshKey}`} outletId={selectedOutletId} />}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
