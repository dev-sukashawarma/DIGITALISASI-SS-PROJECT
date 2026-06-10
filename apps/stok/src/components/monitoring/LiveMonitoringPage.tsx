'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSPVMonitoringData } from '@/hooks/useMonitoringData';
import { useQuery } from '@tanstack/react-query';
import { fetchOutletsList } from '@/lib/queries/monitoring';

export function LiveMonitoringPage() {
  const { data, isLoading: isMonitoringLoading, refetch } = useSPVMonitoringData();
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
        kritisCount,
        menipisCount,
        status,
        lowItems,
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

    for (const o of outlets) {
      if (o.status === 'below') kritis++;
      else if (o.status === 'warning') menipis++;
      else aman++;
    }

    return { kritis, menipis, aman };
  }, [outlets]);

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

      {/* Grid Container for 19 Outlets */}
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {outlets.map((outlet) => {
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

            return (
              <div
                key={outlet.outlet_id}
                className={`bg-white rounded-2xl border flex flex-col overflow-hidden transition-all duration-300 ${statusBorderClass}`}
              >
                {/* Card Header */}
                <div className={`px-4 py-3 border-b border-suka-brown/10 flex justify-between items-center ${statusHeaderBg}`}>
                  <div className="truncate">
                    <h3 className={`font-extrabold text-sm tracking-wide truncate ${outlet.status === 'below' ? 'text-red-700' : outlet.status === 'warning' ? 'text-suka-orange' : 'text-suka-ink'}`}>
                      {cleanName}
                    </h3>
                    <p className="text-[10px] text-suka-brown/50 font-medium truncate mt-0.5">{subLocation}</p>
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
                              <span className={`flex-shrink-0 font-extrabold ${textColor}`}>
                                {item.current_qty} <span className="text-[9px] font-normal text-suka-brown/50">{item.item_name.toLowerCase().includes('gas') || item.item_name.toLowerCase().includes('kulit') ? 'pcs' : 'kg'}</span>
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
      </main>
    </div>
  );
}
