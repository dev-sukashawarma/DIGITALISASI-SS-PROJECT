'use client';

import { useState, useMemo } from 'react';
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
  const [activeTab, setActiveTab] = useState<'all' | 'below' | 'warning' | 'ok'>('all');
  const [searchTerm, setSearchTerm] = useState('');

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

  const getStorageLocation = (kategori: string): string => {
    const kat = (kategori || '').toLowerCase();
    if (kat === 'protein') return 'Frozen Storage';
    if (['sayur', 'saus', 'minuman'].includes(kat)) return 'Chilled Storage';
    if (['roti', 'bumbu', 'kemasan'].includes(kat)) return 'Dry Storage';
    return 'Dry Storage';
  };

  const items = crewData?.items || [];

  const criticalItems = useMemo(() => {
    return items.filter((item) => item.status === 'below');
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = item.item_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTab = activeTab === 'all' || item.status === activeTab;
      return matchesSearch && matchesTab;
    });
  }, [items, searchTerm, activeTab]);

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
              <div className="flex gap-4 overflow-x-auto pb-3 -mx-4 px-4 no-scrollbar lg:grid lg:grid-cols-2 lg:gap-4 lg:overflow-x-visible lg:pb-0 lg:mx-0 lg:px-0">
                {menu.map((item) => (
                  <button
                    key={item.href}
                    onClick={() => handleNavigate(item.href)}
                    className="flex-shrink-0 w-32 lg:w-full bg-white border border-[#d9c2b2]/40 hover:border-[#f29744]/40 p-4 rounded-xl flex flex-col items-center justify-center text-center gap-2.5 shadow-[0px_4px_12px_rgba(144,77,0,0.03)] hover:shadow-md active:scale-95 transition-all cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-full bg-[#f29744]/10 flex items-center justify-center text-xl text-[#f29744] font-bold leading-none mb-1">
                      {item.icon}
                    </div>
                    <div className="space-y-1 w-full">
                      <p className="font-bold text-[#701604] text-xs uppercase tracking-tight leading-tight w-full whitespace-normal text-center">{item.label}</p>
                      <p className="text-[9px] text-[#544437]/60 font-bold uppercase w-full whitespace-normal leading-tight text-center">{item.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>

          </div>

          {/* Right Column: Real-time Stock Balance */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Section: Real-time Stock Balance */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-[#701604] text-xs uppercase tracking-wider">Saldo Stok Real-time</h2>
                <span className="text-[9px] font-black text-[#701604]/40 uppercase tracking-widest bg-[#701604]/5 px-2.5 py-1 rounded-lg">
                  Total: {items.length} bahan
                </span>
              </div>

              {/* Search and Filter Tabs */}
              <div className="bg-white border border-[#d9c2b2]/40 rounded-2xl p-3 shadow-[0px_4px_12px_rgba(144,77,0,0.03)] space-y-3">
                {/* Search Input */}
                <div className="relative">
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 pl-9 rounded-xl border border-[#d9c2b2]/40 bg-[#fff8f1]/30 focus:outline-none focus:ring-1 focus:ring-[#f29744] focus:border-[#f29744] text-xs text-[#1e1b15] placeholder-[#544437]/40 font-medium transition-all"
                    placeholder="Cari bahan..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#544437]/40 text-xs">🔍</span>
                </div>

                {/* Filter Pills */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setActiveTab('all')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border cursor-pointer ${
                      activeTab === 'all'
                        ? 'bg-[#701604] border-[#701604] text-white shadow-sm'
                        : 'bg-white border-[#d9c2b2]/40 text-[#544437]/80 hover:bg-[#fff8f1]/50'
                    }`}
                  >
                    Semua
                  </button>
                  <button
                    onClick={() => setActiveTab('below')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border cursor-pointer ${
                      activeTab === 'below'
                        ? 'bg-[#ba1a1a] border-[#ba1a1a] text-white shadow-sm'
                        : 'bg-white border-[#ba1a1a]/15 text-[#ba1a1a] hover:bg-[#ba1a1a]/5'
                    }`}
                  >
                    Kritis ({items.filter((i) => i.status === 'below').length})
                  </button>
                  <button
                    onClick={() => setActiveTab('warning')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border cursor-pointer ${
                      activeTab === 'warning'
                        ? 'bg-[#f29744] border-[#f29744] text-white shadow-sm'
                        : 'bg-white border-[#f29744]/20 text-[#f29744] hover:bg-[#f29744]/5'
                    }`}
                  >
                    Warning ({items.filter((i) => i.status === 'warning').length})
                  </button>
                  <button
                    onClick={() => setActiveTab('ok')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border cursor-pointer ${
                      activeTab === 'ok'
                        ? 'bg-[#0a7d2c] border-[#0a7d2c] text-white shadow-sm'
                        : 'bg-white border-[#0a7d2c]/20 text-[#0a7d2c] hover:bg-[#0a7d2c]/5'
                    }`}
                  >
                    Ready ({items.filter((i) => i.status === 'ok').length})
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div className="bg-white rounded-2xl border border-[#d9c2b2]/40 shadow-[0px_4px_12px_rgba(144,77,0,0.03)] divide-y divide-[#d9c2b2]/15 overflow-hidden">
                {isLoading ? (
                  <div className="py-12 text-center text-xs text-[#544437]/40 font-bold uppercase tracking-wider animate-pulse">
                    Memuat Saldo Stok...
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#544437]/40 font-bold uppercase tracking-wider">
                    Tidak ada data bahan baku
                  </div>
                ) : (
                  filteredItems.map((item) => {
                    let dotColor = 'bg-[#0a7d2c] shadow-[0_0_8px_rgba(10,125,44,0.35)]';
                    let badgeStyle = 'bg-[#93f997]/15 text-[#006e24] border-[#93f997]/25';
                    let label = 'Ready';

                    if (item.status === 'below') {
                      dotColor = 'bg-[#ba1a1a] shadow-[0_0_8px_rgba(186,26,26,0.45)]';
                      badgeStyle = 'bg-[#ffdad6] text-[#ba1a1a] border-[#ba1a1a]/10';
                      label = 'Kritis';
                    } else if (item.status === 'warning') {
                      dotColor = 'bg-[#f29744] shadow-[0_0_8px_rgba(242,151,68,0.45)]';
                      badgeStyle = 'bg-[#ffdcc2] text-[#904d00] border-[#ffdcc2]/10';
                      label = 'Warning';
                    }

                    return (
                      <div key={item.bahan_baku_id} className="p-4 flex items-center justify-between hover:bg-[#fff8f1]/20 transition-colors">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColor}`}></span>
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-xs text-[#1e1b15] uppercase tracking-wide truncate leading-tight">{item.item_name}</span>
                            <span className="text-[9px] text-[#544437]/50 font-bold uppercase mt-1 leading-none">{getStorageLocation(item.kategori)}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end shrink-0 pl-4">
                          <span className={`font-bold text-xs font-mono leading-none ${item.status === 'below' ? 'text-[#ba1a1a]' : item.status === 'warning' ? 'text-[#f29744]' : 'text-[#1e1b15]'}`}>
                            {item.current_qty} <span className="text-[10px] font-sans font-medium text-[#544437]/50">{item.satuan}</span>
                          </span>
                          <span className={`text-[8px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded border mt-1 leading-none ${badgeStyle}`}>
                            {label}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
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
