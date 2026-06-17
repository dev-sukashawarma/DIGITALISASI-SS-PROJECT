'use client'

import { useAuth } from '@suka/auth'
import { useSuratJalanList } from '@/hooks/useSuratJalan'
import { BottomNav } from '@/components/distribusi/BottomNav'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const router = useRouter()
  const { outletStaff, loading: authLoading } = useAuth()

  // Load shipments for metrics
  const isPusat = outletStaff?.role === 'kepala_outlet'
  const outletIdFilter = isPusat ? undefined : (outletStaff?.outlet_id ?? undefined)

  const { suratJalanList, loading: listLoading } = useSuratJalanList(outletIdFilter)

  if (authLoading) {
    return (
      <div className="flex flex-col min-h-screen justify-center items-center bg-[#fff8f1] text-[#701604] font-medium">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#701604] mb-4"></div>
        <p className="text-xs font-bold uppercase tracking-wider animate-pulse">Memuat Profil Staff...</p>
      </div>
    )
  }

  if (!outletStaff) {
    return (
      <div className="min-h-screen bg-[#fff8f1] flex items-center justify-center p-4">
        <p className="p-4 text-xs font-bold text-[#ba1a1a] bg-[#ffdad6] border border-[#ba1a1a]/20 rounded-xl">
          Akses ditolak: Sesi tidak ditemukan.
        </p>
      </div>
    )
  }

  // Calculate metrics
  const drafts = suratJalanList.filter((sj) => sj.status === 'draft')
  const inTransit = suratJalanList.filter((sj) => sj.status === 'dikirim' || sj.status === 'dikirim_lengkap')
  const completed = suratJalanList.filter((sj) => sj.status === 'diterima_lengkap' || sj.status === 'diterima_sebagian' || sj.status === 'selesai')

  // Recent shipments (limit 3)
  const recentShipments = suratJalanList.slice(0, 3)

  const STATUS_LABELS: Record<string, { text: string; style: string }> = {
    draft: { text: 'Draft', style: 'bg-gray-100 text-gray-700 border-gray-200' },
    dikirim: { text: 'Dikirim', style: 'bg-blue-50 text-blue-700 border-blue-200' },
    dikirim_lengkap: { text: 'Dikirim', style: 'bg-blue-50 text-blue-700 border-blue-200' },
    diterima_lengkap: { text: 'Diterima Lengkap', style: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    diterima_sebagian: { text: 'Diterima Sebagian', style: 'bg-orange-50 text-orange-700 border-orange-200' },
    selesai: { text: 'Selesai', style: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  }

  return (
    <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-32">
      {/* TopAppBar */}
      <header className="sticky top-0 z-40 bg-[#fff8f1] border-b border-[#d9c2b2]/30 px-6 py-4 flex justify-between items-center shadow-[0_2px_8px_rgba(144,77,0,0.03)]">
        <div className="flex flex-col">
          <span className="font-bold text-lg text-[#701604] tracking-tight">Distribusi Dashboard</span>
          <span className="text-[10px] text-[#544437]/75 font-bold mt-0.5 uppercase tracking-wider">
            {outletStaff.name} • {isPusat ? 'GUDANG PUSAT' : `OUTLET ${outletStaff.outlet_id?.slice(0, 4).toUpperCase() || ''}`}
          </span>
        </div>
      </header>

      <main className="px-6 py-6 max-w-2xl mx-auto space-y-6">
        {/* Metrics Grid */}
        <section className="grid grid-cols-3 gap-3">
          {isPusat ? (
            <div className="bg-white border border-[#d9c2b2]/45 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] text-[#544437]/60 font-bold uppercase tracking-wider">Draf SJ</span>
              <span className="text-2xl font-black text-[#701604] mt-2">{listLoading ? '...' : drafts.length}</span>
            </div>
          ) : (
            <div className="bg-white border border-[#d9c2b2]/45 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] text-[#544437]/60 font-bold uppercase tracking-wider">Total Item</span>
              <span className="text-2xl font-black text-[#544437] mt-2">{listLoading ? '...' : suratJalanList.length}</span>
            </div>
          )}
          <div className="bg-white border border-[#d9c2b2]/45 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] text-[#544437]/60 font-bold uppercase tracking-wider">
              {isPusat ? 'Dalam Transit' : 'Kiriman Masuk'}
            </span>
            <span className="text-2xl font-black text-[#f29744] mt-2">{listLoading ? '...' : inTransit.length}</span>
          </div>
          <div className="bg-white border border-[#d9c2b2]/45 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] text-[#544437]/60 font-bold uppercase tracking-wider">Selesai</span>
            <span className="text-2xl font-black text-green-700 mt-2">{listLoading ? '...' : completed.length}</span>
          </div>
        </section>

        {/* Quick Actions */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#544437]/70">Aksi Cepat</h3>
          <div className="grid grid-cols-2 gap-3">
            {isPusat ? (
              <>
                <button
                  onClick={() => router.push('/distribusi/surat-jalan/new')}
                  className="bg-[#f29744] hover:bg-orange-600 text-white font-bold p-4 rounded-2xl text-xs uppercase tracking-wider text-left shadow-sm flex flex-col justify-between h-24 active:scale-95 transition-all cursor-pointer"
                >
                  <span className="text-lg">➕</span>
                  <span>Buat Surat Jalan</span>
                </button>
                <button
                  onClick={() => router.push('/distribusi/surat-jalan')}
                  className="bg-white border border-[#d9c2b2]/45 text-[#544437] hover:bg-[#faf2e9] font-bold p-4 rounded-2xl text-xs uppercase tracking-wider text-left shadow-sm flex flex-col justify-between h-24 active:scale-95 transition-all cursor-pointer"
                >
                  <span className="text-lg">📋</span>
                  <span>Daftar Surat Jalan</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => router.push('/distribusi/terima/scan')}
                  className="bg-[#f29744] hover:bg-orange-600 text-white font-bold p-4 rounded-2xl text-xs uppercase tracking-wider text-left shadow-sm flex flex-col justify-between h-24 active:scale-95 transition-all cursor-pointer"
                >
                  <span className="text-lg">📷</span>
                  <span>Scan QR Penerimaan</span>
                </button>
                <button
                  onClick={() => router.push('/distribusi/terima')}
                  className="bg-white border border-[#d9c2b2]/45 text-[#544437] hover:bg-[#faf2e9] font-bold p-4 rounded-2xl text-xs uppercase tracking-wider text-left shadow-sm flex flex-col justify-between h-24 active:scale-95 transition-all cursor-pointer"
                >
                  <span className="text-lg">🚚</span>
                  <span>Verifikasi Kiriman</span>
                </button>
              </>
            )}
          </div>
        </section>

        {/* Recent Activity */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#544437]/70">Aktivitas Terkini</h3>
          {listLoading ? (
            <p className="text-xs text-[#544437]/60">Memuat data...</p>
          ) : recentShipments.length === 0 ? (
            <div className="bg-white border border-[#d9c2b2]/40 rounded-2xl p-6 text-center shadow-sm">
              <p className="text-xs text-[#544437]/60">Belum ada aktivitas distribusi.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentShipments.map((sj) => {
                const statusInfo = STATUS_LABELS[sj.status] || { text: sj.status, style: 'bg-gray-100 text-gray-700' }
                return (
                  <div
                    key={sj.id}
                    onClick={() => {
                      if (isPusat) {
                        router.push(`/distribusi/surat-jalan/${sj.id}`)
                      } else {
                        router.push(`/distribusi/terima/${sj.id}`)
                      }
                    }}
                    className="bg-white border border-[#d9c2b2]/40 rounded-2xl p-4 shadow-sm flex justify-between items-center hover:bg-[#faf2e9] cursor-pointer transition active:scale-[0.98]"
                  >
                    <div className="space-y-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-black uppercase tracking-wider border px-2 py-0.5 rounded-lg ${statusInfo.style}`}>
                          {statusInfo.text}
                        </span>
                        <span className="text-[10px] font-bold text-[#544437]/60">
                          {new Date(sj.created_at).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      </div>
                      <h4 className="font-bold text-[#1e1b15] text-xs uppercase tracking-wider truncate mt-1">
                        No: {sj.document_number || sj.id.substring(0, 8).toUpperCase()}
                      </h4>
                      <p className="text-[10px] text-[#544437]/70 font-semibold truncate">
                        {isPusat ? `Tujuan: Outlet ${sj.outlet_id.slice(0, 4).toUpperCase()}` : 'Dari: Central Kitchen'}
                      </p>
                    </div>
                    <span className="text-[#877365] text-base">→</span>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>

      {/* Bottom Navigation */}
      <BottomNav activeTab="dashboard" />
    </div>
  )
}
