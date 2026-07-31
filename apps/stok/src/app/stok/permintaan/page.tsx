'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@suka/auth'
import { useOutletScope } from '@/hooks/useOutletScope'
import { PermintaanForm } from '@/components/permintaan/PermintaanForm'
import { PermintaanList } from '@/components/permintaan/PermintaanList'
import { ApprovalList } from '@/components/permintaan/ApprovalList'
import { OutletSwitcher } from '@/components/common/OutletSwitcher'
import { BottomNav } from '@/components/common/BottomNav'
import { canApprovePermintaan } from '@/lib/stok/approver'

const KITCHEN_OUTLET_ID = '550e8400-e29b-41d4-a716-446655440001'

export default function PermintaanPage() {
  const { outletStaff, loading } = useAuth()
  const { selectedOutletId } = useOutletScope()
  const [refreshKey, setRefreshKey] = useState(0)
  const [mainTab, setMainTab] = useState<'buat' | 'riwayat'>('buat')
  const [isCartView, setIsCartView] = useState(false)

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><p className="text-gray-500">Memuat…</p></div>
  }
  if (!outletStaff) return null

  // Siapa yang MELIHAT panel persetujuan (termasuk SPV, untuk pengawasan)…
  const isKitchen = selectedOutletId === KITCHEN_OUTLET_ID
    || ['admin', 'spv', 'regional_manager', 'owner', 'kitchen'].includes(outletStaff.role)

  // …dan siapa yang benar-benar boleh MEMUTUSKAN. Sengaja memakai predikat yang
  // sama dengan gerbang server (`requirePermintaanApprover`) supaya tampilan
  // tak pernah menjanjikan aksi yang nanti ditolak server.
  const canApprove = canApprovePermintaan(outletStaff.role)

  const handleSubmitSuccess = () => {
    setRefreshKey(k => k + 1)
  }

  return (
    <div className="bg-[#fff8f1] min-h-screen pb-28">
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {!isCartView && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href="/dashboard"
                className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-white border border-[#d9c2b2]/30 text-[#f29744] hover:bg-orange-50 active:scale-95 transition-all shadow-sm"
                title="Kembali ke Dashboard"
              >
                <span className="text-base">←</span>
              </Link>
              <h1 className="text-xl font-extrabold text-[#701604] tracking-tight truncate">
                Permintaan Bahan Baku
              </h1>
            </div>
            <OutletSwitcher />
          </div>
        )}

        {isKitchen ? (
          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#f29744]">Menunggu Persetujuan</h2>
            <ApprovalList canApprove={canApprove} />
          </section>
        ) : (
          <>
            {!isCartView && (
              <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-[#d9c2b2]/40">
                <button
                  onClick={() => setMainTab('buat')}
                  className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider rounded-xl transition-all ${mainTab === 'buat' ? 'bg-[#701604] text-white shadow-md' : 'text-[#544437] hover:bg-[#fff7ed]'}`}
                >
                  Buat Baru
                </button>
                <button
                  onClick={() => setMainTab('riwayat')}
                  className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider rounded-xl transition-all ${mainTab === 'riwayat' ? 'bg-[#701604] text-white shadow-md' : 'text-[#544437] hover:bg-[#fff7ed]'}`}
                >
                  Riwayat
                </button>
              </div>
            )}

            {mainTab === 'buat' && selectedOutletId && (
              <PermintaanForm outletId={selectedOutletId} onSubmitSuccess={handleSubmitSuccess} onCartViewChange={setIsCartView} />
            )}
            
            {mainTab === 'riwayat' && selectedOutletId && (
              <section className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                <PermintaanList key={`${selectedOutletId}-${refreshKey}`} outletId={selectedOutletId} />
              </section>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
