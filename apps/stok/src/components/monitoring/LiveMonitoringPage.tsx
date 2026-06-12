'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSPVMonitoringData } from '@/hooks/useMonitoringData';
import { useQuery } from '@tanstack/react-query';
import { fetchOutletsList } from '@/lib/queries/monitoring';

function getOutletRegion(slug: string, address: string | null): string {
  const addr = (address || '').toLowerCase();
  const slg = (slug || '').toLowerCase();

  if (slg.includes('bogor') || slg.includes('cibinong') || slg.includes('citayam') || slg.includes('ciseeng') || addr.includes('bogor')) {
    return 'BOGOR';
  }
  if (slg.includes('depok') || addr.includes('depok')) {
    return 'DEPOK';
  }
  if (slg.includes('jakarta') || slg.includes('tebet') || slg.includes('kalisari') || addr.includes('jakarta')) {
    return 'JAKARTA';
  }
  if (slg.includes('bekasi') || slg.includes('pekayon') || slg.includes('jatiwaringin') || slg.includes('jatiasih') || addr.includes('bekasi') || addr.includes('bks')) {
    return 'BEKASI';
  }
  if (slg.includes('tangerang') || slg.includes('cirendeu') || addr.includes('tangerang') || addr.includes('ciputat')) {
    return 'TANGERANG';
  }
  return 'LAINNYA';
}

