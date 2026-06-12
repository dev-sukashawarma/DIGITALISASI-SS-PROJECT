'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AuthGuard } from '@/components/common/AuthGuard';
import { getCrossAppUrl } from '@/lib/navigation';
import { Button } from '@suka/design-system';
import { useCrewMonitoringData } from '@/hooks/useMonitoringData';
import { useQuery } from '@tanstack/react-query';
import { fetchOpnameStatus } from '@/lib/queries/monitoring';

function DashboardHub() {
  const router = useRouter();
  const { outletStaff, signOut } = useAuth();

  const { data: crewData, isLoading } = useCrewMonitoringData();
  const isSPV = outletStaff?.role === 'spv';

  const { data: opnameStatuses } = useQuery({
    queryKey: ['monitoring', 'opnameStatus'],
    queryFn: fetchOpnameStatus,
  });

  const outletOpnameStatus = useMemo(() => {
    if (!opnameStatuses || !crewData?.outlet_id) return null;
    return opnameStatuses.find((s) => s.outlet_id === crewData.outlet_id) || null;
  }, [opnameStatuses, crewData]);

  const handleNavigate = (path: string) => {
    const resolvedUrl = getCrossAppUrl(path);
    if (resolvedUrl.startsWith('http')) {
      window.location.href = resolvedUrl;
    } else {
      router.push(resolvedUrl);
    }
  };

  const items = crewData?.items || [];

  const criticalItems = useMemo(() => {
    return items.filter((item) => item.status === 'below');
  }, [items]);

  const counts = useMemo(() => ({
    below: items.filter((i) => i.status === 'below').length,
    warning: items.filter((i) => i.status === 'warning').length,
    ok: items.filter((i) => i.status === 'ok').length,
  }), [items]);

  const alerts = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      desc: string;
      icon: string;
    }> = [];

    // Add critical items
    for (const item of criticalItems.slice(0, 3)) {
      list.push({
        id: `stock-${item.bahan_baku_id}`,
        title: item.item_name,
        desc: `${item.current_qty} ${item.satuan} / Batas ${item.threshold} ${item.satuan}`,
        icon: '📉',
      });
    }

    // Add overdue opname alert
    if (outletOpnameStatus?.is_overdue) {
      list.push({
        id: 'opname-overdue',
        title: 'Opname Jatuh Tempo',
        desc: outletOpnameStatus.days_since
          ? `Terakhir ${outletOpnameStatus.days_since} hari lalu (Overdue)`
          : 'Belum pernah opname',
        icon: '📅',
      });
    }

    return list;
  }, [criticalItems, outletOpnameStatus]);

  const menu = useMemo(() => {
    const baseMenu = [
      {
        href: '/stok/opname/new',
        label: 'Mulai Opname',
        desc: 'Opname Stok Harian',
        icon: '📋',
      },
      {
        href: '/stok/ledger/new',
        label: 'Entri Ledger',
        desc: 'Mutasi & Penyesuaian',
        icon: '📒',
      },
      {
        href: '/distribusi/terima',
        label: 'Terima Kiriman',
        desc: 'Verifikasi Barang Masuk',
        icon: '🚚',
      },
    ];

    if (isSPV) {
      baseMenu.push({
        href: '/stok/monitoring-live',
        label: 'Live Monitoring',
        desc: 'Papan Status Outlet',
        icon: '📊',
      });
    }

    return baseMenu;
  }, [isSPV]);

  return (
    <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] font-sans pb-32">
      {/* Header */}
      <header className="bg-[#fff8f1] border-b border-[#d9c2b2]/30 px-4 py-4 flex items-center justify-between shadow-[0_2px_8px_rgba(144,77,0,0.03)] sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-[#f29744] overflow-hidden bg-white flex items-center justify-center shrink-0 shadow-sm">
            {outletStaff?.ref_photo_url ? (
              <img src={outletStaff.ref_photo_url} alt="Staff Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="text-lg">🧑‍🍳</span>
            )}
          </div>
          <div className="flex flex-col">
            <h1 className="font-bold text-sm text-[#701604] uppercase tracking-tight leading-tight">Stock Monitoring</h1>
            <p className="text-[10px] text-[#544437]/75 font-bold mt-0.5">
              Outlet {crewData?.outlet_name || '...'} • {outletStaff?.role?.toUpperCase() || 'CREW'}: {outletStaff?.name || '...'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-[#d9c2b2]/30 text-[#f29744] active:scale-95 transition-all shadow-sm" title="Notifikasi">
            <span className="text-sm">🔔</span>
          </button>
          <button
            onClick={() => signOut()}
            className="px-3.5 py-1.5 rounded-xl bg-white border border-[#ba1a1a]/30 text-[#ba1a1a] hover:bg-[#ba1a1a]/5 text-xs font-bold uppercase tracking-wider active:scale-95 transition-all shadow-sm"
          >
            Keluar
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 pt-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Alerts & Actions */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Section: Critical Alerts */}
            {!isLoading && (
              <section>
                {alerts.length > 0 ? (
                  <div className="bg-white rounded-2xl border border-[#ba1a1a]/20 p-5 shadow-[0px_4px_12px_rgba(144,77,0,0.06)] flex flex-col gap-4">
                    <div className="flex items-center gap-2 text-[#ba1a1a]">
                      <span className="text-xl">⚠️</span>
                      <h2 className="font-bold text-sm uppercase tracking-wide">Peringatan Kritis ({alerts.length})</h2>
                    </div>
                    <div className="space-y-2">
                      {alerts.map((alert) => (
                        <div key={alert.id} className="flex justify-between items-center p-4 bg-[#ba1a1a]/5 rounded-xl border border-[#ba1a1a]/10">
                          <div className="flex flex-col">
                            <span className="font-bold text-xs text-[#1e1b15] uppercase tracking-wide leading-tight">{alert.title}</span>
                            <span className="text-[11px] text-[#544437]/75 mt-1 font-medium">
                              {alert.desc}
                            </span>
                          </div>
                          <span className="text-[#ba1a1a] font-bold text-lg leading-none">{alert.icon}</span>
                        </div>
                      ))}
                    </div>
                    <Button 
                      variant="primary" 
                      onClick={() => handleNavigate('/stok/opname/new')}
                      className="w-full bg-[#f29744] hover:bg-orange-600 active:bg-orange-700 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm text-xs uppercase tracking-wider active:scale-95"
                    >
                      Mulai Opname Baru
                    </Button>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-[#0a7d2c]/20 p-5 shadow-[0px_4px_12px_rgba(144,77,0,0.04)] flex flex-col items-center justify-center text-center gap-2 py-6">
                    <span className="text-2xl leading-none">🟢</span>
                    <div className="leading-tight">
                      <h2 className="font-bold text-xs text-[#0a7d2c] uppercase tracking-wide">Semua Aman</h2>
                      <p className="text-[10px] text-[#0a7d2c]/75 mt-1 font-bold uppercase tracking-wide">Ketersediaan bahan baku & jadwal opname terpenuhi</p>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Section: Quick Actions */}
            <section>
              <p className="text-[10px] font-black text-[#701604]/50 uppercase tracking-widest mb-3 px-1 lg:px-0">Aksi Cepat</p>
              <div className={`grid ${menu.length === 3 ? 'grid-cols-3' : 'grid-cols-2'} gap-2 lg:grid-cols-2 lg:gap-4`}>
                {menu.map((item) => (
                  <button
                    key={item.href}
                    onClick={() => handleNavigate(item.href)}
                    className="w-full bg-white border border-[#d9c2b2]/40 hover:border-[#f29744]/40 px-2 py-3.5 rounded-xl flex flex-col items-center justify-center text-center gap-2 shadow-[0px_4px_12px_rgba(144,77,0,0.03)] hover:shadow-md active:scale-95 transition-all cursor-pointer"
                  >
                    <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-[#f29744]/10 flex items-center justify-center text-lg lg:text-xl text-[#f29744] font-bold leading-none mb-0.5 shrink-0">
                      {item.icon}
                    </div>
                    <div className="space-y-0.5 w-full">
                      <p className="font-bold text-[#701604] text-[10px] lg:text-xs uppercase tracking-tight leading-tight w-full whitespace-normal text-center">{item.label}</p>
                      <p className="text-[8px] lg:text-[9px] text-[#544437]/60 font-bold uppercase w-full whitespace-normal leading-tight text-center">{item.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>

          </div>

          {/* Right Column: Stock Summary (ringkasan, list lengkap di /stok/monitoring) */}
          <div className="lg:col-span-7 space-y-6">

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-[#701604] text-xs uppercase tracking-wider">Ringkasan Stok</h2>
                <span className="text-[9px] font-black text-[#701604]/40 uppercase tracking-widest bg-[#701604]/5 px-2.5 py-1 rounded-lg">
                  Total: {items.length} bahan
                </span>
              </div>

              {/* 3 Stat Cards (tap → stok lengkap) */}
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => handleNavigate('/stok/monitoring')}
                  className="bg-white border-2 border-[#ba1a1a]/20 hover:border-[#ba1a1a]/50 rounded-2xl p-4 flex flex-col items-center gap-1 shadow-[0px_4px_12px_rgba(186,26,26,0.04)] active:scale-95 transition-all cursor-pointer"
                >
                  <span className="text-2xl lg:text-3xl font-black text-[#ba1a1a] leading-none">{isLoading ? '–' : counts.below}</span>
                  <span className="text-[9px] font-black text-[#ba1a1a] uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ba1a1a] animate-pulse"></span>Kritis
                  </span>
                </button>
                <button
                  onClick={() => handleNavigate('/stok/monitoring')}
                  className="bg-white border-2 border-[#f29744]/20 hover:border-[#f29744]/50 rounded-2xl p-4 flex flex-col items-center gap-1 shadow-[0px_4px_12px_rgba(242,151,68,0.04)] active:scale-95 transition-all cursor-pointer"
                >
                  <span className="text-2xl lg:text-3xl font-black text-[#f29744] leading-none">{isLoading ? '–' : counts.warning}</span>
                  <span className="text-[9px] font-black text-[#f29744] uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#f29744]"></span>Menipis
                  </span>
                </button>
                <button
                  onClick={() => handleNavigate('/stok/monitoring')}
                  className="bg-white border-2 border-[#0a7d2c]/20 hover:border-[#0a7d2c]/50 rounded-2xl p-4 flex flex-col items-center gap-1 shadow-[0px_4px_12px_rgba(10,125,44,0.04)] active:scale-95 transition-all cursor-pointer"
                >
                  <span className="text-2xl lg:text-3xl font-black text-[#0a7d2c] leading-none">{isLoading ? '–' : counts.ok}</span>
                  <span className="text-[9px] font-black text-[#0a7d2c] uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0a7d2c]"></span>Aman
                  </span>
                </button>
              </div>

              {/* CTA: lihat stok lengkap */}
              <button
                onClick={() => handleNavigate('/stok/monitoring')}
                className="w-full bg-white border border-[#d9c2b2]/45 hover:border-[#f29744]/45 rounded-2xl p-4 flex items-center justify-between shadow-[0px_4px_12px_rgba(144,77,0,0.03)] hover:shadow-md active:scale-[0.98] transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#701604]/10 text-[#701604] flex items-center justify-center text-lg group-hover:scale-105 transition-transform">📦</div>
                  <div className="text-left">
                    <p className="font-bold text-xs text-[#701604] uppercase tracking-wide leading-tight">Lihat Stok Lengkap</p>
                    <p className="text-[10px] text-[#544437]/60 font-bold mt-0.5">Saldo real-time semua bahan + search & filter</p>
                  </div>
                </div>
                <span className="text-[#f29744] text-lg font-bold group-hover:translate-x-1 transition-transform">→</span>
              </button>
            </section>

          </div>
        </div>
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-2 py-3 pb-safe bg-[#f5ede3] border-t border-[#d9c2b2]/40 shadow-2xl rounded-t-2xl lg:hidden">
        <button
          onClick={() => handleNavigate('/dashboard')}
          className="flex flex-col items-center justify-center bg-[#f29744] text-white rounded-xl px-5 py-2 active:scale-95 transition-all duration-200 cursor-pointer"
        >
          <span className="text-xl">📊</span>
          <span className="text-[9px] font-bold uppercase tracking-wider mt-1 leading-none">Dashboard</span>
        </button>
        <button
          onClick={() => handleNavigate('/stok/ledger')}
          className="flex flex-col items-center justify-center text-[#544437]/75 hover:text-[#701604] px-4 py-1 active:scale-95 transition-all cursor-pointer"
        >
          <span className="text-xl">📒</span>
          <span className="text-[9px] font-bold uppercase tracking-wider mt-1 leading-none">Ledger</span>
        </button>
        <button
          onClick={() => handleNavigate('/stok/opname')}
          className="flex flex-col items-center justify-center text-[#544437]/75 hover:text-[#701604] px-4 py-1 active:scale-95 transition-all cursor-pointer"
        >
          <span className="text-xl">📋</span>
          <span className="text-[9px] font-bold uppercase tracking-wider mt-1 leading-none">Opname</span>
        </button>
        <button
          onClick={() => handleNavigate('/distribusi/terima')}
          className="flex flex-col items-center justify-center text-[#544437]/75 hover:text-[#701604] px-4 py-1 active:scale-95 transition-all cursor-pointer"
        >
          <span className="text-xl">🚚</span>
          <span className="text-[9px] font-bold uppercase tracking-wider mt-1 leading-none">Terima</span>
        </button>
      </nav>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardHub />
    </AuthGuard>
  );
}
