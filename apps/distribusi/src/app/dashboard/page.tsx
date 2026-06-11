'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

interface ActivityItem {
  id: string;
  action: string;
  details: string;
  user: string;
  time: string;
  type: 'received' | 'shipped' | 'transfer' | 'draft';
  statusLabel: string;
}

const mockActivities: ActivityItem[] = [
  {
    id: '1',
    action: 'Penerimaan Surat Jalan Selesai',
    details: 'Verifikasi logistik masuk #SJ-8821 dengan 12 item',
    user: 'Budi Santoso (Crew)',
    time: '10 Menit Lalu',
    type: 'received',
    statusLabel: 'Diterima',
  },
  {
    id: '2',
    action: 'Surat Jalan Baru Dibuat',
    details: 'Pengiriman bahan baku ke Outlet Margonda #SJ-8824',
    user: 'Agus Wijaya (SPV)',
    time: '2 Jam Lalu',
    type: 'shipped',
    statusLabel: 'Dikirim',
  },
  {
    id: '3',
    action: 'Transfer Stok Darurat',
    details: '50 kg Daging Kebab ke Outlet Depok Baru',
    user: 'Anton Hermansyah (Kepala Outlet)',
    time: '4 Jam Lalu',
    type: 'transfer',
    statusLabel: 'Selesai',
  },
  {
    id: '4',
    action: 'Draft Surat Jalan Disimpan',
    details: 'Rencana pengiriman mingguan bahan kering #SJ-8825',
    user: 'Agus Wijaya (SPV)',
    time: '1 Hari Lalu',
    type: 'draft',
    statusLabel: 'Pending',
  },
  {
    id: '5',
    action: 'Penerimaan Diselisihkan',
    details: 'Verifikasi #SJ-8819 dengan 2 kg Daging Shawarma kurang',
    user: 'Siti Aminah (Crew)',
    time: '2 Hari Lalu',
    type: 'received',
    statusLabel: 'Selisih',
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const { outletStaff, signOut, loading } = useAuth();

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  if (loading || !outletStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fff8f1]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#701604] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-[#544437] font-bold uppercase tracking-wider text-xs">Loading Auth Session...</p>
        </div>
      </div>
    );
  }

  // Location subdescription helper
  const getSubLocation = (role: string) => {
    if (role === 'kepala_outlet') return 'Warehouse Command Center';
    return 'Outlet Operations Branch';
  };

  return (
    <div className="min-h-screen bg-[#fff8f1] text-[#1e1b17] flex flex-col font-sans">
      {/* Top Header App Bar */}
      <header className="sticky top-0 z-50 bg-white border-b border-[#701604]/10 px-6 py-4 flex justify-between items-center shadow-[0px_4px_20px_rgba(112,22,4,0.04)] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#f29744]/10 flex items-center justify-center text-2xl">
            🌯
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-black text-[#701604] leading-tight tracking-tight uppercase">
              Distribusi Dashboard
            </h1>
            <p className="text-[11px] font-bold text-[#57423d]/70 uppercase tracking-widest">
              Sistem Distribusi & Logistik
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 text-right">
            <div className="hidden sm:block">
              <p className="text-xs font-bold text-[#1e1b17] capitalize">{outletStaff.name || 'Staff Member'}</p>
              <p className="text-[10px] text-[#57423d] font-semibold uppercase tracking-wider mt-0.5">{outletStaff.role || 'Crew'}</p>
            </div>
            <div className="w-9 h-9 rounded-full border-2 border-[#f29744]/30 overflow-hidden bg-[#faf2e9] flex items-center justify-center text-lg shadow-sm">
              {outletStaff.role === 'kepala_outlet' ? '👨‍💼' : '🧑‍🍳'}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-1.5 border border-[#ba1a1a]/30 hover:bg-[#ba1a1a] text-[#ba1a1a] hover:text-white rounded-xl font-bold text-xs transition-all active:scale-95 shadow-xs"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full px-6 py-8 flex flex-col gap-8 flex-1">
        {/* Status Panels */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Ready Status Card */}
          <div className="bg-white rounded-xl p-5 shadow-[0px_4px_20px_rgba(112,22,4,0.03)] border border-[#d9c2b2]/30 border-l-4 border-l-[#f29744] flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#57423d]/60">Distribution Status</p>
              <h3 className="text-lg font-black text-[#701604] mt-1">Status: Ready</h3>
            </div>
            <span className="text-2xl text-[#f29744]">🟢</span>
          </div>

          {/* Testing Mode Card */}
          <div className="bg-white rounded-xl p-5 shadow-[0px_4px_20px_rgba(112,22,4,0.03)] border border-[#d9c2b2]/30 border-l-4 border-l-[#701604] flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#57423d]/60">System Environment</p>
              <h3 className="text-lg font-black text-[#701604] mt-1">Mode: Testing</h3>
            </div>
            <span className="text-2xl text-[#701604]">⚙️</span>
          </div>

          {/* Version Info Card */}
          <div className="bg-white rounded-xl p-5 shadow-[0px_4px_20px_rgba(112,22,4,0.03)] border border-[#d9c2b2]/30 border-l-4 border-l-blue-500 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#57423d]/60">Build Manifest</p>
              <h3 className="text-lg font-black text-blue-900 mt-1">Version: M0</h3>
            </div>
            <span className="text-2xl text-blue-500">📦</span>
          </div>
        </section>

        {/* Main Grid Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Recent Action / Activity (8 columns) */}
          <section className="lg:col-span-8 flex flex-col gap-6">
            <div className="bg-white rounded-xl border border-[#d9c2b2]/45 shadow-[0px_4px_20px_rgba(112,22,4,0.03)] overflow-hidden">
              <div className="px-6 py-5 border-b border-[#701604]/10 flex justify-between items-center bg-[#faf2e9]/40">
                <div className="flex flex-col">
                  <h2 className="text-sm font-black text-[#701604] uppercase tracking-wider">Aktivitas & Log Terbaru</h2>
                  <p className="text-[10px] text-[#57423d]/60 font-semibold uppercase mt-0.5">Riwayat aktivitas logistik outlet</p>
                </div>
                <span className="bg-[#fff8f1] border border-[#d9c2b2]/40 px-3 py-1 rounded-full text-[10px] font-bold text-[#701604]">
                  5 Log Terakhir
                </span>
              </div>
              <div className="divide-y divide-[#d9c2b2]/20">
                {mockActivities.map((activity) => {
                  let iconBg = '';
                  let icon = '';
                  let badgeStyles = '';

                  switch (activity.type) {
                    case 'received':
                      iconBg = activity.statusLabel === 'Selisih' ? 'bg-[#ba1a1a]/10 text-[#ba1a1a]' : 'bg-[#e2f8f0] text-[#0f7652]';
                      icon = activity.statusLabel === 'Selisih' ? '⚠️' : '📥';
                      badgeStyles = activity.statusLabel === 'Selisih'
                        ? 'bg-[#ba1a1a]/5 text-[#ba1a1a] border-[#ba1a1a]/20'
                        : 'bg-green-50 text-green-700 border-green-200';
                      break;
                    case 'shipped':
                      iconBg = 'bg-[#f29744]/10 text-[#f29744]';
                      icon = '🚚';
                      badgeStyles = 'bg-[#ffdcc2]/30 text-[#f29744] border-[#f29744]/20';
                      break;
                    case 'transfer':
                      iconBg = 'bg-blue-50 text-blue-700';
                      icon = '🔄';
                      badgeStyles = 'bg-blue-50 text-blue-700 border-blue-200';
                      break;
                    case 'draft':
                    default:
                      iconBg = 'bg-[#faf2e9] text-[#544437]';
                      icon = '📝';
                      badgeStyles = 'bg-gray-50 text-[#57423d] border-gray-200';
                      break;
                  }

                  return (
                    <div key={activity.id} className="px-6 py-4 flex items-center justify-between hover:bg-[#fff8f1]/30 transition-colors gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-sm shrink-0 ${iconBg}`}>
                          {icon}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <p className="text-sm font-bold text-[#1e1b17] leading-tight truncate">{activity.action}</p>
                          <p className="text-xs text-[#57423d]/80 mt-0.5 leading-snug truncate sm:whitespace-normal">{activity.details}</p>
                          <p className="text-[10px] text-[#57423d]/50 mt-1 font-semibold">
                            {activity.user} &bull; {activity.time}
                          </p>
                        </div>
                      </div>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border shrink-0 ${badgeStyles}`}>
                        {activity.statusLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>


          {/* Quick Actions & Updates Banner (4 columns) */}
          <aside className="lg:col-span-4 flex flex-col gap-6 w-full">
            <h2 className="text-xs font-black text-[#57423d] uppercase tracking-wider px-1">Quick Actions</h2>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Role Contextual actions rendering */}
              {(outletStaff.role === 'crew' || outletStaff.role === 'spv') && (
                <>
                  <Link
                    href="/distribusi/terima"
                    className="bg-white p-5 rounded-xl border border-[#d9c2b2]/45 hover:border-[#f29744]/60 shadow-[0px_4px_20px_rgba(112,22,4,0.03)] hover:shadow-[0px_6px_20px_rgba(112,22,4,0.07)] transition-all flex flex-col items-center gap-3.5 text-center active:scale-97 group"
                  >
                    <div className="w-12 h-12 rounded-full bg-blue-100/60 text-blue-800 flex items-center justify-center text-xl group-hover:scale-105 transition-transform shadow-xs">
                      📥
                    </div>
                    <span className="text-xs font-bold text-[#1e1b17] leading-snug">Inbox Penerimaan</span>
                  </Link>

                  <Link
                    href="/distribusi/riwayat"
                    className="bg-white p-5 rounded-xl border border-[#d9c2b2]/45 hover:border-[#f29744]/60 shadow-[0px_4px_20px_rgba(112,22,4,0.03)] hover:shadow-[0px_6px_20px_rgba(112,22,4,0.07)] transition-all flex flex-col items-center gap-3.5 text-center active:scale-97 group"
                  >
                    <div className="w-12 h-12 rounded-full bg-[#faf2e9] text-[#544437] flex items-center justify-center text-xl group-hover:scale-105 transition-transform shadow-xs">
                      📚
                    </div>
                    <span className="text-xs font-bold text-[#1e1b17] leading-snug">Riwayat Logistik</span>
                  </Link>
                </>
              )}

              {outletStaff.role === 'kepala_outlet' && (
                <>
                  <Link
                    href="/distribusi/surat-jalan/new"
                    className="bg-white p-5 rounded-xl border border-[#d9c2b2]/45 hover:border-[#f29744]/60 shadow-[0px_4px_20px_rgba(112,22,4,0.03)] hover:shadow-[0px_6px_20px_rgba(112,22,4,0.07)] transition-all flex flex-col items-center gap-3.5 text-center active:scale-97 group"
                  >
                    <div className="w-12 h-12 rounded-full bg-[#f29744]/10 text-[#f29744] flex items-center justify-center text-xl group-hover:scale-105 transition-transform shadow-xs">
                      ➕
                    </div>
                    <span className="text-xs font-bold text-[#1e1b17] leading-snug">Buat Surat Jalan</span>
                  </Link>

                  <Link
                    href="/distribusi/pengiriman"
                    className="bg-white p-5 rounded-xl border border-[#d9c2b2]/45 hover:border-[#f29744]/60 shadow-[0px_4px_20px_rgba(112,22,4,0.03)] hover:shadow-[0px_6px_20px_rgba(112,22,4,0.07)] transition-all flex flex-col items-center gap-3.5 text-center active:scale-97 group"
                  >
                    <div className="w-12 h-12 rounded-full bg-[#701604]/10 text-[#701604] flex items-center justify-center text-xl group-hover:scale-105 transition-transform shadow-xs">
                      🚚
                    </div>
                    <span className="text-xs font-bold text-[#1e1b17] leading-snug">Pantau Pengiriman</span>
                  </Link>
                </>
              )}
            </div>

            {/* Bottom Graphic Banner */}
            <div className="relative rounded-xl overflow-hidden mt-1 h-36 group shadow-md border border-[#d9c2b2]/30">
              <div className="absolute inset-0 bg-gradient-to-tr from-[#701604] to-[#f29744] opacity-90 z-10"></div>
              <div className="absolute inset-0 z-0 bg-[#701604] bg-opacity-40 bg-center bg-cover"></div>
              <div className="relative z-20 h-full p-5 flex flex-col justify-end">
                <p className="text-white/70 text-[9px] font-bold uppercase tracking-widest">Update Logistik</p>
                <h4 className="text-white font-extrabold text-sm leading-snug mt-1">Optimasi Rute Distribusi Terpusat</h4>
                <p className="text-white/80 text-[10px] mt-0.5">{getSubLocation(outletStaff.role)}</p>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