export function LiveMonitoringPage() {
  const router = useRouter();
  const { data, isLoading: isMonitoringLoading, refetch } = useSPVMonitoringData();
  const { data: outletsMaster, isLoading: isOutletsLoading } = useQuery({
    queryKey: ['monitoring', 'outletsList'],
    queryFn: fetchOutletsList,
  });

  const isLoading = isMonitoringLoading || isOutletsLoading;

  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'below' | 'warning' | 'ok'>('all');

  // Live clock
  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const items = data?.items || [];

  // Group items by outlet and determine their status
  const outlets = useMemo(() => {
    const itemsMap: Record<string, typeof items> = {};
    for (const item of items) {
      if (!itemsMap[item.outlet_id]) {
        itemsMap[item.outlet_id] = [];
      }
      itemsMap[item.outlet_id].push(item);
    }

    let masterList = outletsMaster || [];
    if (masterList.length === 0 && items.length > 0) {
      const uniqueOutlets: Record<string, string> = {};
      for (const item of items) {
        if (item.outlet_id && item.outlet_name) {
          uniqueOutlets[item.outlet_id] = item.outlet_name;
        }
      }
      masterList = Object.entries(uniqueOutlets).map(([id, nama]) => ({
        id,
        nama,
        slug: '',
        address: '',
        type: '',
      }));
    }

    const list = masterList.map((outlet) => {
      const outletItems = itemsMap[outlet.id] || [];

      let kritisCount = 0;
      let menipisCount = 0;
      let status: 'below' | 'warning' | 'ok' = 'ok';
      const lowItems: typeof items = [];

      for (const item of outletItems) {
        if (item.status === 'below') {
          kritisCount++;
          status = 'below';
          lowItems.push(item);
        } else if (item.status === 'warning') {
          menipisCount++;
          if (status !== 'below') {
            status = 'warning';
          }
          lowItems.push(item);
        }
      }

      return {
        outlet_id: outlet.id,
        outlet_name: outlet.nama,
        slug: outlet.slug || '',
        address: outlet.address || '',
        region: getOutletRegion(outlet.slug || '', outlet.address || ''),
        type: outlet.type || 'outlet',
        kritisCount,
        menipisCount,
        status,
        lowItems,
        totalItemsCount: outletItems.length,
        isKitchen: outlet.nama.toUpperCase().includes('KITCHEN'),
      };
    });

    // Sort outlets: BOGOR -> DEPOK -> JAKARTA -> BEKASI -> TANGERANG -> LAINNYA.
    // Within same region, sort by status (below -> warning -> ok), then by name
    const regionOrder: Record<string, number> = { BOGOR: 0, DEPOK: 1, JAKARTA: 2, BEKASI: 3, TANGERANG: 4, LAINNYA: 5 };
    return list.sort((a, b) => {
      const regA = regionOrder[a.region] ?? 99;
      const regB = regionOrder[b.region] ?? 99;
      if (regA !== regB) {
        return regA - regB;
      }
      const statusOrder = { below: 0, warning: 1, ok: 2 };
      if (a.status !== b.status) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      return a.outlet_name.localeCompare(b.outlet_name);
    });
  }, [items, outletsMaster]);

  // Separate Kitchen from consumer grid
  const kitchenOutlet = useMemo(() => outlets.find((o) => o.isKitchen) || null, [outlets]);
  const gridOutlets = useMemo(() => outlets.filter((o) => !o.isKitchen), [outlets]);

  // Filter grid outlets by status tab
  const filteredGridOutlets = useMemo(() => {
    return gridOutlets.filter((o) => {
      const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
      return matchesStatus;
    });
  }, [gridOutlets, statusFilter]);


  // Top-3 most critical items across ALL outlets
  const topCritical = useMemo(() => {
    const belowItems = items.filter((it) => it.status === 'below');
    return belowItems
      .map((it) => ({
        ...it,
        ratio: it.threshold > 0 ? it.current_qty / it.threshold : 0,
      }))
      .sort((a, b) => a.ratio - b.ratio)
      .slice(0, 3);
  }, [items]);

  // Overall statistics (excluding Kitchen for status count)
  const stats = useMemo(() => {
    let kritis = 0;
    let menipis = 0;
    let aman = 0;

    for (const o of gridOutlets) {
      if (o.status === 'below') kritis++;
      else if (o.status === 'warning') menipis++;
      else aman++;
    }

    return { kritis, menipis, aman, total: gridOutlets.length };
  }, [gridOutlets]);

  // Audio chime trigger when critical items change
  useEffect(() => {
    if (!soundEnabled || isLoading || topCritical.length === 0) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();

      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        gain.gain.setValueAtTime(0, ctx.currentTime + start);
        gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + start + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      };

      // Play a friendly warning chime sequence (D5 then G5)
      playTone(587.33, 0, 0.4);      // D5
      playTone(783.99, 0.15, 0.6);   // G5
    } catch (e) {
      console.warn('Gagal memutar suara alarm:', e);
    }
  }, [topCritical.length, soundEnabled, isLoading]);

  const renderOutletCard = (outlet: typeof gridOutlets[0]) => {
    const regionBorders: Record<string, string> = {
      BOGOR: 'border-4 border-emerald-500',
      DEPOK: 'border-4 border-amber-500',
      JAKARTA: 'border-4 border-blue-500',
      BEKASI: 'border-4 border-purple-500',
      TANGERANG: 'border-4 border-pink-500',
      LAINNYA: 'border-4 border-slate-400',
    };
    const regionHoverBorders: Record<string, string> = {
      BOGOR: 'hover:border-emerald-600',
      DEPOK: 'hover:border-amber-600',
      JAKARTA: 'hover:border-blue-600',
      BEKASI: 'hover:border-purple-600',
      TANGERANG: 'hover:border-pink-600',
      LAINNYA: 'hover:border-slate-500',
    };

    const borderClass = regionBorders[outlet.region] || 'border-4 border-slate-500/25';
    const hoverBorderClass = regionHoverBorders[outlet.region] || 'hover:border-slate-500';

    let shadowClass = 'shadow-[0px_3px_10px_rgba(112,22,4,0.04)]';
    let hoverShadowClass = 'hover:shadow-[0px_8px_20px_rgba(112,22,4,0.07)]';
    let statusPill = 'bg-suka-green/10 text-suka-green border-suka-green/20';
    let statusLabel = 'Aman';

    if (outlet.status === 'below') {
      shadowClass = 'shadow-[0px_4px_12px_rgba(186,26,26,0.03)]';
      hoverShadowClass = 'hover:shadow-[0px_8px_20px_rgba(186,26,26,0.12)]';
      statusPill = 'bg-[#ffdad6] text-[#ba1a1a] border-[#ba1a1a]/20';
      statusLabel = 'Kritis';
    } else if (outlet.status === 'warning') {
      shadowClass = 'shadow-[0px_4px_12px_rgba(242,151,68,0.03)]';
      hoverShadowClass = 'hover:shadow-[0px_8px_20px_rgba(242,151,68,0.12)]';
      statusPill = 'bg-suka-orange/10 text-suka-orange border-suka-orange/20';
      statusLabel = 'Menipis';
    }

    const cleanOutletName = outlet.outlet_name
      .replace(/MITRA SUKA SHAWARMA/gi, '')
      .replace(/SUKA SHAWARMA/gi, '')
      .replace(/MITRA/gi, '')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return (
      <div
        key={outlet.outlet_id}
        onClick={() => router.push(`/stok/monitoring-live/${outlet.outlet_id}`)}
        className={`bg-white ${borderClass} ${hoverBorderClass} ${shadowClass} ${hoverShadowClass} rounded-2xl p-3.5 flex flex-col gap-3 h-full overflow-hidden transition-all cursor-pointer hover:-translate-y-0.5`}
      >
        {/* Card Header */}
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-black text-suka-ink uppercase tracking-wider leading-tight truncate">
              {cleanOutletName}
            </h3>
            <p className="text-[10px] text-suka-brown/40 font-bold uppercase mt-0.5 leading-none">
              {outlet.isKitchen ? 'Kitchen' : (outlet.type === 'mitra' ? 'Mitra' : 'Internal')}
            </p>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border leading-none ${statusPill}`}>
            {statusLabel}
          </span>
        </div>

        {/* Body Content */}
        {outlet.status === 'ok' ? (
          <div className="flex-grow flex flex-col items-center justify-center gap-3 bg-suka-green/5 border border-suka-green/10 rounded-2xl p-4 text-center">
            <span className="text-3xl leading-none">🟢</span>
            <div className="leading-tight">
              <p className="text-sm font-black text-suka-green uppercase tracking-wide">Semua Aman</p>
              <p className="text-[10px] text-suka-green/75 font-bold uppercase mt-1">
                ({outlet.totalItemsCount} bahan)
              </p>
            </div>
            <div className="text-[8px] font-black text-suka-green/65 uppercase tracking-widest px-2.5 py-0.5 bg-suka-green/10 rounded-full mt-1">
              Stabil
            </div>
          </div>
        ) : (
          <div className="flex-grow flex flex-col gap-2 justify-center">
            <div className="space-y-1.5">
              {outlet.lowItems.slice(0, 3).map((item) => (
                <div key={item.bahan_baku_id} className="bg-suka-cream/35 border border-suka-brown/5 rounded-lg py-1.5 px-3 flex items-center justify-between gap-2">
                  <p className="text-xs font-black text-suka-ink uppercase tracking-wide truncate flex-1 min-w-0 leading-tight">
                    {item.item_name}
                  </p>
                  <p className="text-xs font-black font-mono text-[#ba1a1a] leading-none flex-shrink-0">
                    {item.current_qty}<span className="text-[10px] font-medium text-suka-brown/50 font-sans">/{item.threshold}</span>
                  </p>
                </div>
              ))}
              {outlet.lowItems.length > 3 && (
                <p className="text-[10px] font-black text-suka-brown/40 uppercase tracking-widest text-center mt-1.5 leading-none">
                  + {outlet.lowItems.length - 3} lainnya
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (isLoading && outlets.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fff8f1]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#701604] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-[#701604] font-bold uppercase tracking-wider text-sm">Menghubungkan ke Live Monitoring System...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col bg-suka-cream text-suka-ink font-sans overflow-hidden select-none">
      {/* ━━━━━ HEADER ━━━━━ */}
      <header className="px-6 md:px-10 py-2 bg-suka-cream border-b-[3px] border-suka-brown flex-shrink-0">
        <div className="w-full grid grid-cols-1 md:grid-cols-3 items-center gap-4">
          {/* Left: Title & Quick Stats */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <h1 className="text-2xl font-black font-display text-suka-brown uppercase tracking-tight leading-none">
              📊 LIVE STOCK
            </h1>
            <p className="text-[10px] text-suka-brown/60 font-semibold uppercase tracking-wider mt-1">
              Suka Shawarma 19 Outlets Real-Time Monitor
            </p>
            
            {/* Stat Badges */}
            <div className="flex gap-4 mt-1.5">
              <div className="flex items-center gap-1 bg-[#ba1a1a]/10 border border-[#ba1a1a]/25 px-2.5 py-0.5 rounded-full text-[10px] font-black text-[#ba1a1a] uppercase tracking-wide">
                <span>🔴</span>
                <span>{stats.kritis} Kritis</span>
              </div>
              <div className="flex items-center gap-1 bg-suka-orange/10 border border-suka-orange/20 px-2.5 py-0.5 rounded-full text-[10px] font-black text-suka-orange uppercase tracking-wide">
                <span>🟡</span>
                <span>{stats.menipis} Menipis</span>
              </div>
            </div>
          </div>

          {/* Center: Large & Bold Jam & Tanggal */}
          <div className="flex flex-col items-center justify-center text-center bg-suka-brown/5 border-2 border-suka-brown/10 rounded-2xl py-1 px-4 shadow-inner w-full max-w-sm mx-auto">
            {currentTime ? (
              <>
                <p className="text-2xl md:text-3xl font-black font-mono text-suka-brown tracking-tight leading-none">
                  {currentTime.toLocaleTimeString('id-ID', { hour12: false })} <span className="text-sm font-black">WIB</span>
                </p>
                <p className="text-[10px] font-black uppercase text-suka-brown/75 tracking-wider mt-1">
                  {currentTime.toLocaleDateString('id-ID', { weekday: 'long' })}, {currentTime.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </>
            ) : (
              <div className="h-10 w-48 bg-suka-brown/10 rounded-lg animate-pulse"></div>
            )}
          </div>

          {/* Right: Audio control & Refresh */}
          <div className="flex items-center gap-3 justify-self-center md:justify-self-end">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              aria-label={soundEnabled ? 'Alarm On' : 'Alarm Muted'}
              title={soundEnabled ? 'Alarm On' : 'Alarm Muted'}
              className={`px-4 py-2 text-xs font-black uppercase tracking-wide rounded-xl border-2 transition-all flex items-center gap-1.5 ${
                soundEnabled
                  ? 'bg-suka-brown border-suka-brown text-white shadow-[0px_4px_12px_rgba(112,22,4,0.15)]'
                  : 'bg-white border-suka-brown/15 text-suka-brown/60 hover:bg-suka-brown/5'
              }`}
            >
              <span>{soundEnabled ? '🔊 SOUND ON' : '🔇 MUTED'}</span>
            </button>

            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-suka-brown border-2 border-suka-brown text-white rounded-xl text-xs font-black uppercase tracking-wide hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-[0px_4px_12px_rgba(112,22,4,0.15)]"
            >
              <span>🔄 REFRESH</span>
            </button>
          </div>
        </div>
      </header>

      {/* ━━━━━ TOP SECTION: Kitchen + Top-3 ━━━━━ */}
      {(kitchenOutlet || topCritical.length > 0) && (
        <section className="flex flex-col lg:flex-row gap-4 px-6 md:px-10 py-2 bg-suka-cream border-b-[2px] border-suka-brown/15 flex-shrink-0">
          {/* Kitchen Panel: Left */}
          {kitchenOutlet && (
            <div
              onClick={() => router.push(`/stok/monitoring-live/${kitchenOutlet.outlet_id}`)}
              className="flex-shrink-0 w-full lg:w-96 bg-white border-2 border-suka-brown rounded-2xl p-2.5 flex flex-col gap-1.5 shadow-sm cursor-pointer hover:scale-[1.01] hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl bg-suka-brown/5 p-1.5 rounded-xl border border-suka-brown/10">🏭</span>
                <div>
                  <h2 className="text-sm font-black text-suka-ink uppercase tracking-wider leading-tight">
                    Kitchen Pusat
                  </h2>
                  <p className="text-[9px] text-suka-brown/50 font-bold mt-0.5 uppercase tracking-wide">Sumber Pasok Utama</p>
                </div>
              </div>

              {kitchenOutlet.status === 'ok' ? (
                <div className="bg-suka-green/5 border border-suka-green/20 rounded-xl p-2 flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-suka-green">
                  <span>🟢 KITCHEN AMAN</span>
                  <span>Stok pasok aman</span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className={`px-3 py-1 rounded-xl border flex items-center justify-between text-[11px] font-black uppercase tracking-wider ${
                    kitchenOutlet.status === 'below' ? 'bg-[#ffdad6] text-[#ba1a1a] border-[#ba1a1a]/20' : 'bg-suka-orange/5 text-suka-orange border-suka-orange/20'
                  }`}>
                    <span>⚠️ HUB CRITICAL</span>
                    <span>
                      {kitchenOutlet.kritisCount > 0 && `${kitchenOutlet.kritisCount} Kritis`}
                      {kitchenOutlet.kritisCount > 0 && kitchenOutlet.menipisCount > 0 && ' · '}
                      {kitchenOutlet.menipisCount > 0 && `${kitchenOutlet.menipisCount} Menipis`}
                    </span>
                  </div>
                  <p className="text-[10px] text-suka-brown/65 font-bold uppercase tracking-wider truncate">
                    Bahan: {kitchenOutlet.lowItems.slice(0, 3).map((it) => it.item_name).join(', ')}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Top-3 Kritis: Right */}
          {topCritical.length > 0 ? (
            <div className="flex-1 bg-[#ffdad6]/20 border-2 border-[#ba1a1a] rounded-2xl p-2.5 shadow-[0px_4px_12px_rgba(186,26,26,0.03)]">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl bg-[#ffdad6] p-1 rounded-lg border border-[#ba1a1a]/20">🚨</span>
                <h3 className="text-xs font-black text-[#ba1a1a] uppercase tracking-widest">Prioritas Utama — Item Kritis</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {topCritical.map((it, i) => (
                  <div 
                    key={`${it.outlet_id}-${it.bahan_baku_id}`} 
                    onClick={() => router.push(`/stok/monitoring-live/${it.outlet_id}`)}
                    className="bg-white rounded-xl p-2 border-2 border-[#ffdad6] hover:border-[#ba1a1a]/50 transition-colors cursor-pointer flex flex-col justify-between min-h-14 shadow-sm"
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-lg font-black font-display text-[#ffb4ab] leading-none">{i + 1}</span>
                      <span className="text-[8px] font-black uppercase text-suka-brown/40 tracking-wider">
                        {it.outlet_name.replace('SUKA SHAWARMA ', '')}
                      </span>
                    </div>
                    <div className="mt-0.5">
                      <p className="text-xs font-black text-suka-ink uppercase tracking-wide truncate">{it.item_name}</p>
                      <p className="text-xs font-black font-mono text-[#ba1a1a] mt-0.5 leading-none">
                        {it.current_qty}/{it.threshold} <span className="text-[8px] font-bold">{it.satuan}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 bg-white border-2 border-dashed border-suka-brown/20 rounded-2xl p-6 flex items-center justify-center text-center">
              <p className="text-xs font-black text-suka-brown/50 uppercase tracking-widest">
                📭 Semua outlet aman — tidak ada item kritis
              </p>
            </div>
          )}
        </section>
      )}

      {/* ━━━━━ SEARCH & FILTER TOOLBAR ━━━━━ */}
      <section className="px-6 md:px-10 pt-3 flex-shrink-0">
        <div className="bg-white border-2 border-suka-brown/15 rounded-2xl p-2.5 shadow-[0px_4px_12px_rgba(112,22,4,0.04)] flex flex-col gap-2">
          <div className="flex flex-col md:flex-row md:items-center justify-start gap-3">
            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black text-suka-brown/50 uppercase tracking-wider mr-1">Status Outlet:</span>
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-2 ${
                  statusFilter === 'all'
                    ? 'bg-suka-brown border-suka-brown text-white shadow-[0px_4px_12px_rgba(112,22,4,0.15)]'
                    : 'bg-white border-suka-brown/15 text-suka-brown hover:bg-suka-brown/5'
                }`}
              >
                Semua ({stats.total})
              </button>
              <button
                onClick={() => setStatusFilter('below')}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-2 flex items-center gap-1.5 ${
                  statusFilter === 'below'
                    ? 'bg-[#ba1a1a] border-[#ba1a1a] text-white shadow-[0px_4px_12px_rgba(186,26,26,0.25)]'
                    : 'bg-white border-suka-brown/15 text-[#ba1a1a] hover:bg-[#ba1a1a]/5'
                }`}
              >
                Kritis ({stats.kritis})
              </button>
              <button
                onClick={() => setStatusFilter('warning')}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-2 flex items-center gap-1.5 ${
                  statusFilter === 'warning'
                    ? 'bg-suka-orange border-suka-orange text-white shadow-[0px_4px_12px_rgba(242,151,68,0.25)]'
                    : 'bg-white border-suka-brown/15 text-suka-orange hover:bg-suka-orange/5'
                }`}
              >
                Menipis ({stats.menipis})
              </button>
              <button
                onClick={() => setStatusFilter('ok')}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-2 flex items-center gap-1.5 ${
                  statusFilter === 'ok'
                    ? 'bg-suka-green border-suka-green text-white shadow-[0px_4px_12px_rgba(10,125,44,0.25)]'
                    : 'bg-white border-suka-brown/15 text-suka-green hover:bg-suka-green/5'
                }`}
              >
                Aman ({stats.aman})
              </button>
            </div>
          </div>

          {/* Region Outline Legend */}
          <div className="border-t border-suka-brown/10 pt-2 flex flex-wrap items-center gap-4 text-[10px] font-black uppercase text-suka-brown/60 tracking-wider">
            <span>📍 Warna Outline Wilayah:</span>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-3 rounded border-2 border-emerald-500 bg-white"></span>
              <span>Bogor</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-3 rounded border-2 border-amber-500 bg-white"></span>
              <span>Depok</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-3 rounded border-2 border-blue-500 bg-white"></span>
              <span>Jakarta</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-3 rounded border-2 border-purple-500 bg-white"></span>
              <span>Bekasi</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-3 rounded border-2 border-pink-500 bg-white"></span>
              <span>Tangerang</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-3 rounded border-2 border-slate-400 bg-white"></span>
              <span>Lainnya</span>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━━━ GRID: 18 OUTLETS ━━━━━ */}
      <main className="flex-1 px-6 md:px-10 pt-2 pb-4 overflow-hidden w-full min-h-0 flex flex-col">
        {filteredGridOutlets.length === 0 ? (
          <div className="bg-white border-2 border-suka-brown/15 border-dashed rounded-3xl py-16 px-4 text-center max-w-md mx-auto">
            <div className="w-16 h-16 bg-suka-brown/5 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-suka-brown/40" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="text-base font-black text-suka-ink uppercase tracking-wide">Outlet Tidak Ditemukan</h3>
            <p className="text-xs text-suka-brown/60 font-semibold mt-1">
              Tidak ada data outlet yang cocok dengan pencarian atau filter status Anda.
            </p>
            {statusFilter !== 'all' && (
              <button
                onClick={() => {
                  setStatusFilter('all');
                }}
                className="mt-5 px-5 py-2.5 bg-suka-brown text-white font-bold text-xs uppercase tracking-wider rounded-xl hover:opacity-90 transition-opacity"
              >
                Reset Filter
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 auto-rows-fr gap-4 flex-1 pb-2">
            {filteredGridOutlets.map((outlet) => renderOutletCard(outlet))}
          </div>
        )}
      </main>
    </div>
  );
}
