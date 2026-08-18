'use client'
import { useState } from 'react'
import { useAuth } from '@suka/auth'
import { useOutletScope } from '@/hooks/useOutletScope'
import { PermintaanForm } from '@/components/permintaan/PermintaanForm'
import { PermintaanList } from '@/components/permintaan/PermintaanList'
import { ApprovalList } from '@/components/permintaan/ApprovalList'
import { OutletSwitcher } from '@/components/common/OutletSwitcher'
import { AppLayout } from '@/components/layout/AppLayout'
import { canApprovePermintaan } from '@/lib/stok/approver'

const KITCHEN_OUTLET_ID = '550e8400-e29b-41d4-a716-446655440001'

export default function PermintaanPage() {
  const { outletStaff, loading } = useAuth()
  const { selectedOutletId } = useOutletScope()
  const [refreshKey, setRefreshKey] = useState(0)
  const [mainTab, setMainTab] = useState<'buat' | 'riwayat'>('buat')
  const [isCartView, setIsCartView] = useState(false)

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><p className="text-suka-brown/60 text-xs font-bold">Memuat…</p></div>
  }
  if (!outletStaff) return null

  const isKitchen = selectedOutletId === KITCHEN_OUTLET_ID
    || ['admin', 'spv', 'regional_manager', 'owner', 'kitchen'].includes(outletStaff.role)

  const canApprove = canApprovePermintaan(outletStaff.role)

  const handleSubmitSuccess = () => {
    setRefreshKey(k => k + 1)
  }

  return (
    <AppLayout>
      <div className="bg-[#fff8f1] min-h-screen pb-24">
        {/* Top Header */}
        {!isCartView && (
          <header className="bg-white/95 backdrop-blur-md border-b border-suka-brown/10 px-4 sm:px-6 py-4 flex items-center justify-between shadow-2xs sticky top-0 z-20">
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold text-suka-brown tracking-tight truncate">
                Permintaan Bahan Baku
              </h1>
              <p className="text-[10px] text-suka-brown/60 font-bold uppercase tracking-wider mt-0.5">
                Alur Distribusi Kitchen & Outlet
              </p>
            </div>
            <OutletSwitcher />
          </header>
        )}

        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          {isKitchen ? (
            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-suka-orange">Antrean Persetujuan</h2>
              <ApprovalList canApprove={canApprove} />
            </section>
          ) : (
            <>
              {!isCartView && (
                <div className="flex bg-white p-1.5 rounded-2xl shadow-xs border border-suka-brown/10">
                  <button
                    onClick={() => setMainTab('buat')}
                    className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${mainTab === 'buat' ? 'bg-suka-orange text-white shadow-2xs' : 'text-suka-brown/70 hover:bg-suka-cream/50'}`}
                  >
                    Buat Baru
                  </button>
                  <button
                    onClick={() => setMainTab('riwayat')}
                    className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${mainTab === 'riwayat' ? 'bg-suka-orange text-white shadow-2xs' : 'text-suka-brown/70 hover:bg-suka-cream/50'}`}
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
      </div>
    </AppLayout>
  )
}
