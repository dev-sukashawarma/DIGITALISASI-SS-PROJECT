'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchOutletsList, fetchOutletItemsDetail } from '@/lib/queries/monitoring';

function formatLedgerType(type: string): string {
  const map: Record<string, string> = {
    terima_kiriman: 'Terima',
    pemakaian: 'Pakai',
    waste: 'Waste',
    adjustment: 'Adjust',
    opname_selisih: 'Opname',
    transfer_keluar: 'Keluar',
    transfer_masuk: 'Masuk',
    rejected_kiriman: 'Ditolak',
  };
  return map[type] || type.toUpperCase();
}

export function DetailOutletMonitoring({ outletId }: { outletId: string }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'below' | 'warning' | 'ok'>('all');

  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Live clock
  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: outlets } = useQuery({
    queryKey: ['monitoring', 'outlets'],
    queryFn: fetchOutletsList,
  });

  const {
    data: items = [],
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: ['monitoring', 'outletDetail', outletId],
    queryFn: () => fetchOutletItemsDetail(outletId),
    enabled: !!outletId,
  });

  // Track last update time when items are successfully fetched or changed
  useEffect(() => {
    if (items && items.length > 0) {
      setLastUpdated(new Date());
    }
  }, [items]);

  const error = queryError instanceof Error ? queryError.message : queryError ? 'Gagal memuat data outlet' : null;

  const outletName = outlets?.find((o) => o.id === outletId)?.nama || 'Outlet';

  // Compute stats for summary badges
  const stats = useMemo(() => {
    const total = items.length;
    const below = items.filter((it) => it.status === 'below').length;
    const warning = items.filter((it) => it.status === 'warning').length;
    const ok = items.filter((it) => it.status === 'ok').length;
    return { total, below, warning, ok };
  }, [items]);

  // Filter items in real-time
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = item.item_name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [items, searchQuery, statusFilter]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fff8f1]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#701604] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-[#701604] font-bold uppercase tracking-wider text-sm">Memuat detail outlet...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#fff8f1] gap-6">
        <div className="text-center">
          <p className="text-xl font-bold text-[#ba1a1a] mb-2">⚠️ Error</p>
          <p className="text-[#701604]/70 font-semibold">{error}</p>
        </div>
        <button
          onClick={() => router.back()}
          className="px-6 py-3 bg-[#701604] text-white rounded-lg font-bold uppercase tracking-wider hover:opacity-85 transition-opacity shadow-[0px_4px_12px_rgba(112,22,4,0.15)]"
        >
          ← Kembali ke Papan
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-suka-cream text-suka-ink font-sans">
      {/* Header */}
      <header className="px-6 md:px-10 py-6 bg-suka-cream border-b-[3px] border-suka-brown flex-shrink-0">
        <div className="w-full grid grid-cols-1 md:grid-cols-3 items-center gap-4">
          {/* Left: Title & Navigation */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <button
              onClick={() => router.back()}
              className="text-xs font-black text-suka-brown/60 mb-2 hover:text-suka-brown transition-colors flex items-center gap-1 uppercase tracking-wider"
            >
              ← Kembali ke Papan
            </button>
            <h1 className="text-3xl font-black font-display text-suka-brown uppercase tracking-tight leading-none">
              {outletName.replace('SUKA SHAWARMA ', '')}
            </h1>
            <p className="text-xs text-suka-brown/60 font-bold mt-1 uppercase tracking-widest">
              Laporan Detail Stok Outlet Aktif
            </p>
          </div>
          
          {/* Center: Large & Bold Jam & Tanggal */}
          <div className="flex flex-col items-center justify-center text-center bg-suka-brown/5 border-2 border-suka-brown/10 rounded-2xl py-3 px-6 shadow-inner w-full max-w-md mx-auto">
            {currentTime ? (
              <>
                <p className="text-2xl md:text-3xl font-black font-mono text-suka-brown tracking-tight leading-none">
                  {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} <span className="text-sm font-black">WIB</span>
                </p>
                <p className="text-[11px] font-black uppercase text-suka-brown/75 tracking-wider mt-1.5">
                  {currentTime.toLocaleDateString('id-ID', { weekday: 'long' })}, {currentTime.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </>
            ) : (
              <div className="h-10 w-48 bg-suka-brown/10 rounded-lg animate-pulse"></div>
            )}
          </div>
          
          {/* Right: Quick Info / Last Update */}
          <div className="flex flex-col items-center md:items-end text-center md:text-right gap-1.5 justify-self-center md:justify-self-end">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-suka-brown/10 text-suka-brown uppercase tracking-wider border border-suka-brown/20">
              ⚡ LIVE MONITOR
            </span>
            {lastUpdated && (
              <p className="text-[10px] text-suka-brown/65 font-bold uppercase tracking-wide">
                Pembaruan Terakhir: <span className="font-mono text-suka-green bg-suka-green/10 border border-suka-green/20 px-2 py-0.5 rounded font-black">{lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} WIB</span>
              </p>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-6 md:px-10 py-8 w-full">
        {/* 1. Dashboard Stats Summary Grid */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border-2 border-suka-brown/15 rounded-2xl p-5 shadow-[0px_4px_12px_rgba(112,22,4,0.04)] flex flex-col justify-between">
            <span className="text-[11px] font-black uppercase text-suka-brown/60 tracking-wider">Total Bahan</span>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-black font-display text-suka-ink">{stats.total}</span>
              <span className="text-xs text-suka-brown/50 font-bold">jenis</span>
            </div>
          </div>

          <button
            onClick={() => setStatusFilter(statusFilter === 'below' ? 'all' : 'below')}
            className={`text-left bg-white border-2 rounded-2xl p-5 shadow-[0px_4px_12px_rgba(112,22,4,0.04)] hover:border-[#ba1a1a]/50 transition-all flex flex-col justify-between group ${
              statusFilter === 'below' ? 'border-[#ba1a1a] bg-[#ffdad6]/10 ring-2 ring-[#ba1a1a]/25' : 'border-suka-brown/15'
            }`}
          >
            <span className="text-[11px] font-black uppercase text-[#ba1a1a] tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#ba1a1a] animate-pulse"></span>
              Stok Kritis
            </span>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-black font-display text-[#ba1a1a] group-hover:scale-105 transition-transform">{stats.below}</span>
              <span className="text-xs text-[#ba1a1a]/75 font-bold">bahan</span>
            </div>
          </button>

          <button
            onClick={() => setStatusFilter(statusFilter === 'warning' ? 'all' : 'warning')}
            className={`text-left bg-white border-2 rounded-2xl p-5 shadow-[0px_4px_12px_rgba(112,22,4,0.04)] hover:border-suka-orange/50 transition-all flex flex-col justify-between group ${
              statusFilter === 'warning' ? 'border-suka-orange bg-suka-orange/5 ring-2 ring-suka-orange/20' : 'border-suka-brown/15'
            }`}
          >
            <span className="text-[11px] font-black uppercase text-suka-orange tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-suka-orange"></span>
              Stok Menipis
            </span>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-black font-display text-suka-orange group-hover:scale-105 transition-transform">{stats.warning}</span>
              <span className="text-xs text-suka-orange/75 font-bold">bahan</span>
            </div>
          </button>

          <button
            onClick={() => setStatusFilter(statusFilter === 'ok' ? 'all' : 'ok')}
            className={`text-left bg-white border-2 rounded-2xl p-5 shadow-[0px_4px_12px_rgba(112,22,4,0.04)] hover:border-suka-green/50 transition-all flex flex-col justify-between group ${
              statusFilter === 'ok' ? 'border-suka-green bg-suka-green/5 ring-2 ring-suka-green/20' : 'border-suka-brown/15'
            }`}
          >
            <span className="text-[11px] font-black uppercase text-suka-green tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-suka-green"></span>
              Stok Aman
            </span>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-black font-display text-suka-green group-hover:scale-105 transition-transform">{stats.ok}</span>
              <span className="text-xs text-suka-green/75 font-bold">bahan</span>
            </div>
          </button>
        </section>

        {/* 2. Interactive Search & Filter Toolbar */}
        <section className="bg-white border-2 border-suka-brown/15 rounded-2xl p-4 mb-8 shadow-[0px_4px_12px_rgba(112,22,4,0.04)] flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-suka-brown/40">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Cari bahan baku..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-suka-cream/40 border-2 border-suka-brown/10 rounded-xl font-bold text-sm text-suka-ink placeholder-suka-brown/40 focus:outline-none focus:border-suka-orange/60 transition-colors"
            />
          </div>

          {/* Filter Pill Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black text-suka-brown/50 uppercase tracking-wider mr-1">Status:</span>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-2 ${
                statusFilter === 'all'
                  ? 'bg-suka-brown border-suka-brown text-white shadow-[0px_4px_12px_rgba(112,22,4,0.15)]'
                  : 'bg-white border-suka-brown/15 text-suka-brown hover:bg-suka-brown/5'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setStatusFilter('below')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-2 flex items-center gap-1.5 ${
                statusFilter === 'below'
                  ? 'bg-[#ba1a1a] border-[#ba1a1a] text-white shadow-[0px_4px_12px_rgba(186,26,26,0.25)]'
                  : 'bg-white border-suka-brown/15 text-[#ba1a1a] hover:bg-[#ba1a1a]/5'
              }`}
            >
              Kritis
            </button>
            <button
              onClick={() => setStatusFilter('warning')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-2 flex items-center gap-1.5 ${
                statusFilter === 'warning'
                  ? 'bg-suka-orange border-suka-orange text-white shadow-[0px_4px_12px_rgba(242,151,68,0.25)]'
                  : 'bg-white border-suka-brown/15 text-suka-orange hover:bg-suka-orange/5'
              }`}
            >
              Menipis
            </button>
            <button
              onClick={() => setStatusFilter('ok')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-2 flex items-center gap-1.5 ${
                statusFilter === 'ok'
                  ? 'bg-suka-green border-suka-green text-white shadow-[0px_4px_12px_rgba(10,125,44,0.25)]'
                  : 'bg-white border-suka-brown/15 text-suka-green hover:bg-suka-green/5'
              }`}
            >
              Aman
            </button>
          </div>
        </section>

        {/* 3. Ingredient Cards Grid */}
        {filteredItems.length === 0 ? (
          <div className="bg-white border-2 border-suka-brown/15 border-dashed rounded-3xl py-16 px-4 text-center max-w-md mx-auto">
            <div className="w-16 h-16 bg-suka-brown/5 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-suka-brown/40" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-base font-black text-suka-ink uppercase tracking-wide">Bahan Baku Tidak Ditemukan</h3>
            <p className="text-xs text-suka-brown/60 font-semibold mt-1">
              Tidak ada data bahan baku yang cocok dengan pencarian atau filter status Anda.
            </p>
            {(searchQuery !== '' || statusFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
                className="mt-5 px-5 py-2.5 bg-suka-brown text-white font-bold text-xs uppercase tracking-wider rounded-xl hover:opacity-90 transition-opacity"
              >
                Reset Filter
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredItems.map((item) => {
              const ratio = item.threshold > 0 ? item.current_qty / item.threshold : 0;
              const percent = Math.min(100, Math.round(ratio * 100));
              const ledgerList = item.recent_ledger?.slice(0, 3) || [];

              let statusBgColor = 'bg-white border-suka-brown/15';
              let statusPill = 'bg-suka-green/10 text-suka-green border-suka-green/20';
              let statusLabel = 'Aman';
              let barColor = 'bg-suka-green shadow-[0_0_8px_rgba(10,125,44,0.3)]';

              if (item.status === 'below') {
                statusBgColor = 'bg-white border-[#ba1a1a]/30 shadow-[0px_4px_16px_rgba(186,26,26,0.04)]';
                statusPill = 'bg-[#ffdad6] text-[#ba1a1a] border-[#ba1a1a]/20';
                statusLabel = 'Kritis';
                barColor = 'bg-[#ba1a1a] shadow-[0_0_8px_rgba(186,26,26,0.3)]';
              } else if (item.status === 'warning') {
                statusBgColor = 'bg-white border-suka-orange/30 shadow-[0px_4px_16px_rgba(242,151,68,0.04)]';
                statusPill = 'bg-suka-orange/10 text-suka-orange border-suka-orange/20';
                statusLabel = 'Menipis';
                barColor = 'bg-suka-orange shadow-[0_0_8px_rgba(242,151,68,0.3)]';
              }

              return (
                <div
                  key={item.bahan_baku_id}
                  className={`${statusBgColor} border-2 rounded-2xl p-4 flex flex-col gap-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0px_8px_20px_rgba(112,22,4,0.06)]`}
                >
                  {/* Top Status & Indicator */}
                  <div className="flex items-center justify-between">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${statusPill}`}>
                      {statusLabel}
                    </span>
                    <span className="text-[10px] font-black text-suka-brown/40 uppercase tracking-widest font-mono">
                      ID: {item.bahan_baku_id.slice(0, 4)}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-black text-suka-ink uppercase tracking-wide leading-snug line-clamp-1">
                      {item.item_name}
                    </h3>
                  </div>

                  <div className="bg-suka-cream/35 border border-suka-brown/5 rounded-xl p-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-black uppercase text-suka-brown/50 tracking-wider">Stok Aktual</p>
                      <span className="text-xl font-black font-mono text-suka-ink">{item.current_qty}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black uppercase text-suka-brown/50 tracking-wider">Batas Minimum</p>
                      <span className="text-xs font-bold font-mono text-suka-brown/70">
                        {item.threshold} <span className="text-[9px] font-medium">{item.satuan}</span>
                      </span>
                    </div>
                  </div>

                  {/* Progress Gauge */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wide">
                      <span className="text-suka-brown/50">Kapasitas Aman</span>
                      <span className={item.status === 'below' ? 'text-[#ba1a1a]' : item.status === 'warning' ? 'text-suka-orange' : 'text-suka-green'}>
                        {percent}%
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-suka-brown/5 rounded-full overflow-hidden border border-suka-brown/10 relative">
                      <div className={`h-full transition-all duration-500 rounded-full ${barColor}`} style={{ width: `${percent}%` }} />
                    </div>
                  </div>

                  {/* Ledger Feed Section */}
                  <div className="border-t border-suka-brown/10 pt-2 mt-1 flex-1 flex flex-col justify-end">
                    <p className="text-[9px] font-black uppercase text-suka-brown/45 tracking-wider mb-1.5">
                      Mutasi Terakhir
                    </p>
                    
                    {ledgerList.length === 0 ? (
                      <p className="text-[10px] text-suka-brown/40 font-bold italic py-1">
                        Belum ada transaksi
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {ledgerList.map((log, index) => {
                          const dateObj = new Date(log.created_at);
                          const dateString = dateObj.toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                          });
                          const isAdd = log.qty > 0;
                          return (
                            <div key={index} className="flex items-center justify-between text-[10px] font-bold">
                              {/* Left: action type & date */}
                              <div className="flex items-center gap-1.5 text-suka-brown/65">
                                <span className="text-[8px] bg-suka-brown/10 px-1 rounded uppercase tracking-wide">
                                  {formatLedgerType(log.tipe)}
                                </span>
                                <span className="font-mono text-[9px] text-suka-brown/50">{dateString}</span>
                              </div>
                              
                              {/* Right: amount badge */}
                              <span className={`px-1.5 py-0.5 rounded font-mono text-[9px] font-black ${
                                isAdd 
                                  ? 'bg-suka-green/10 text-suka-green' 
                                  : 'bg-[#ffdad6] text-[#ba1a1a]'
                              }`}>
                                {isAdd ? '+' : ''}{log.qty}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
