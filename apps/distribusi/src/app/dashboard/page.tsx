'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getCrossAppUrl } from '@/lib/navigation';
import { BottomNav } from '@/components/distribusi/BottomNav';
import { useTerimaList } from '@/hooks/useTerimaList';
import { useRiwayatList } from '@/hooks/useRiwayatList';
import { usePengirimanList } from '@/hooks/usePengirimanList';

const formatLogTime = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function DashboardPage() {
  const router = useRouter();
  const { outletStaff, signOut, loading: authLoading } = useAuth();

  // Load real-time hooks
  const { data: terimaData, loading: terimaLoading } = useTerimaList();
  const { data: riwayatData, loading: riwayatLoading } = useRiwayatList();
  const { data: pengirimanData, loading: pengirimanLoading } = usePengirimanList();

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  const handleNavigate = (path: string) => {
    const resolvedUrl = getCrossAppUrl(path);
    if (resolvedUrl.startsWith('http')) {
      window.location.href = resolvedUrl;
    } else {
      router.push(resolvedUrl);
    }
  };

  if (authLoading || !outletStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fff8f1]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#701604] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-[#701604] font-bold uppercase tracking-wider text-xs">Loading Auth Session...</p>
        </div>
      </div>
    );
  }

  const isPusat = outletStaff.role === 'kepala_outlet';
  const dataLoading = isPusat ? pengirimanLoading : (terimaLoading || riwayatLoading);

  // Calculate statistics
  const draftSJs = pengirimanData.filter(sj => sj.status === 'draft');
  const activeShipments = pengirimanData.filter(sj => sj.status === 'dikirim' || sj.status === 'dikirim_lengkap');
  const awaitingPusatVerif = pengirimanData.filter(sj => sj.status === 'diterima_lengkap' || sj.status === 'diterima_sebagian');

  const pendingTerima = terimaData.filter(sj => sj.status === 'dikirim' || sj.status === 'dikirim_lengkap');
  const problemTerima = riwayatData.filter(sj => sj.has_problem);
  const todayStr = new Date().toDateString();
  const selesaiHariIni = riwayatData.filter(sj => new Date(sj.created_at).toDateString() === todayStr);

  const stats = isPusat
    ? [
        {
          label: 'Draft',
          value: draftSJs.length,
          icon: '📝',
          borderColor: 'border-amber-200/60',
          badgeBg: 'bg-amber-50',
          textColor: 'text-amber-700',
        },
        {
          label: 'Kirim',
          value: activeShipments.length,
          icon: '🚚',
          borderColor: 'border-blue-200/60',
          badgeBg: 'bg-blue-55',
          textColor: 'text-blue-700',
        },
        {
          label: 'Belum Verif',
          value: awaitingPusatVerif.length,
          icon: '👨‍💼',
          borderColor: 'border-orange-200/60',
          badgeBg: 'bg-orange-50',
          textColor: 'text-orange-700',
        },
      ]
    : [
        {
          label: 'Belum Verif',
          value: pendingTerima.length,
          icon: '🚚',
          borderColor: 'border-blue-200/60',
          badgeBg: 'bg-blue-55',
          textColor: 'text-blue-700',
        },
        {
          label: 'Selesai Hari Ini',
          value: selesaiHariIni.length,
          icon: '✓',
          borderColor: 'border-emerald-200/60',
          badgeBg: 'bg-emerald-50',
          textColor: 'text-emerald-700',
        },
        {
          label: 'Ada Selisih',
          value: problemTerima.length,
          icon: '⚠️',
          borderColor: 'border-red-200/60',
          badgeBg: 'bg-red-50',
          textColor: 'text-red-700',
        },
      ];

  // Compile live activity logs
  const liveLogs = (() => {
    if (isPusat) {
      return pengirimanData.slice(0, 5).map(sj => {
        let action = 'Surat Jalan';
        let badgeStyles = 'bg-gray-50 text-gray-700 border-gray-200';
        let statusLabel = sj.status;
        let icon = '📄';
        let iconBg = 'bg-gray-100 text-gray-700';

        if (sj.status === 'draft') {
          action = 'Surat Jalan Baru (Draft)';
          badgeStyles = 'bg-amber-50 text-amber-700 border-amber-200';
          icon = '📝';
          iconBg = 'bg-amber-50 text-amber-750';
        } else if (sj.status === 'dikirim' || sj.status === 'dikirim_lengkap') {
          action = 'Surat Jalan Dikirim';
          badgeStyles = 'bg-blue-50 text-blue-700 border-blue-200';
          statusLabel = 'Dikirim';
          icon = '🚚';
          iconBg = 'bg-blue-55 text-blue-750';
        } else if (sj.status === 'diterima_lengkap') {
          action = 'Diterima Cabang (Aman)';
          badgeStyles = 'bg-orange-50 text-orange-700 border-orange-200';
          statusLabel = 'Belum Verif';
          icon = '👨‍💼';
          iconBg = 'bg-orange-50 text-orange-700';
        } else if (sj.status === 'diterima_sebagian') {
          action = 'Diterima Cabang (Selisih)';
          badgeStyles = 'bg-red-50 text-red-755 border-red-200';
          statusLabel = 'Belum Verif';
          icon = '⚠️';
          iconBg = 'bg-red-50 text-red-700';
        } else if (sj.status === 'selesai') {
          action = 'Selesai & Terverifikasi';
          badgeStyles = 'bg-emerald-50 text-emerald-700 border-emerald-200';
          statusLabel = 'Selesai';
          icon = '📥';
          iconBg = 'bg-emerald-55 text-emerald-750';
        }

        return {
          id: sj.id,
          action,
          details: `Tujuan: ${sj.outlets?.name || 'Cabang'} • ${sj.document_number || sj.id.substring(0, 8).toUpperCase()}`,
          user: sj.status === 'draft' || sj.status === 'dikirim' ? 'Gudang Pusat' : 'Outlet Cabang',
          time: formatLogTime(sj.created_at),
          icon,
          iconBg,
          badgeStyles,
          statusLabel,
          link: `/distribusi/surat-jalan/${sj.id}`
        };
      });
    } else {
      const combined = [
        ...terimaData.map(d => ({ ...d, isPending: true })),
        ...riwayatData.map(d => ({ ...d, isPending: false })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return combined.slice(0, 5).map((sj: any) => {
        let action = 'Surat Jalan';
        let badgeStyles = 'bg-gray-50 text-gray-700 border-gray-200';
        let statusLabel = sj.status;
        let icon = '📄';
        let iconBg = 'bg-gray-100 text-gray-700';

        if (sj.isPending) {
          action = 'Kiriman Masuk (In-Transit)';
          badgeStyles = 'bg-blue-50 text-blue-700 border-blue-200';
          statusLabel = 'Dikirim';
          icon = '🚚';
          iconBg = 'bg-blue-55 text-blue-750';
        } else if (sj.status === 'diterima_lengkap') {
          action = 'Penerimaan Selesai';
          badgeStyles = 'bg-emerald-50 text-emerald-700 border-emerald-200';
          statusLabel = 'Aman';
          icon = '📥';
          iconBg = 'bg-emerald-55 text-emerald-750';
        } else {
          action = 'Penerimaan Diselisihkan';
          badgeStyles = 'bg-red-50 text-red-750 border-red-200';
          statusLabel = 'Selisih';
          icon = '⚠️';
          iconBg = 'bg-red-50 text-red-700';
        }

        return {
          id: sj.id,
          action,
          details: `Asal: ${sj.outlets?.name || 'Gudang Pusat'} • ${sj.document_number || sj.id.substring(0, 8).toUpperCase()}`,
          user: sj.isPending ? 'Kitchen Pusat' : 'Crew Cabang',
          time: formatLogTime(sj.created_at),
          icon,
          iconBg,
          badgeStyles,
          statusLabel,
          link: `/distribusi/surat-jalan/${sj.id}`
        };
      });
    }
  })();

  return (
    <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-32 flex flex-col font-sans">
      {/* Top Header App Bar */}
      <header className="sticky top-0 z-40 bg-[#fff8f1] border-b border-[#d9c2b2]/30 px-4 py-4 flex justify-between items-center shadow-[0_2px_8px_rgba(144,77,0,0.03)] flex-shrink-0">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo Suka Shawarma" className="h-9 w-auto object-contain shrink-0" />
          <div className="flex flex-col">
            <h1 className="font-bold text-sm text-[#701604] uppercase tracking-tight leading-tight">Distribusi Dashboard</h1>
            <p className="text-[10px] text-[#544437]/75 font-bold mt-0.5">Sistem Distribusi & Logistik</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-right">
            <div className="flex flex-col">
              <p className="text-[10px] sm:text-xs font-bold text-[#1e1b15] capitalize truncate max-w-[70px] sm:max-w-none leading-tight">
                {outletStaff.name || 'Staff Member'}
              </p>
              <p className="text-[8px] sm:text-[9px] text-[#544437]/70 font-semibold uppercase tracking-wider mt-0.5 leading-none">
                {outletStaff.role === 'kepala_outlet' ? 'SPV Pusat' : (outletStaff.role || 'Crew')}
              </p>
            </div>
            <div className="w-8 h-8 rounded-full border border-[#d9c2b2]/40 bg-white flex items-center justify-center text-sm shadow-sm shrink-0">
              {outletStaff.role === 'kepala_outlet' ? '👨‍💼' : '🧑‍🍳'}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="px-3 py-1 border border-[#ba1a1a]/30 hover:bg-[#ba1a1a] text-[#ba1a1a] hover:text-white rounded-lg font-bold text-[10px] transition-all active:scale-95 shadow-sm uppercase tracking-wider cursor-pointer"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full px-4 py-6 flex flex-col gap-6 flex-1">
        {/* Welcome Section */}
        <div className="bg-white rounded-2xl border border-[#d9c2b2]/45 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0px_4px_12px_rgba(144,77,0,0.03)]">
          <div>
            <h2 className="text-xs font-black text-[#701604] uppercase tracking-wider">
              Halo, {outletStaff.name?.split(' ')[0] || 'Staff'}!
            </h2>
            <p className="text-[10px] text-[#544437]/75 font-semibold mt-0.5">
              {isPusat 
                ? 'Selamat datang di panel Pusat. Kelola pengiriman dan pantau stok logistik cabang.'
                : 'Selamat datang di panel Cabang. Kelola dan verifikasi barang masuk yang datang.'
              }
            </p>
          </div>
        </div>

        {/* Real-time stats section */}
        {dataLoading ? (
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white rounded-2xl border border-[#d9c2b2]/20 p-4 animate-pulse h-20"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {stats.map((stat, i) => (
              <div key={i} className={`bg-white rounded-2xl border ${stat.borderColor} p-3 sm:p-4 flex flex-col justify-between shadow-[0px_4px_12px_rgba(144,77,0,0.02)]`}>
                <div className="flex justify-between items-center">
                  <span className="text-base sm:text-lg">{stat.icon}</span>
                  <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${stat.badgeBg} ${stat.textColor}`}>
                    {stat.label}
                  </span>
                </div>
                <p className="text-lg sm:text-xl font-extrabold text-[#1e1b15] mt-2 sm:mt-3 leading-none">{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Dynamic Grid Layout (Reordered on Mobile via CSS) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Quick Actions (4 columns) — order-1 (tampil di ATAS pada mobile) */}
          <aside className="lg:col-span-4 order-1 lg:order-2 flex flex-col gap-4 w-full">
            <h2 className="text-xs font-black text-[#544437]/50 uppercase tracking-widest px-1">Quick Actions</h2>
            
            <div className={`grid gap-3 ${isPusat ? 'grid-cols-2' : 'grid-cols-3'} lg:grid-cols-2`}>
              {/* Role Contextual Actions */}
              {!isPusat ? (
                <>
                  <button
                    onClick={() => handleNavigate('/distribusi/terima/scan')}
                    className="bg-white p-3 sm:p-4 rounded-2xl border border-[#d9c2b2]/45 hover:border-[#f29744]/45 shadow-[0px_4px_12px_rgba(144,77,0,0.03)] active:scale-[0.98] transition-all flex flex-col items-center gap-2 text-center cursor-pointer group"
                  >
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#f29744]/10 text-[#f29744] border border-[#f29744]/20 flex items-center justify-center text-base sm:text-lg group-hover:scale-105 transition-transform shadow-sm">
                      📷
                    </div>
                    <span className="text-[9px] font-bold text-[#1e1b15] uppercase tracking-wider leading-tight">Scan QR</span>
                  </button>

                  <button
                    onClick={() => handleNavigate('/distribusi/terima')}
                    className="bg-white p-3 sm:p-4 rounded-2xl border border-[#d9c2b2]/45 hover:border-[#f29744]/45 shadow-[0px_4px_12px_rgba(144,77,0,0.03)] active:scale-[0.98] transition-all flex flex-col items-center gap-2 text-center cursor-pointer group"
                  >
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center text-base sm:text-lg group-hover:scale-105 transition-transform shadow-sm">
                      📥
                    </div>
                    <span className="text-[9px] font-bold text-[#1e1b15] uppercase tracking-wider leading-tight">Inbox Terima</span>
                  </button>

                  <button
                    onClick={() => handleNavigate('/distribusi/riwayat')}
                    className="bg-white p-3 sm:p-4 rounded-2xl border border-[#d9c2b2]/45 hover:border-[#f29744]/45 shadow-[0px_4px_12px_rgba(144,77,0,0.03)] active:scale-[0.98] transition-all flex flex-col items-center gap-2 text-center cursor-pointer group"
                  >
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#faf2e9] text-[#701604] border border-[#d9c2b2]/30 flex items-center justify-center text-base sm:text-lg group-hover:scale-105 transition-transform shadow-sm">
                      📚
                    </div>
                    <span className="text-[9px] font-bold text-[#1e1b15] uppercase tracking-wider leading-tight">Riwayat</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleNavigate('/distribusi/surat-jalan/new')}
                    className="bg-white p-3 sm:p-4 rounded-2xl border border-[#d9c2b2]/45 hover:border-[#f29744]/45 shadow-[0px_4px_12px_rgba(144,77,0,0.03)] active:scale-[0.98] transition-all flex flex-col items-center gap-2 text-center cursor-pointer group"
                  >
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#f29744]/10 text-[#f29744] border border-[#f29744]/20 flex items-center justify-center text-base sm:text-lg group-hover:scale-105 transition-transform shadow-sm">
                      ➕
                    </div>
                    <span className="text-[9px] font-bold text-[#1e1b15] uppercase tracking-wider leading-tight">Buat SJ</span>
                  </button>

                  <button
                    onClick={() => handleNavigate('/distribusi/surat-jalan')}
                    className="bg-white p-3 sm:p-4 rounded-2xl border border-[#d9c2b2]/45 hover:border-[#f29744]/45 shadow-[0px_4px_12px_rgba(144,77,0,0.03)] active:scale-[0.98] transition-all flex flex-col items-center gap-2 text-center cursor-pointer group"
                  >
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#faf2e9] text-[#701604] border border-[#d9c2b2]/30 flex items-center justify-center text-base sm:text-lg group-hover:scale-105 transition-transform shadow-sm">
                      📚
                    </div>
                    <span className="text-[9px] font-bold text-[#1e1b15] uppercase tracking-wider leading-tight">Riwayat Kirim</span>
                  </button>
                </>
              )}
            </div>
          </aside>

          {/* Activity Log (8 columns) — order-2 (tampil di BAWAH pada mobile) */}
          <section className="lg:col-span-8 order-2 lg:order-1 flex flex-col gap-6 w-full">
            <div className="bg-white rounded-2xl border border-[#d9c2b2]/45 shadow-[0px_4px_12px_rgba(144,77,0,0.03)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#d9c2b2]/20 flex justify-between items-center bg-[#faf2e9]/20">
                <div className="flex flex-col">
                  <h2 className="text-xs font-black text-[#701604] uppercase tracking-wider">Aktivitas & Log Terbaru</h2>
                  <p className="text-[9px] text-[#544437]/60 font-bold uppercase mt-0.5">
                    {isPusat ? 'Riwayat aktivitas logistik pusat' : 'Riwayat penerimaan outlet Anda'}
                  </p>
                </div>
                <span className="bg-[#fff8f1] border border-[#d9c2b2]/40 px-2 py-0.5 rounded-md text-[8px] font-bold text-[#701604]">
                  {dataLoading ? 'Loading...' : `${liveLogs.length} Log Terakhir`}
                </span>
              </div>
              
              {dataLoading ? (
                <div className="divide-y divide-[#d9c2b2]/15">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="px-4 py-4 animate-pulse flex gap-3">
                      <div className="w-8 h-8 bg-gray-100 rounded-lg shrink-0"></div>
                      <div className="flex-1 space-y-2 py-1">
                        <div className="h-2.5 bg-gray-100 rounded w-1/3"></div>
                        <div className="h-2 bg-gray-100 rounded w-3/4"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : liveLogs.length === 0 ? (
                <div className="p-8 text-center text-[10px] text-[#544437]/45 font-bold italic uppercase">
                  Belum ada log aktivitas.
                </div>
              ) : (
                <div className="divide-y divide-[#d9c2b2]/15">
                  {liveLogs.map((activity) => (
                    <div
                      key={activity.id}
                      onClick={() => router.push(activity.link)}
                      className="px-4 py-3 flex items-center justify-between hover:bg-[#fff8f1]/30 transition-colors gap-3 cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 shadow-sm ${activity.iconBg}`}>
                          {activity.icon}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <p className="text-xs font-bold text-[#1e1b15] leading-tight truncate group-hover:text-[#701604] transition-colors">{activity.action}</p>
                          <p className="text-[10px] text-[#544437]/80 mt-0.5 leading-snug truncate sm:whitespace-normal">{activity.details}</p>
                          <p className="text-[8px] text-[#544437]/50 mt-1 font-semibold uppercase tracking-wider leading-none">
                            {activity.user} &bull; {activity.time}
                          </p>
                        </div>
                      </div>
                      <span className={`text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border shrink-0 ${activity.badgeStyles}`}>
                        {activity.statusLabel.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Bottom Navigation Bar */}
      <BottomNav activeTab="dashboard" />
    </div>
  );
}
