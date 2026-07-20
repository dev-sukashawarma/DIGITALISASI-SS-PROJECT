// @ts-nocheck
'use client'

import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@suka/auth'
import { useSuratJalanList } from '@/hooks/useSuratJalan'
import { BottomNav } from '@/components/distribusi/BottomNav'
import { useRouter } from 'next/navigation'
import { getCrossAppUrl } from '@/lib/navigation'
import { Avatar } from '@suka/design-system'
import { FileText, ArrowLeftRight, CheckCircle2, Plus, Navigation, ListTodo, History, Layers, ChevronRight, LogOut, ShieldAlert, QrCode } from 'lucide-react'

export default function DashboardPage() {
  const router = useRouter()
  const { outletStaff, loading: authLoading, signOut } = useAuth()
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const mobileDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      const isOutsideDesktop = dropdownRef.current ? !dropdownRef.current.contains(target) : true
      const isOutsideMobile = mobileDropdownRef.current ? !mobileDropdownRef.current.contains(target) : true
      
      if (isOutsideDesktop && isOutsideMobile) {
        setShowDropdown(false)
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown])

  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com'
  let resolvedPortalUrl = portalUrl
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    resolvedPortalUrl = 'http://localhost:3010'
  }

  // Load shipments for metrics
  const isPusat = ['leader', 'kitchen', 'admin', 'admin_hr'].includes(outletStaff?.role || '')
  const outletIdFilter = isPusat ? undefined : (outletStaff?.outlet_id ?? undefined)

  const { suratJalanList, loading: listLoading } = useSuratJalanList(outletIdFilter)

  if (authLoading) {
    return (
      <div className="flex flex-col min-h-screen justify-center items-center bg-[#fff8f1] text-[#701604] font-medium bg-grain relative">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#701604] mb-4"></div>
        <p className="text-xs font-bold uppercase tracking-wider animate-pulse">Memuat Profil Staff...</p>
      </div>
    )
  }

  if (!outletStaff) {
    return (
      <div className="min-h-screen bg-[#fff8f1] flex items-center justify-center p-4 bg-grain">
        <div className="bg-red-50/80 border border-red-200/50 backdrop-blur-md p-6 rounded-2xl flex items-center gap-3.5 max-w-md shadow-lg shadow-red-900/5">
          <ShieldAlert className="text-red-600 shrink-0" size={24} />
          <div>
            <h3 className="font-extrabold text-sm text-red-900 uppercase tracking-wide">Akses Ditolak</h3>
            <p className="text-xs text-red-700 font-semibold mt-1">Sesi login tidak ditemukan. Silakan masuk kembali melalui portal.</p>
          </div>
        </div>
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
    draft: { text: 'Draft', style: 'bg-amber-50 text-amber-700 border-amber-200' },
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
    <div className="min-h-screen bg-[#fff8f1]/50 text-[#1e1b15] pb-32 relative overflow-hidden bg-grain select-none">
      {/* Drifting Background Blobs */}
      <div className="absolute top-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-suka-orange/5 blur-[120px] pointer-events-none z-0 animate-blob-1" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-suka-brown/5 blur-[120px] pointer-events-none z-0 animate-blob-2" />

      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-suka-brown/10 px-4 sm:px-6 py-3 md:py-4 flex flex-col md:flex-row md:justify-between md:items-center shadow-sm relative gap-3 md:gap-0">
        {/* Row 1: Logo & Title (left) & Avatar (right on mobile) */}
        <div className="flex justify-between items-center w-full md:w-auto">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-white rounded-xl sm:rounded-2xl p-1 shadow-sm border border-suka-orange/10 flex items-center justify-center shrink-0">
              <img
                alt="Suka Shawarma Logo"
                className="w-full h-full object-contain"
                src="/logo.png"
              />
            </div>
            <div className="flex flex-col">
              <h1 className="font-black text-sm sm:text-base text-suka-brown leading-tight font-display tracking-wide">
                Distribusi Dashboard
              </h1>
              <p className="text-[10px] text-suka-gray-500 font-extrabold tracking-widest uppercase mt-0.5">
                Sistem Logistik Outlet
              </p>
            </div>
          </div>
          {/* Avatar visible on mobile right side only */}
          <div className="md:hidden relative" ref={mobileDropdownRef}>
            <button 
              onClick={() => setShowDropdown(!showDropdown)}
              className="w-8 h-8 rounded-full ring-2 ring-suka-orange/20 overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center cursor-pointer transition-transform active:scale-95"
            >
              <Avatar name={outletStaff.name} size={32} />
            </button>
            {showDropdown && (
              <div className="absolute right-0 top-full mt-2 w-36 bg-white rounded-xl shadow-lg border border-suka-brown/10 py-1.5 z-50 flex flex-col">
                <a href={resolvedPortalUrl} className="px-4 py-2.5 text-xs font-bold text-[#544437] hover:bg-[#faf2e9] transition-colors">
                  ← Portal Utama
                </a>
                <button onClick={signOut} className="px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 text-left flex items-center gap-2 transition-colors">
                  <LogOut size={12} /> Keluar
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-4 xl:gap-8">
          <button
            onClick={() => handleNavigate('/dashboard')}
            className="text-xs font-extrabold text-suka-orange border-b-2 border-suka-orange px-1 py-1 transition-all cursor-pointer"
          >
            Dashboard
          </button>
          <button
            onClick={() => handleNavigate(isPusat ? '/distribusi/surat-jalan' : '/distribusi/terima')}
            className="text-xs font-bold text-suka-gray-600 hover:text-suka-orange px-1 py-1 transition-colors cursor-pointer"
          >
            {isPusat ? 'Pengiriman' : 'Penerimaan'}
          </button>
          <button
            onClick={() => handleNavigate('/distribusi/riwayat')}
            className="text-xs font-bold text-suka-gray-600 hover:text-suka-orange px-1 py-1 transition-colors cursor-pointer"
          >
            Riwayat
          </button>
        </nav>

        {/* User Session Bar - Stacks below on mobile, inline on desktop */}
        <div className="flex items-center justify-between w-full md:w-auto gap-3 border-t md:border-t-0 border-suka-brown/5 pt-2.5 md:pt-0">
          <div className="flex flex-col text-left md:text-right">
            <span className="text-xs font-extrabold text-[#1e1b15]">{outletStaff.name}</span>
            <span className="text-[10px] text-suka-orange font-bold uppercase tracking-wider mt-0.5">
              {isPusat ? 'SPV PUSAT' : (outletStaff.outlets?.name ?? 'OUTLET')}
            </span>
          </div>

          <div className="hidden md:block relative" ref={dropdownRef}>
            <button 
              onClick={() => setShowDropdown(!showDropdown)}
              className="w-9 h-9 rounded-full ring-2 ring-suka-orange/20 overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center cursor-pointer transition-transform active:scale-95"
            >
              <Avatar name={outletStaff.name} size={36} />
            </button>
            {showDropdown && (
              <div className="absolute right-0 top-full mt-2 w-40 bg-white rounded-xl shadow-lg border border-suka-brown/10 py-1.5 z-50 flex flex-col">
                <a href={resolvedPortalUrl} className="px-4 py-2.5 text-xs font-bold text-[#544437] hover:bg-[#faf2e9] transition-colors">
                  ← Portal Utama
                </a>
                <button onClick={signOut} className="px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 text-left flex items-center gap-2 transition-colors">
                  <LogOut size={12} /> Keluar
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6 relative z-10">
        
        {/* Status Metrics Panel */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Status 1 */}
          <div className="bg-white/70 backdrop-blur-md rounded-2xl p-5 shadow-sm border border-suka-orange/10 border-l-4 border-l-suka-orange flex items-center justify-between hover:shadow-md transition-all duration-300">
            <div className="space-y-1">
              <p className="text-[9px] font-extrabold uppercase tracking-widest text-suka-gray-500 leading-none">
                {isPusat ? 'Draft SJ (Siap Kirim)' : 'Kiriman Menuju Outlet'}
              </p>
              <h3 className="text-xl font-black text-suka-brown pt-1">
                {listLoading ? '...' : (isPusat ? drafts.length : inTransit.length)} <span className="text-xs font-bold text-suka-gray-500">Dokumen</span>
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-suka-orange/10 text-suka-orange flex items-center justify-center">
              {isPusat ? <FileText size={20} /> : <Navigation size={20} />}
            </div>
          </div>
          
          {/* Status 2 */}
          <div className="bg-white/70 backdrop-blur-md rounded-2xl p-5 shadow-sm border border-suka-orange/10 border-l-4 border-l-suka-brown flex items-center justify-between hover:shadow-md transition-all duration-300">
            <div className="space-y-1">
              <p className="text-[9px] font-extrabold uppercase tracking-widest text-suka-gray-500 leading-none">
                {isPusat ? 'Dalam Transit (Aktif)' : 'Selesai Diverifikasi'}
              </p>
              <h3 className="text-xl font-black text-suka-brown pt-1">
                {listLoading ? '...' : (isPusat ? inTransit.length : completed.length)} <span className="text-xs font-bold text-suka-gray-500">Dokumen</span>
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-suka-brown/10 text-suka-brown flex items-center justify-center">
              <ArrowLeftRight size={20} />
            </div>
          </div>
          
          {/* Status 3 */}
          <div className="bg-white/70 backdrop-blur-md rounded-2xl p-5 shadow-sm border border-suka-orange/10 border-l-4 border-l-suka-green flex items-center justify-between hover:shadow-md transition-all duration-300">
            <div className="space-y-1">
              <p className="text-[9px] font-extrabold uppercase tracking-widest text-suka-gray-500 leading-none">
                {isPusat ? 'Pengiriman Selesai' : 'Total Dokumen'}
              </p>
              <h3 className="text-xl font-black text-suka-green pt-1">
                {listLoading ? '...' : (isPusat ? completed.length : suratJalanList.length)} <span className="text-xs font-bold text-suka-gray-500">Dokumen</span>
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-suka-green/10 text-suka-green flex items-center justify-center">
              <CheckCircle2 size={20} />
            </div>
          </div>
        </section>


        {/* 12-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column - 8 Cols */}
          <div className="lg:col-span-8 space-y-6">
            {/* Recent Shipments Card */}
            <div className="bg-white/70 backdrop-blur-md rounded-2xl border border-suka-orange/10 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-suka-brown/10 flex justify-between items-center bg-white/50">
                <h2 className="font-extrabold text-sm text-suka-brown uppercase tracking-wider font-display">Aktivitas Distribusi Terkini</h2>
                <span className="bg-suka-orange/10 border border-suka-orange/20 px-3 py-1 rounded-full text-[10px] font-extrabold text-suka-orange uppercase">
                  {listLoading ? '...' : `${suratJalanList.length} Total`}
                </span>
              </div>

              {listLoading ? (
                <div className="p-12 text-center text-xs font-bold text-suka-gray-400 animate-pulse uppercase tracking-wider">
                  Memuat data aktivitas...
                </div>
              ) : recentShipments.length === 0 ? (
                <div className="p-12 text-center text-suka-gray-500">
                  <span className="text-3xl block mb-2">📭</span>
                  <p className="text-xs font-bold uppercase tracking-wider">Belum ada aktivitas surat jalan.</p>
                </div>
              ) : (
                <div className="divide-y divide-suka-orange/10">
                  {recentShipments.map((sj, idx) => {
                    const statusInfo = STATUS_LABELS[sj.status] || { text: sj.status, style: 'bg-gray-100 text-gray-700' }
                    const formattedDate = new Date(sj.created_at).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                    const sudahSelesai = ['selesai', 'diterima_lengkap', 'diterima_sebagian'].includes(sj.status)
                    const isClickable = isPusat || !sudahSelesai

                    return (
                      <div
                        key={sj.id}
                        onClick={isClickable ? () => {
                          if (isPusat) {
                            router.push(`/distribusi/surat-jalan/${sj.id}`)
                          } else {
                            router.push(`/distribusi/terima/${sj.id}`)
                          }
                        } : undefined}
                        className={`px-6 py-4 flex items-center justify-between gap-4 transition-all duration-200 ${
                          isClickable
                            ? 'cursor-pointer hover:bg-suka-orange/5 active:bg-suka-orange/10 group'
                            : 'cursor-default opacity-70'
                        } ${idx % 2 === 0 ? 'bg-white/40' : 'bg-transparent'}`}
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-black text-suka-brown uppercase tracking-wide group-hover:text-suka-orange transition-colors">
                              {sj.document_number || sj.id.substring(0, 8).toUpperCase()}
                            </span>
                            <span className="text-[10px] text-suka-gray-400 font-bold">• {formattedDate}</span>
                          </div>
                          <p className="text-[11px] text-suka-gray-600 font-bold truncate">
                            {isPusat
                              ? `Tujuan: ${sj.outlets?.name || `Outlet ${sj.outlet_id.slice(0, 4).toUpperCase()}`}`
                              : 'Dari: Central Kitchen (Gudang Pusat)'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${statusInfo.style}`}>
                            {statusInfo.text}
                          </span>
                          {isClickable && (
                            <ChevronRight size={14} className="text-suka-gray-400 group-hover:translate-x-0.5 transition-transform duration-200" />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - 4 Cols */}
          <div className="lg:col-span-4 space-y-6">
            {/* SOP & Operational Guide Card */}
            <div className="bg-white/70 backdrop-blur-md rounded-2xl border border-suka-orange/10 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-suka-brown/10 bg-white/50">
                <h2 className="font-extrabold text-sm text-suka-brown uppercase tracking-wider font-display">
                  {isPusat ? 'SOP & Alur Kerja Gudang Pusat' : 'SOP & Panduan Penerimaan Outlet'}
                </h2>
              </div>
              <div className="divide-y divide-suka-orange/10">
                {isPusat ? (
                  <>
                    <div className="px-6 py-4 flex items-start gap-4 bg-white/40">
                      <span className="text-xs font-extrabold text-suka-orange bg-suka-orange/10 w-6 h-6 flex items-center justify-center rounded-lg shrink-0 border border-suka-orange/20">1</span>
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-suka-ink">Cek Pengajuan Permintaan</h4>
                        <p className="text-[10px] text-suka-gray-500 font-semibold leading-relaxed">Lihat daftar permintaan bahan baku masuk dari outlet di menu stok yang sudah disetujui supervisor.</p>
                      </div>
                    </div>
                    <div className="px-6 py-4 flex items-start gap-4 bg-transparent">
                      <span className="text-xs font-extrabold text-suka-orange bg-suka-orange/10 w-6 h-6 flex items-center justify-center rounded-lg shrink-0 border border-suka-orange/20">2</span>
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-suka-ink">Buat Surat Jalan Baru</h4>
                        <p className="text-[10px] text-suka-gray-500 font-semibold leading-relaxed">Klik tombol "Buat Surat Jalan" untuk mengisi Qty barang yang siap dikirimkan secara fisik.</p>
                      </div>
                    </div>
                    <div className="px-6 py-4 flex items-start gap-4 bg-white/40">
                      <span className="text-xs font-extrabold text-suka-orange bg-suka-orange/10 w-6 h-6 flex items-center justify-center rounded-lg shrink-0 border border-suka-orange/20">3</span>
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-suka-ink">Serah Terima & Cetak QR</h4>
                        <p className="text-[10px] text-suka-gray-500 font-semibold leading-relaxed">Tanda tangani Surat Jalan digital, lalu serahkan fisik cetak QR Code beserta barang ke supir/kurir.</p>
                      </div>
                    </div>
                    <div className="px-6 py-4 flex items-start gap-4 bg-transparent">
                      <span className="text-xs font-extrabold text-suka-orange bg-suka-orange/10 w-6 h-6 flex items-center justify-center rounded-lg shrink-0 border border-suka-orange/20">4</span>
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-suka-ink">Pantau Status Pengiriman</h4>
                        <p className="text-[10px] text-suka-gray-500 font-semibold leading-relaxed">Monitor pengiriman hingga kurir tiba dan outlet menyelesaikan verifikasi penerimaan barang.</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="px-6 py-4 flex items-start gap-4 bg-white/40">
                      <span className="text-xs font-extrabold text-suka-orange bg-suka-orange/10 w-6 h-6 flex items-center justify-center rounded-lg shrink-0 border border-suka-orange/20">1</span>
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-suka-ink">Scan QR Code Kedatangan</h4>
                        <p className="text-[10px] text-suka-gray-500 font-semibold leading-relaxed">Gunakan menu "Scan QR Penerimaan" saat kurir tiba dengan logistik untuk membuka form verifikasi.</p>
                      </div>
                    </div>
                    <div className="px-6 py-4 flex items-start gap-4 bg-transparent">
                      <span className="text-xs font-extrabold text-suka-orange bg-suka-orange/10 w-6 h-6 flex items-center justify-center rounded-lg shrink-0 border border-suka-orange/20">2</span>
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-suka-ink">Verifikasi Kuantitas & Kondisi</h4>
                        <p className="text-[10px] text-suka-gray-500 font-semibold leading-relaxed">Hitung fisik barang. Jika ada selisih/rusak, masukkan Qty riil dan tandai kondisi "Jelek" beserta catatannya.</p>
                      </div>
                    </div>
                    <div className="px-6 py-4 flex items-start gap-4 bg-white/40">
                      <span className="text-xs font-extrabold text-suka-orange bg-suka-orange/10 w-6 h-6 flex items-center justify-center rounded-lg shrink-0 border border-suka-orange/20">3</span>
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-suka-ink">Tanda Tangan Penerima & Supir</h4>
                        <p className="text-[10px] text-suka-gray-500 font-semibold leading-relaxed">Bubuhkan tanda tangan digital penerima dan supir pengirim sebagai bukti serah terima resmi.</p>
                      </div>
                    </div>
                    <div className="px-6 py-4 flex items-start gap-4 bg-transparent">
                      <span className="text-xs font-extrabold text-suka-orange bg-suka-orange/10 w-6 h-6 flex items-center justify-center rounded-lg shrink-0 border border-suka-orange/20">4</span>
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-suka-ink">Pembaruan Kartu Stok Otomatis</h4>
                        <p className="text-[10px] text-suka-gray-500 font-semibold leading-relaxed">Sistem akan memotong/menambah saldo kartu stok outlet Anda secara real-time setelah verifikasi difinalisasi.</p>
                      </div>
                    </div>
                  </>
                )}
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
