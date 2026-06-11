'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSPVMonitoringData, useRecentLedger, useStockoutForecast, useWasteToday } from '@/hooks/useMonitoringData';
import { useQuery } from '@tanstack/react-query';
import { fetchOutletsList } from '@/lib/queries/monitoring';
import type { LedgerFeedTipe } from '@/lib/queries/monitoring';

const TIPE_META: Record<LedgerFeedTipe, { icon: string; label: string }> = {
  terima_kiriman: { icon: '📦', label: 'Terima' },
  pemakaian: { icon: '🍳', label: 'Pakai' },
  waste: { icon: '🗑️', label: 'Waste' },
  adjustment: { icon: '✏️', label: 'Adjust' },
  opname_selisih: { icon: '📋', label: 'Opname' },
  transfer_keluar: { icon: '🔄', label: 'Transfer Keluar' },
  transfer_masuk: { icon: '🔄', label: 'Transfer Masuk' },
  rejected_kiriman: { icon: '❌', label: 'Ditolak' },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'baru saja';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  return `${d} hr lalu`;
}

function formatTimeLeft(daysLeft: number): string {
  const hours = daysLeft * 24;
  if (hours < 1) return '<1 jam';
  if (hours < 24) return `~${Math.round(hours)} jam`;
  return `~${Math.round(daysLeft)} hari`;
}

