'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AuthGuard } from '@/components/common/AuthGuard';
import { getCrossAppUrl } from '@/lib/navigation';
import { Button } from '@suka/design-system';
import { useCrewMonitoringData } from '@/hooks/useMonitoringData';

function DashboardHub() {
  const router = useRouter();
  const { outletStaff, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<'all' | 'below' | 'warning' | 'ok'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: crewData, isLoading } = useCrewMonitoringData();
  const isSPV = outletStaff?.role === 'spv';

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
    <div className="min-h-screen bg-suka-cream text-suka-ink font-sans pb-32">
      {/* Header */}
      <header className="bg-white border-b border-suka-brown/10 px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo Suka Shawarma" className="h-10 w-auto object-contain" />
          <div>
            <p className="text-[10px] font-black text-suka-brown/50 uppercase tracking-widest leading-none">Outlet Suite</p>
            <h1 className="text-sm font-extrabold text-suka-brown uppercase tracking-tight mt-1 leading-none">
              {crewData?.outlet_name || 'Stock Monitoring'}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-suka-cream border border-suka-brown/10 px-3 py-1.5 rounded-xl text-xs font-bold text-suka-brown">
            {outletStaff?.name ?? '—'}
            <span className="ml-1.5 uppercase text-suka-brown/40 font-medium">
              · {outletStaff?.role}
            </span>
          </div>
          <Button variant="secondary" size="sm" onClick={() => signOut()}>
            Keluar
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 pt-8 pb-16 space-y-6">
        
        {/* Section: Critical Alerts */}
        {!isLoading && (
          <section>
            {criticalItems.length > 0 ? (
              <div className="bg-white rounded-2xl border border-red-500/20 p-5 shadow-[0px_4px_12px_rgba(112,22,4,0.03)] flex flex-col gap-4">
                <div className="flex items-center gap-2 text-[#ba1a1a]">
                  <span className="text-xl">⚠️</span>
                  <h2 className="font-extrabold text-sm uppercase tracking-wide">Peringatan Kritis ({criticalItems.length})</h2>
                </div>
                <div className="space-y-2">
                  {criticalItems.slice(0, 3).map((item) => (
                    <div key={item.bahan_baku_id} className="flex justify-between items-center p-4 bg-[#ba1a1a]/5 rounded-xl border border-[#ba1a1a]/10">
                      <div className="flex flex-col">
                        <span className="font-extrabold text-xs text-suka-ink uppercase tracking-wide leading-tight">{item.item_name}</span>
                        <span className="text-[11px] text-suka-brown/70 mt-1">
                          {item.current_qty} {item.satuan} / <span className="font-bold text-[#ba1a1a]">Batas {item.threshold} {item.satuan}</span>
                        </span>
                      </div>
                      <span className="text-[#ba1a1a] font-bold text-lg leading-none">📉</span>
                    </div>
                  ))}
                  {criticalItems.length > 3 && (
                    <p className="text-[10px] font-black text-suka-brown/40 uppercase tracking-widest text-center mt-1.5">
                      + {criticalItems.length - 3} item kritis lainnya
                    </p>
                  )}
                </div>
                <Button 
                  variant="primary" 
                  onClick={() => handleNavigate('/stok/opname/new')}
                  className="w-full bg-suka-orange hover:bg-orange-600 active:bg-orange-700 text-white font-extrabold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm text-xs uppercase tracking-wider"
                >
                  Mulai Opname Baru
                </Button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-suka-green/20 p-5 shadow-[0px_4px_12px_rgba(10,125,44,0.03)] flex flex-col items-center justify-center text-center gap-2 py-6">
                <span className="text-2xl leading-none">🟢</span>
                <div className="leading-tight">
                  <h2 className="font-extrabold text-xs text-suka-green uppercase tracking-wide">Semua Aman</h2>
                  <p className="text-[10px] text-suka-green/75 mt-1 font-bold uppercase tracking-wide">Ketersediaan bahan baku outlet terpenuhi</p>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Section: Quick Actions */}
        <section>
          <p className="text-xs font-black text-suka-brown/50 uppercase tracking-widest mb-3">Aksi Cepat</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {menu.map((item) => (
              <button
                key={item.href}
                onClick={() => handleNavigate(item.href)}
                className="bg-white border border-suka-brown/10 hover:border-suka-orange/30 p-4 rounded-2xl flex flex-col items-center justify-center text-center gap-2.5 shadow-[0px_4px_12px_rgba(112,22,4,0.02)] hover:shadow-md hover:-translate-y-0.5 active:scale-95 transition-all w-full cursor-pointer"
              >
                <div className="w-12 h-12 rounded-full bg-suka-orange/10 flex items-center justify-center text-xl text-suka-orange font-bold leading-none">
                  {item.icon}
                </div>
                <div className="space-y-0.5">
                  <p className="font-extrabold text-suka-brown text-xs uppercase tracking-tight leading-tight">{item.label}</p>
                  <p className="text-[9px] text-suka-brown/50 font-bold uppercase mt-0.5">{item.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Section: Real-time Stock Balance */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-extrabold text-suka-brown text-xs uppercase tracking-wider">Saldo Stok Real-time</h2>
            <span className="text-[9px] font-black text-suka-brown/40 uppercase tracking-widest bg-suka-brown/5 px-2.5 py-1 rounded-lg">
              Total: {items.length} bahan
            </span>
          </div>

          {/* Search and Filter Tabs */}
          <div className="bg-white border border-suka-brown/10 rounded-2xl p-3 shadow-sm space-y-3">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                className="w-full px-4 py-2 pl-9 rounded-xl border border-suka-brown/10 bg-suka-cream/20 focus:outline-none focus:ring-2 focus:ring-suka-orange focus:border-suka-orange text-xs text-suka-ink placeholder-suka-brown/40 font-medium transition-all"
                placeholder="Cari bahan..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-suka-brown/40 text-xs">🔍</span>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wider transition-all border cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-suka-brown border-suka-brown text-white'
                    : 'bg-white border-suka-brown/10 text-suka-brown/70 hover:bg-suka-cream/50'
                }`}
              >
                Semua
              </button>
              <button
                onClick={() => setActiveTab('below')}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wider transition-all border cursor-pointer ${
                  activeTab === 'below'
                    ? 'bg-[#ba1a1a] border-[#ba1a1a] text-white'
                    : 'bg-white border-[#ba1a1a]/15 text-[#ba1a1a] hover:bg-[#ba1a1a]/5'
                }`}
              >
                Kritis ({items.filter((i) => i.status === 'below').length})
              </button>
              <button
                onClick={() => setActiveTab('warning')}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wider transition-all border cursor-pointer ${
                  activeTab === 'warning'
                    ? 'bg-suka-orange border-suka-orange text-white'
                    : 'bg-white border-suka-orange/20 text-suka-orange hover:bg-suka-orange/5'
                }`}
              >
                Menipis ({items.filter((i) => i.status === 'warning').length})
              </button>
              <button
                onClick={() => setActiveTab('ok')}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wider transition-all border cursor-pointer ${
                  activeTab === 'ok'
                    ? 'bg-suka-green border-suka-green text-white'
                    : 'bg-white border-suka-green/20 text-suka-green hover:bg-suka-green/5'
                }`}
              >
                Aman ({items.filter((i) => i.status === 'ok').length})
              </button>
            </div>
          </div>

          {/* Items List */}
          <div className="bg-white rounded-2xl border border-suka-brown/10 shadow-[0px_4px_12px_rgba(112,22,4,0.02)] divide-y divide-suka-brown/5 overflow-hidden">
            {isLoading ? (
              <div className="py-12 text-center text-xs text-suka-brown/40 font-bold uppercase tracking-wider animate-pulse">
                Memuat Saldo Stok...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="py-12 text-center text-xs text-suka-brown/40 font-bold uppercase tracking-wider">
                Tidak ada data bahan baku
              </div>
            ) : (
              filteredItems.map((item) => {
                let dotColor = 'bg-suka-green';
                let badgeStyle = 'bg-suka-green/10 text-suka-green border-suka-green/10';
                let label = 'Aman';

                if (item.status === 'below') {
                  dotColor = 'bg-[#ba1a1a] shadow-[0_0_8px_rgba(186,26,26,0.4)]';
                  badgeStyle = 'bg-[#ffdad6] text-[#ba1a1a] border-[#ba1a1a]/10';
                  label = 'Kritis';
                } else if (item.status === 'warning') {
                  dotColor = 'bg-suka-orange shadow-[0_0_8px_rgba(242,151,68,0.4)]';
                  badgeStyle = 'bg-suka-orange/10 text-suka-orange border-suka-orange/10';
                  label = 'Menipis';
                }

                return (
                  <div key={item.bahan_baku_id} className="p-4 flex items-center justify-between hover:bg-suka-cream/10 transition-colors">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColor}`}></span>
                      <div className="flex flex-col min-w-0">
                        <span className="font-extrabold text-xs text-suka-ink uppercase tracking-wide truncate leading-tight">{item.item_name}</span>
                        <span className="text-[9px] text-suka-brown/50 font-bold uppercase mt-1 leading-none">{getStorageLocation(item.kategori)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0 pl-4">
                      <span className={`font-extrabold text-xs font-mono leading-none ${item.status === 'below' ? 'text-[#ba1a1a]' : item.status === 'warning' ? 'text-suka-orange' : 'text-suka-ink'}`}>
                        {item.current_qty} <span className="text-[10px] font-sans font-medium text-suka-brown/50">{item.satuan}</span>
                      </span>
                      <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded border mt-1 leading-none ${badgeStyle}`}>
                        {label}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>
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

