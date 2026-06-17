'use client'

import { useAuth } from '@suka/auth'
import { useSuratJalanList } from '@/hooks/useSuratJalan'
import { BottomNav } from '@/components/distribusi/BottomNav'
import { useRouter } from 'next/navigation'
import { getCrossAppUrl } from '@/lib/navigation'

export default function DashboardPage() {
  const router = useRouter()
  const { outletStaff, loading: authLoading, signOut } = useAuth()

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

  const handleNavigate = (path: string) => {
    const resolvedUrl = getCrossAppUrl(path)
    if (resolvedUrl.startsWith('http')) {
      window.location.href = resolvedUrl
    } else {
      router.push(resolvedUrl)
    }
  }

  return (
    <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-32">
      {/* TopNavBar */}
      <header className="sticky top-0 z-50 bg-white border-b border-[#701604]/10 px-6 py-4 flex justify-between items-center shadow-[0px_4px_20px_rgba(112,22,4,0.04)]">
        <div className="flex items-center gap-4">
          <img
            alt="Suka Shawarma Logo"
            className="h-10 w-10 object-contain"
            src="https://lh3.googleusercontent.com/aida/AP1WRLuBRxFAnNPICR01ME16F2BQlDq7WI81d4ZDXl8AXgzAEXM4jfSVhD8mRaegtjb-GgChL4MxP1CiIYujHzrmnoI31CBZstksX-j3IE-N86yH6Niv75FKPEfgXTGyRUHDq5-o2OYh0HWFQx_KcbQXLOqNyf26tTRx6crow2DhPNcSOKHOzuYqUZJ6BDSeDILSOV2wQSlBBBuITYqya7o9zIEE9LVv6Kg5cIBUmRBDMsNJaO-w49G8DFpsR04Z"
          />
          <div className="flex flex-col">
            <h1 className="font-bold text-base text-[#701604] leading-tight">Distribusi Dashboard</h1>
            <p className="text-[10px] text-[#544437]/70 font-semibold tracking-wide uppercase">Sistem Logistik Outlet</p>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-8">
          <button
            onClick={() => handleNavigate('/dashboard')}
            className="text-xs font-bold text-[#f29744] border-b-2 border-[#f29744] px-1 py-1 transition-all"
          >
            Dashboard
          </button>
          <button
            onClick={() => handleNavigate(isPusat ? '/distribusi/surat-jalan' : '/distribusi/terima')}
            className="text-xs font-semibold text-[#544437] hover:text-[#f29744] px-1 py-1 transition-colors"
          >
            {isPusat ? 'Pengiriman' : 'Penerimaan'}
          </button>
          <button
            onClick={() => handleNavigate('/stok')}
            className="text-xs font-semibold text-[#544437] hover:text-[#f29744] px-1 py-1 transition-colors"
          >
            Inventory
          </button>
          <button
            onClick={() => handleNavigate('/distribusi/riwayat')}
            className="text-xs font-semibold text-[#544437] hover:text-[#f29744] px-1 py-1 transition-colors"
          >
            Riwayat
          </button>
        </nav>

        {/* User Session Bar */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs font-bold text-[#1e1b15]">{outletStaff.name}</span>
            <span className="text-[9px] text-[#544437]/65 uppercase font-bold tracking-wider">
              {isPusat ? 'SPV PUSAT' : `CREW OUTLET ${outletStaff.outlet_id?.slice(0, 4).toUpperCase()}`}
            </span>
          </div>
          <div className="w-8 h-8 rounded-full border-2 border-[#f29744]/20 overflow-hidden bg-gray-100 shrink-0">
            <img
              alt="Avatar"
              className="w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuClSWeYAIWV7ZDxlQkI1_dE72mSnuNWQlTwtx_7q9v840mleVjHA6VoIPDdjdv5iud0LIZ6DOeS-TcpR2spRfXoDw8TOA2EVMzAPPHomfTAcb-IoxBmR-hAqAg9f60GQyOtCWYzzKjEUOrdqXmwNjif9TAPm1qGRVIZ5RwzVFPB4jZ6Jk76yK8T_1mQMMxTR9wxYDY-MY2f_Fv2QpqTCqDfccMKsQUQKcCIjXlcKoj5fi1XY2xlAUdfAvK98U_Y959XG1Hn3f65nG1_"
            />
          </div>
          <button
            onClick={signOut}
            className="px-3 py-1.5 border border-[#701604] text-[#701604] font-bold text-[10px] uppercase tracking-wider rounded-xl hover:bg-[#701604] hover:text-white transition-all active:scale-95 cursor-pointer"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-8">
        {/* Status Metrics Panel */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Status 1 */}
          <div className="bg-white rounded-2xl p-5 shadow-[0px_4px_20px_rgba(112,22,4,0.02)] border border-[#d9c2b2]/45 border-l-4 border-l-[#f29744] flex items-center justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-[#544437]/50 leading-none">Status Distribusi</p>
              <h3 className="text-sm font-extrabold text-[#701604] mt-2">Status: Ready / Aktif</h3>
            </div>
            <span className="text-2xl">🟢</span>
          </div>
          {/* Status 2 */}
          <div className="bg-white rounded-2xl p-5 shadow-[0px_4px_20px_rgba(112,22,4,0.02)] border border-[#d9c2b2]/45 border-l-4 border-l-[#701604] flex items-center justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-[#544437]/50 leading-none">Lingkungan Sistem</p>
              <h3 className="text-sm font-extrabold text-[#701604] mt-2">
                Mode: {process.env.NODE_ENV === 'production' ? 'Production' : 'Testing'}
              </h3>
            </div>
            <span className="text-2xl">💻</span>
          </div>
          {/* Status 3 */}
          <div className="bg-white rounded-2xl p-5 shadow-[0px_4px_20px_rgba(112,22,4,0.02)] border border-[#d9c2b2]/45 border-l-4 border-l-[#0a7d2c] flex items-center justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-[#544437]/50 leading-none">Build Manifest</p>
              <h3 className="text-sm font-extrabold text-[#0a7d2c] mt-2">Versi Fitur: M3</h3>
            </div>
            <span className="text-2xl">📦</span>
          </div>
        </section>

        {/* 12-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column - 8 Cols */}
          <div className="lg:col-span-8 space-y-6">
            {/* Recent Shipments Card */}
            <div className="bg-white rounded-2xl border border-[#d9c2b2]/45 shadow-[0px_4px_20px_rgba(112,22,4,0.02)] overflow-hidden">
              <div className="px-6 py-5 border-b border-[#701604]/10 flex justify-between items-center bg-white">
                <h2 className="font-extrabold text-sm text-[#701604] uppercase tracking-wide">Aktivitas Distribusi Terkini</h2>
                <span className="bg-[#faf2e9] border border-[#d9c2b2]/30 px-3 py-1 rounded-full text-[10px] font-bold text-[#701604]">
                  {listLoading ? '...' : suratJalanList.length} Total SJ
                </span>
              </div>

              {listLoading ? (
                <div className="p-8 text-center text-xs font-bold text-[#544437]/50 animate-pulse uppercase tracking-wider">
                  Memuat data aktivitas...
                </div>
              ) : recentShipments.length === 0 ? (
                <div className="p-12 text-center text-[#544437]/65">
                  <span className="text-3xl block mb-2">📭</span>
                  <p className="text-xs font-bold">Belum ada aktivitas surat jalan.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#d9c2b2]/20">
                  {recentShipments.map((sj, idx) => {
                    const statusInfo = STATUS_LABELS[sj.status] || { text: sj.status, style: 'bg-gray-100 text-gray-700' }
                    const formattedDate = new Date(sj.created_at).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })

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
                        className={`px-6 py-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-[#faf2e9] active:bg-[#f3e8dc]/60 transition-all ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-[#fff8f1]/30'
                        }`}
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-black text-[#701604] uppercase tracking-wide">
                              {sj.document_number || sj.id.substring(0, 8).toUpperCase()}
                            </span>
                            <span className="text-[10px] text-[#544437]/60 font-semibold">• {formattedDate}</span>
                          </div>
                          <p className="text-[11px] text-[#544437]/80 font-bold truncate">
                            {isPusat
                              ? `Tujuan: ${sj.outlets?.name || `Outlet ${sj.outlet_id.slice(0, 4).toUpperCase()}`}`
                              : 'Dari: Central Kitchen (Gudang Pusat)'}
                          </p>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border shrink-0 ${statusInfo.style}`}>
                          {statusInfo.text}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* M3 Foundation Checklist Card */}
            <div className="bg-white rounded-2xl border border-[#d9c2b2]/45 shadow-[0px_4px_20px_rgba(112,22,4,0.02)] overflow-hidden">
              <div className="px-6 py-5 border-b border-[#701604]/10 bg-white">
                <h2 className="font-extrabold text-sm text-[#701604] uppercase tracking-wide">M3 Foundation Checklist</h2>
              </div>
              <div className="divide-y divide-[#d9c2b2]/20">
                {[
                  { text: 'Monorepo setup (Yarn workspaces)', status: 'completed' },
                  { text: 'Design System package (@suka/design-system)', status: 'completed' },
                  { text: 'Offline Queue package (@suka/offline-queue)', status: 'completed' },
                  { text: 'Supabase schema (outlets, outlet_staff, dll)', status: 'completed' },
                  { text: 'Next.js app shells (absensi, stok, distribusi, portal)', status: 'completed' },
                  { text: 'Alur Pengiriman & Pembuatan Surat Jalan', status: 'completed' },
                  { text: 'Alur Penerimaan Parsial & Ledger Sinkronisasi', status: 'completed' },
                  { text: 'Autentikasi & RLS Keamanan DB', status: 'completed' },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className={`px-6 py-3.5 flex items-center justify-between gap-4 ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-[#fff8f1]/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-base text-green-700">✓</span>
                      <span className="text-xs text-[#1e1b15] font-semibold">{item.text}</span>
                    </div>
                    <span className="text-[9px] font-extrabold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-md uppercase tracking-wider">
                      Selesai
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - 4 Cols */}
          <div className="lg:col-span-4 space-y-6">
            {/* Quick Actions Grid */}
            <div className="bg-white rounded-2xl border border-[#d9c2b2]/45 p-6 shadow-[0px_4px_20px_rgba(112,22,4,0.02)]">
              <h2 className="font-extrabold text-xs text-[#544437]/70 uppercase tracking-widest pl-1 mb-4">Aksi Cepat</h2>
              <div className="grid grid-cols-2 gap-3">
                {isPusat ? (
                  <>
                    <button
                      onClick={() => handleNavigate('/distribusi/surat-jalan/new')}
                      className="bg-[#f29744] hover:bg-orange-600 active:bg-orange-700 text-white font-bold p-4 rounded-xl text-[10px] uppercase tracking-wider text-left shadow-sm flex flex-col justify-between h-24 active:scale-95 transition-all cursor-pointer"
                    >
                      <span className="text-xl">➕</span>
                      <span className="leading-tight">Buat Surat Jalan</span>
                    </button>
                    <button
                      onClick={() => handleNavigate('/distribusi/pengiriman')}
                      className="bg-white border border-[#d9c2b2]/45 text-[#544437] hover:bg-[#faf2e9] active:bg-[#eee7e0] font-bold p-4 rounded-xl text-[10px] uppercase tracking-wider text-left shadow-sm flex flex-col justify-between h-24 active:scale-95 transition-all cursor-pointer"
                    >
                      <span className="text-xl">🚚</span>
                      <span className="leading-tight">Pantau Pengiriman</span>
                    </button>
                    <button
                      onClick={() => handleNavigate('/distribusi/surat-jalan')}
                      className="bg-white border border-[#d9c2b2]/45 text-[#544437] hover:bg-[#faf2e9] active:bg-[#eee7e0] font-bold p-4 rounded-xl text-[10px] uppercase tracking-wider text-left shadow-sm flex flex-col justify-between h-24 active:scale-95 transition-all cursor-pointer"
                    >
                      <span className="text-xl">📋</span>
                      <span className="leading-tight">Daftar Surat Jalan</span>
                    </button>
                    <button
                      onClick={() => handleNavigate('/distribusi/riwayat')}
                      className="bg-white border border-[#d9c2b2]/45 text-[#544437] hover:bg-[#faf2e9] active:bg-[#eee7e0] font-bold p-4 rounded-xl text-[10px] uppercase tracking-wider text-left shadow-sm flex flex-col justify-between h-24 active:scale-95 transition-all cursor-pointer"
                    >
                      <span className="text-xl">📚</span>
                      <span className="leading-tight">Riwayat Pengiriman</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleNavigate('/distribusi/terima/scan')}
                      className="bg-[#f29744] hover:bg-orange-600 active:bg-orange-700 text-white font-bold p-4 rounded-xl text-[10px] uppercase tracking-wider text-left shadow-sm flex flex-col justify-between h-24 active:scale-95 transition-all cursor-pointer"
                    >
                      <span className="text-xl">📷</span>
                      <span className="leading-tight">Scan QR Penerimaan</span>
                    </button>
                    <button
                      onClick={() => handleNavigate('/distribusi/terima')}
                      className="bg-white border border-[#d9c2b2]/45 text-[#544437] hover:bg-[#faf2e9] active:bg-[#eee7e0] font-bold p-4 rounded-xl text-[10px] uppercase tracking-wider text-left shadow-sm flex flex-col justify-between h-24 active:scale-95 transition-all cursor-pointer"
                    >
                      <span className="text-xl">🚚</span>
                      <span className="leading-tight">Verifikasi Kiriman</span>
                    </button>
                    <button
                      onClick={() => handleNavigate('/distribusi/riwayat')}
                      className="bg-white border border-[#d9c2b2]/45 text-[#544437] hover:bg-[#faf2e9] active:bg-[#eee7e0] font-bold p-4 rounded-xl text-[10px] uppercase tracking-wider text-left shadow-sm flex flex-col justify-between h-24 active:scale-95 transition-all cursor-pointer"
                    >
                      <span className="text-xl">📋</span>
                      <span className="leading-tight">Riwayat Penerimaan</span>
                    </button>
                    <button
                      onClick={() => handleNavigate('/stok')}
                      className="bg-white border border-[#d9c2b2]/45 text-[#544437] hover:bg-[#faf2e9] active:bg-[#eee7e0] font-bold p-4 rounded-xl text-[10px] uppercase tracking-wider text-left shadow-sm flex flex-col justify-between h-24 active:scale-95 transition-all cursor-pointer"
                    >
                      <span className="text-xl">📊</span>
                      <span className="leading-tight">Cek Kartu Stok</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Decorative Banner */}
            <div className="relative rounded-2xl overflow-hidden h-40 group shadow-[0px_4px_20px_rgba(112,22,4,0.04)] border border-[#d9c2b2]/30">
              <div className="absolute inset-0 bg-gradient-to-tr from-[#701604] to-[#f29744] opacity-90 z-10"></div>
              <div
                className="absolute inset-0 z-0 bg-center bg-cover transition-transform duration-500 group-hover:scale-105"
                style={{
                  backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuDAmKn9l9Wi3npnGoD4aPiC_Vc3lZAHBNNYMlwi-GI7cXvY9viWqHeouoGg8VASf3h83PSGwOIJNVQYgkCDML3cI-NvlId-gKHQmw4nO_WXuMsPD2bQah8QEeTlmu1s740twY9AZOyAT-4Gn0iHN-KE_G7kG7LXfPONHBMRGfaWC40QNYs6rQrb5c7RcPZi8udoNNZrdW-XAg28a6mZWKhzp_oBVybBgUMy6fdyaX5Dxcaeshnle88NOljaXgeAhUNQyYieB8WLC7e7')`,
                }}
              ></div>
              <div className="relative z-20 h-full p-6 flex flex-col justify-end text-white">
                <p className="text-white/80 text-[9px] font-bold uppercase tracking-widest">Update Logistik</p>
                <h4 className="font-extrabold text-sm leading-snug mt-1">Optimasi Rute Distribusi Terpusat</h4>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      <BottomNav activeTab="dashboard" />
    </div>
  )
}