export function LiveMonitoringPage() {
  const { data, isLoading: isMonitoringLoading, refetch } = useSPVMonitoringData();
  const { data: recentLedger } = useRecentLedger(50);
  const { data: forecast } = useStockoutForecast(1, 6);
  const { data: wasteToday } = useWasteToday();
  const { data: outletsMaster, isLoading: isOutletsLoading } = useQuery({
    queryKey: ['monitoring', 'outletsList'],
    queryFn: fetchOutletsList,
  });

  const isLoading = isMonitoringLoading || isOutletsLoading;

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Live clock
  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const items = data?.items || [];

  // Group items by outlet and determine their status using master outlets list
  const outlets = useMemo(() => {
    // 1. Group items by outlet_id
    const itemsMap: Record<string, typeof items> = {};
    for (const item of items) {
      if (!itemsMap[item.outlet_id]) {
        itemsMap[item.outlet_id] = [];
      }
      itemsMap[item.outlet_id].push(item);
    }

    // 2. Build complete list of outlets from outletsMaster, with fallback to items if empty
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
      }));
    }

    const list = masterList.map((outlet) => {
      const outletItems = itemsMap[outlet.id] || [];
      
      let kritisCount = 0;
      let menipisCount = 0;
      let status: 'below' | 'warning' | 'ok' = 'ok';
      const lowItems: typeof items = [];
      let lastUpdated: string | null = null;

      for (const item of outletItems) {
        if (item.last_updated && (!lastUpdated || item.last_updated > lastUpdated)) {
          lastUpdated = item.last_updated;
        }
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
        kritisCount,
        menipisCount,
        status,
        lowItems,
        lastUpdated,
        isKitchen: outlet.nama.toUpperCase().includes('KITCHEN'),
      };
    });

    // 3. Sort outlets: below first, then warning, then ok, then by name
    return list.sort((a, b) => {
      const order = { below: 0, warning: 1, ok: 2 };
      if (a.status !== b.status) {
        return order[a.status] - order[b.status];
      }
      return a.outlet_name.localeCompare(b.outlet_name);
    });
  }, [items, outletsMaster]);

  // Kitchen is the central supply source — separate it from the consumer grid.
  const kitchenOutlet = useMemo(() => outlets.find((o) => o.isKitchen) || null, [outlets]);
  const gridOutlets = useMemo(() => outlets.filter((o) => !o.isKitchen), [outlets]);

  // Top-3 most critical items across ALL outlets (lowest qty/threshold ratio).
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

  // Track critical count to trigger alarm chime
  const criticalOutletsCount = useMemo(() => {
    return outlets.filter(o => o.status === 'below').length;
  }, [outlets]);

  const prevCriticalCountRef = useRef(0);

  const playChime = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(784.00, ctx.currentTime); // G5
      osc.frequency.setValueAtTime(987.77, ctx.currentTime + 0.12); // B5
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch (e) {
      console.warn('AudioContext not allowed or not supported:', e);
    }
  };

  useEffect(() => {
    if (isLoading) return;
    if (criticalOutletsCount > prevCriticalCountRef.current) {
      if (soundEnabled) {
        playChime();
      }
      setToastMessage('⚠️ Peringatan: Ada bahan baku baru yang masuk batas kritis!');
      setTimeout(() => setToastMessage(null), 5000);
    }
    prevCriticalCountRef.current = criticalOutletsCount;
  }, [criticalOutletsCount, isLoading, soundEnabled]);

  // Overall statistics
  const stats = useMemo(() => {
    let kritis = 0;
    let menipis = 0;
    let aman = 0;

    for (const o of gridOutlets) {
      if (o.status === 'below') kritis++;
      else if (o.status === 'warning') menipis++;
      else aman++;
    }

    return { kritis, menipis, aman };
  }, [gridOutlets]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  if (isLoading && outlets.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fff8f1]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#701604] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-suka-brown font-bold uppercase tracking-wider text-sm">Menghubungkan ke Live Monitoring System...</p>
        </div>
      </div>
    );
  }

  // Location subdescription helper
  const getSubLocation = (nameStr: string) => {
    const clean = nameStr.replace('SUKA SHAWARMA ', '').toUpperCase();
    if (clean.includes('KITCHEN')) return 'Suka Shawarma';
    if (clean.includes('SUDIRMAN')) return 'Sudirman Center';
    if (clean.includes('KEMANG')) return 'Kemang Raya';
    if (clean.includes('MENTENG')) return 'Menteng Raya';
    if (clean.includes('BINTARO')) return 'Bintaro Plaza';
    if (clean.includes('TEBET')) return 'Tebet Timur';
    const formatted = clean.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return `${formatted} Branch`;
  };

  // Data is "stale" if the outlet hasn't moved any stock in over 15 minutes —
  // a "live" board that silently shows hour-old numbers is dangerous.
  const STALE_MS = 15 * 60 * 1000;
  const getStaleMinutes = (lastUpdated: string | null): number | null => {
    if (!lastUpdated) return null;
    const diff = (currentTime?.getTime() ?? Date.now()) - new Date(lastUpdated).getTime();
    return diff > STALE_MS ? Math.floor(diff / 60000) : null;
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#fff8f1] text-suka-ink">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 bg-red-650 text-white px-5 py-3.5 rounded-xl shadow-2xl border border-white/20 z-50 animate-bounce font-bold text-sm flex items-center gap-2">
          <span>🚨</span> {toastMessage}
        </div>
      )}

      {/* Live Header Banner */}
      <header className="bg-white border-b border-suka-brown/10 px-8 py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm flex-shrink-0">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-red-650 animate-ping"></span>
            <h1 className="text-xl font-extrabold text-[#701604] tracking-tight uppercase">
              LIVE STOCK MONITORING BOARD
            </h1>
          </div>
          <p className="text-xs text-suka-brown/60 font-medium">
            Suka Shawarma 19 Outlets Real-Time Low-Stock Monitor (View-Only)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Stats Bar */}
          <div className="flex items-center gap-4 bg-[#faf2e9] border border-suka-brown/10 px-4 py-2 rounded-xl text-xs font-bold mr-2 shadow-sm">
            <span className="text-red-600">🔴 {stats.kritis} Kritis</span>
            <span className="text-suka-brown/30">|</span>
            <span className="text-orange-600">🟡 {stats.menipis} Menipis</span>
            <span className="text-suka-brown/30">|</span>
            <span className="text-green-700">🟢 {stats.aman} Aman</span>
          </div>

          {/* Waste/shrinkage today — money-leak lens */}
          {wasteToday && wasteToday.count > 0 && (
            <div
              className="flex items-center gap-1.5 bg-red-50 border border-red-500/30 px-3 py-2 rounded-xl text-xs font-bold text-red-700 mr-2 shadow-sm"
              title="Waste, kiriman ditolak, & selisih opname negatif hari ini"
            >
              🗑️ {wasteToday.count} Kerugian Hari Ini
            </div>
          )}

          {currentTime && (
            <span className="text-xs font-bold text-suka-brown/70 bg-suka-cream px-3 py-2 rounded-xl border border-suka-brown/10 flex items-center gap-1.5 shadow-sm">
              📅 {currentTime.toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })} — {currentTime.toLocaleTimeString('id-ID')}
            </span>
          )}

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`px-3 py-2 border rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm ${
              soundEnabled
                ? 'bg-[#701604]/5 border-[#701604] text-[#701604]'
                : 'border-suka-brown/20 text-suka-brown/60 bg-transparent'
            }`}
            title={soundEnabled ? 'Matikan Suara Alarm' : 'Aktifkan Suara Alarm'}
          >
            {soundEnabled ? '🔊 Alarm On' : '🔇 Alarm Muted'}
          </button>

          <button
            onClick={() => {
              refetch();
              showToast('🔄 Memuat ulang data monitoring terbaru...');
            }}
            className="px-4 py-2 bg-[#701604] text-white rounded-xl font-bold text-xs hover:opacity-90 transition-opacity shadow-sm flex items-center gap-1"
          >
            Refresh
          </button>
        </div>
      </header>

      {/* Priority Strip: Top-3 critical items + predictive stockout + Kitchen supply status */}
      {(topCritical.length > 0 || kitchenOutlet || (forecast && forecast.length > 0)) && (
        <section className="flex flex-col lg:flex-row gap-4 px-6 pt-5 flex-shrink-0">
          {/* Top-3 most critical items board-wide */}
          {topCritical.length > 0 && (
            <div className="flex-1 bg-red-50 border border-red-500/30 rounded-2xl px-5 py-3.5 shadow-sm">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-base">⚠️</span>
                <h2 className="text-xs font-extrabold text-red-700 uppercase tracking-wider">
                  Prioritas — Item Paling Kritis
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {topCritical.map((it, i) => (
                  <div key={`${it.outlet_id}-${it.bahan_baku_id}`} className="bg-white rounded-xl border border-red-500/20 px-3 py-2 flex items-center gap-2.5">
                    <span className="text-lg font-black text-red-650/30 leading-none">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-suka-ink truncate">{it.item_name}</p>
                      <p className="text-[10px] text-suka-brown/60 font-medium truncate">
                        {it.outlet_name.replace('SUKA SHAWARMA ', '')}
                      </p>
                      <p className="text-[11px] font-bold text-red-650 mt-0.5">
                        {it.current_qty}<span className="text-suka-brown/40 mx-0.5">/</span>{it.threshold}
                        <span className="text-[9px] font-normal text-suka-brown/50 ml-0.5">{it.satuan}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Predictive stockout — items trending to empty BEFORE hitting threshold */}
          {(() => {
            const predictive = (forecast || []).filter((f) => f.current_qty >= f.threshold);
            if (predictive.length === 0) return null;
            return (
              <div className="flex-1 bg-orange-50 border border-suka-orange/30 rounded-2xl px-5 py-3.5 shadow-sm">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-base">⏳</span>
                  <h2 className="text-xs font-extrabold text-orange-700 uppercase tracking-wider">
                    Prediksi Habis (≤24 jam)
                  </h2>
                </div>
                <div className="space-y-1.5">
                  {predictive.map((f) => (
                    <div key={`${f.outlet_id}-${f.bahan_baku_id}`} className="flex items-center justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate">
                        <span className="font-bold text-suka-ink">{f.item_name}</span>
                        <span className="text-suka-brown/60 font-medium"> · {f.outlet_name.replace('SUKA SHAWARMA ', '')}</span>
                      </span>
                      <span className="flex-shrink-0 font-extrabold text-orange-700">{formatTimeLeft(f.days_left)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Kitchen — central supply source (1 outlet feeds all 18) */}
          {kitchenOutlet && (
            <div className={`lg:w-72 flex-shrink-0 rounded-2xl px-5 py-3.5 shadow-sm border-2 ${
              kitchenOutlet.status === 'below'
                ? 'bg-red-50 border-red-500'
                : kitchenOutlet.status === 'warning'
                ? 'bg-orange-50 border-suka-orange'
                : 'bg-[#faf2e9] border-suka-brown/15'
            }`}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-base">🏭</span>
                <h2 className="text-xs font-extrabold text-[#701604] uppercase tracking-wider">Kitchen Pusat</h2>
                <span className={`ml-auto w-3 h-3 rounded-full ${
                  kitchenOutlet.status === 'below' ? 'bg-red-650 animate-pulse'
                  : kitchenOutlet.status === 'warning' ? 'bg-suka-orange' : 'bg-suka-green'
                }`} />
              </div>
              <p className="text-[10px] text-suka-brown/60 font-medium mb-2">Sumber pasok seluruh outlet</p>
              {kitchenOutlet.status === 'ok' ? (
                <p className="text-xs font-bold text-green-700">🟢 Stok pasok aman</p>
              ) : (
                <div className="space-y-1">
                  <p className={`text-xs font-extrabold ${kitchenOutlet.status === 'below' ? 'text-red-700' : 'text-suka-orange'}`}>
                    {kitchenOutlet.kritisCount > 0 && `${kitchenOutlet.kritisCount} kritis`}
                    {kitchenOutlet.kritisCount > 0 && kitchenOutlet.menipisCount > 0 && ' · '}
                    {kitchenOutlet.menipisCount > 0 && `${kitchenOutlet.menipisCount} menipis`}
                  </p>
                  <p className="text-[10px] text-suka-brown/70 font-medium leading-snug">
                    {kitchenOutlet.lowItems.slice(0, 4).map((it) => it.item_name).join(', ')}
                  </p>
                  {kitchenOutlet.status === 'below' && (
                    <p className="text-[10px] font-bold text-red-650 mt-1">⚠️ mengancam pasok 18 outlet</p>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Grid + Live Activity Feed */}
      <main className="flex-1 flex overflow-hidden">
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {gridOutlets.map((outlet) => {
            const hasIssues = outlet.status !== 'ok';
            const cleanName = outlet.outlet_name.replace('SUKA SHAWARMA ', '').toUpperCase();
            
            let statusBorderClass = 'border-suka-brown/10 hover:border-suka-orange/30 shadow-[0px_4px_12px_rgba(112,22,4,0.04)]';
            let statusHeaderBg = 'bg-[#faf2e9]/50';
            let indicatorCircle = 'bg-suka-green';

            if (outlet.status === 'below') {
              statusBorderClass = 'border-2 border-red-500 bg-white shadow-[0px_6px_16px_rgba(239,68,68,0.15)] ring-2 ring-red-500/10';
              statusHeaderBg = 'bg-red-50';
              indicatorCircle = 'bg-red-650 animate-pulse';
            } else if (outlet.status === 'warning') {
              statusBorderClass = 'border border-suka-orange bg-white shadow-[0px_6px_16px_rgba(242,151,68,0.08)]';
              statusHeaderBg = 'bg-orange-50/50';
              indicatorCircle = 'bg-suka-orange';
            }

            const subLocation = getSubLocation(outlet.outlet_name);
            const staleMinutes = getStaleMinutes(outlet.lastUpdated);

            return (
              <div
                key={outlet.outlet_id}
                className={`bg-white rounded-2xl border flex flex-col overflow-hidden transition-all duration-300 ${statusBorderClass} ${staleMinutes !== null ? 'opacity-60' : ''}`}
              >
                {/* Card Header */}
                <div className={`px-4 py-3 border-b border-suka-brown/10 flex justify-between items-center ${statusHeaderBg}`}>
                  <div className="truncate">
                    <h3 className={`font-extrabold text-sm tracking-wide truncate ${outlet.status === 'below' ? 'text-red-700' : outlet.status === 'warning' ? 'text-suka-orange' : 'text-suka-ink'}`}>
                      {cleanName}
                    </h3>
                    {staleMinutes !== null ? (
                      <p className="text-[10px] text-suka-brown/50 font-bold truncate mt-0.5 flex items-center gap-1" title="Data belum diperbarui">
                        🕒 Data {staleMinutes >= 60 ? `${Math.floor(staleMinutes / 60)} jam` : `${staleMinutes} mnt`} lalu
                      </p>
                    ) : (
                      <p className="text-[10px] text-suka-brown/50 font-medium truncate mt-0.5">{subLocation}</p>
                    )}
                  </div>
                  <span className={`w-3.5 h-3.5 rounded-full border border-white/20 flex-shrink-0 ${indicatorCircle}`} />
                </div>

                {/* Card Body */}
                <div className="p-4 flex-1 flex flex-col justify-between min-h-[120px] bg-white">
                  {!hasIssues ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
                      <span className="text-xl mb-1">🟢</span>
                      <p className="text-xs font-bold text-green-700">Semua Aman</p>
                      <p className="text-[10px] text-green-600/70 font-medium mt-0.5">Stok bahan terpenuhi</p>
                    </div>
                  ) : (
                    <div className="space-y-3.5 flex-1">
                      {outlet.lowItems.map((item) => {
                        const ratio = item.threshold > 0 ? Math.max(0, item.current_qty / item.threshold) : 0;
                        const percent = Math.min(100, Math.round(ratio * 100));
                        
                        let progressColor = 'bg-suka-orange';
                        let textColor = 'text-orange-700';
                        if (item.status === 'below') {
                          progressColor = 'bg-red-650';
                          textColor = 'text-red-650 font-bold';
                        }

                        return (
                          <div key={item.bahan_baku_id} className="space-y-1">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-bold text-suka-ink truncate mr-1">{item.item_name}</span>
                              <span className="flex-shrink-0 text-xs">
                                <span className={`font-extrabold ${textColor}`}>{item.current_qty}</span>
                                <span className="text-[#544437]/35 font-bold mx-0.5">/</span>
                                <span className="text-[#544437]/75 font-semibold">{item.threshold}</span>
                                <span className="text-[9px] font-normal text-suka-brown/50 ml-0.5 capitalize">{item.satuan || (item.item_name.toLowerCase().includes('gas') || item.item_name.toLowerCase().includes('kulit') ? 'pcs' : 'kg')}</span>
                              </span>
                            </div>
                            
                            {/* Stock progress bar */}
                            <div className="w-full h-1.5 bg-suka-cream rounded-full overflow-hidden border border-suka-brown/5">
                              <div
                                className={`h-full rounded-full ${progressColor}`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[8px] font-semibold text-suka-brown/50">
                              <span>Min: {item.threshold}</span>
                              <span>{percent}% Stok</span>
                            </div>
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
      </div>

        {/* Live Activity Feed Sidebar */}
        <aside className="w-80 flex-shrink-0 border-l border-suka-brown/10 bg-white flex flex-col">
          <div className="px-4 py-3 border-b border-suka-brown/10 bg-[#faf2e9]/50 flex items-center gap-2 flex-shrink-0">
            <span className="w-2 h-2 rounded-full bg-red-650 animate-ping" />
            <h2 className="text-xs font-extrabold text-[#701604] uppercase tracking-wider">Recent Update</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {!recentLedger || recentLedger.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4 py-10">
                <span className="text-2xl mb-2 opacity-40">📭</span>
                <p className="text-xs font-bold text-suka-brown/50">Belum ada aktivitas</p>
                <p className="text-[10px] text-suka-brown/40 mt-0.5">Pergerakan stok terbaru akan muncul di sini</p>
              </div>
            ) : (
              <ul className="divide-y divide-suka-brown/5">
                {recentLedger.map((entry) => {
                  const meta = TIPE_META[entry.tipe] || { icon: '•', label: entry.tipe };
                  const isIn = entry.qty > 0;
                  const qtyColor = entry.qty > 0 ? 'text-green-700' : entry.qty < 0 ? 'text-red-650' : 'text-suka-brown/50';
                  const cleanOutlet = entry.outlet_name.replace('SUKA SHAWARMA ', '');
                  return (
                    <li key={entry.id} className="px-4 py-2.5 hover:bg-[#faf2e9]/40 transition-colors">
                      <div className="flex items-start gap-2.5">
                        <span className="text-base leading-none mt-0.5 flex-shrink-0">{meta.icon}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-xs font-bold text-suka-ink truncate">{entry.item_name}</span>
                            <span className={`text-xs font-extrabold flex-shrink-0 ${qtyColor}`}>
                              {isIn ? '+' : ''}{entry.qty}
                              {entry.satuan ? <span className="text-[9px] font-medium text-suka-brown/50 ml-0.5">{entry.satuan}</span> : null}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <span className="text-[10px] text-suka-brown/60 font-medium truncate">
                              <span className="font-bold text-suka-brown/70">{meta.label}</span> · {cleanOutlet}
                            </span>
                            <span className="text-[9px] text-suka-brown/45 font-medium flex-shrink-0">{timeAgo(entry.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
