'use client';

import React, { useState, useMemo } from 'react';
import { SPVTabs } from './SPVTabs';
import { SPVTable } from './SPVTable';
import { MonitoringDetailModal } from './MonitoringDetailModal';
import { TransferModal } from './TransferModal';
import { TransferSuggestionPanel } from './TransferSuggestionPanel';
import type { TransferSuggestion } from '@/lib/stok/transferSuggestion';
import {
  useSPVMonitoringData,
  useLeaderMonitoringData,
  useRecentLedger,
  useStockoutForecast,
  useWasteToday
} from '@/hooks/useMonitoringData';
import type { MonitoringItem } from '@/lib/types/monitoring';
import Link from 'next/link';
import { useAuth } from '@suka/auth';
import { useApprovalList } from '@/hooks/usePermintaan';
import { ApprovalList } from '../permintaan/ApprovalList';
import { Skeleton } from '@suka/design-system';

const getOutletRegion = (outletName: string): 'Central Kitchen' | 'Jakarta' | 'Bogor' | 'Depok' | 'Bekasi' | 'Tangerang' => {
  const name = outletName.toUpperCase();
  if (name.includes('KITCHEN')) return 'Central Kitchen';
  if (name.includes('JATIASIH') || name.includes('JATIWANGIN')) return 'Bekasi';
  if (name.includes('CIRENDEU')) return 'Tangerang';
  if (name.includes('CIBINONG') || name.includes('CISEENG') || name.includes('CITAYAM') || name.includes('DRAMAGA') || name.includes('EMPANG') || name.includes('BEJI')) return 'Bogor';
  if (name.includes('DEPOK') || name.includes('SUKMAJAYA') || name.includes('PALEDANG') || name.includes('PAJA JARAN')) return 'Depok';
  if (name.includes('PEKAYON') || name.includes('JATIASIH') || name.includes('JATIWANGIN')) return 'Bekasi';
  if (name.includes('CIMANGGU')) return 'Bogor';
  if (name.includes('TEBET') || name.includes('KALISARI') || name.includes('JAGAKARSA')) return 'Jakarta';
  return 'Jakarta'; // Default
};

export function SPVDashboard({ allowedOutletIds }: { allowedOutletIds?: string[] } = {}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'alerts' | 'approval'>('overview');
  const [selectedItem, setSelectedItem] = useState<MonitoringItem | null>(null);
  
  // State for split view outlet selection
  const [selectedOutletId, setSelectedOutletId] = useState<string | null>(null);
  
  // State for Transfer modal
  const [transferItem, setTransferItem] = useState<MonitoringItem | null>(null);
  
  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Live clock state
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  // Collapsible sidebar state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Notification dropdown open state
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  React.useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Search and filter states for the right-hand detail pane
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'below' | 'warning' | 'ok'>('all');

  // Auth context for username
  const { outletStaff } = useAuth();

  const isLeaderScoped = !!allowedOutletIds;
  const spvQuery = useSPVMonitoringData(!isLeaderScoped);
  const leaderQuery = useLeaderMonitoringData(isLeaderScoped);
  const { data, isLoading, isError, lastFetched } = isLeaderScoped ? leaderQuery : spvQuery;

  // Real-time and proactive hooks
  const recentLedgerQuery = useRecentLedger(15);
  const stockoutForecastQuery = useStockoutForecast(1, 6);
  const wasteTodayQuery = useWasteToday();

  // Pending request approvals hook
  const { permintaan: pendingApprovals } = useApprovalList();

  // Filter pro-active hooks data based on leader scoped access (allowedOutletIds)
  const recentLedger = useMemo(() => {
    const raw = recentLedgerQuery.data || [];
    if (!allowedOutletIds) return raw;
    return raw.filter(entry => allowedOutletIds.includes(entry.outlet_id));
  }, [recentLedgerQuery.data, allowedOutletIds]);

  const stockoutForecast = useMemo(() => {
    const raw = stockoutForecastQuery.data || [];
    if (!allowedOutletIds) return raw;
    return raw.filter(item => allowedOutletIds.includes(item.outlet_id));
  }, [stockoutForecastQuery.data, allowedOutletIds]);

  const wasteToday = useMemo(() => {
    const raw = wasteTodayQuery.data?.entries || [];
    if (!allowedOutletIds) return raw;
    return raw.filter(entry => allowedOutletIds.includes(entry.outlet_id));
  }, [wasteTodayQuery.data?.entries, allowedOutletIds]);

  // Compute stats specifically for the selected outlet
  const outletForecastCount = useMemo(() => {
    if (!selectedOutletId) return 0;
    return stockoutForecast.filter(f => f.outlet_id === selectedOutletId).length;
  }, [stockoutForecast, selectedOutletId]);

  const outletWasteCount = useMemo(() => {
    if (!selectedOutletId) return 0;
    return wasteToday.filter(w => w.outlet_id === selectedOutletId).length;
  }, [wasteToday, selectedOutletId]);


  // Local state override for edited thresholds to allow immediate UI response
  const [localThresholdOverrides, setLocalThresholdOverrides] = useState<Record<string, number>>({});

  // Compute final items with local threshold overrides
  const items = useMemo(() => {
    const originalItems = (data?.items || []).filter(
      (item) => !allowedOutletIds || allowedOutletIds.includes(item.outlet_id)
    );
    return originalItems.map(item => {
      const overrideKey = `${item.outlet_id}-${item.bahan_baku_id}`;
      if (localThresholdOverrides[overrideKey] !== undefined) {
        const customVal = localThresholdOverrides[overrideKey];
        // Re-evaluate status based on new threshold
        let newStatus = item.status;
        if (item.current_qty < customVal / 2) {
          newStatus = 'below';
        } else if (item.current_qty < customVal) {
          newStatus = 'warning';
        } else {
          newStatus = 'ok';
        }
        return {
          ...item,
          threshold: customVal,
          status: newStatus,
        };
      }
      return item;
    });
  }, [data?.items, localThresholdOverrides, allowedOutletIds]);

  const alertCount = useMemo(() => {
    return items.filter((item) => item.status !== 'ok' || item.is_flagged).length;
  }, [items]);

  // Filter items that are critical globally for notifications
  const criticalAlertItems = useMemo(() => {
    return items.filter(it => it.status === 'below');
  }, [items]);

  const totalNotificationCount = criticalAlertItems.length + pendingApprovals.length;

  // Stats computations for the selected outlet
  const currentOutletItems = useMemo(() => {
    if (!selectedOutletId) return [];
    return items.filter(item => item.outlet_id === selectedOutletId);
  }, [items, selectedOutletId]);

  const criticalCount = useMemo(() => {
    return currentOutletItems.filter(item => item.status === 'below').length;
  }, [currentOutletItems]);

  const healthScore = useMemo(() => {
    const total = currentOutletItems.length;
    if (total === 0) return 100;
    const okCount = currentOutletItems.filter(item => item.status === 'ok').length;
    return Math.round((okCount / total) * 100);
  }, [currentOutletItems]);

  // Group items by outlet, then by region
  const outlets = useMemo(() => {
    const outletMap: Record<string, {
      outlet_id: string;
      outlet_name: string;
      region: string;
      items: typeof items;
      kritisCount: number;
      menipisCount: number;
      status: 'below' | 'warning' | 'ok';
    }> = {};

    for (const item of items) {
      if (!outletMap[item.outlet_id]) {
        outletMap[item.outlet_id] = {
          outlet_id: item.outlet_id,
          outlet_name: item.outlet_name,
          region: getOutletRegion(item.outlet_name),
          items: [],
          kritisCount: 0,
          menipisCount: 0,
          status: 'ok',
        };
      }
      const o = outletMap[item.outlet_id];
      o.items.push(item);
      if (item.status === 'below') {
        o.kritisCount++;
        o.status = 'below';
      } else if (item.status === 'warning') {
        o.menipisCount++;
        if (o.status !== 'below') {
          o.status = 'warning';
        }
      }
    }

    const outletList = Object.values(outletMap).sort((a, b) => {
      const order = { below: 0, warning: 1, ok: 2 };
      if (a.status !== b.status) {
        return order[a.status] - order[b.status];
      }
      return a.outlet_name.localeCompare(b.outlet_name);
    });

    // Group by region
    const regionMap: Record<string, typeof outletList> = {};
    for (const outlet of outletList) {
      if (!regionMap[outlet.region]) {
        regionMap[outlet.region] = [];
      }
      regionMap[outlet.region].push(outlet);
    }

    return { byOutlet: outletList, byRegion: regionMap };
  }, [items]);

  // Automatically set first outlet as active on initial load
  React.useEffect(() => {
    if (outlets.byOutlet.length > 0 && !selectedOutletId) {
      setSelectedOutletId(outlets.byOutlet[0].outlet_id);
    }
  }, [outlets, selectedOutletId]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleRestockRequest = (item: MonitoringItem) => {
    showToast(`✅ Permintaan Pengisian Ulang dikirim ke Pusat: ${item.item_name} untuk ${item.outlet_name}`);
  };

  const handleTransferConfirm = (sourceOutletId: string, qty: number) => {
    if (!transferItem) return;
    const sourceOutletName = outlets.byOutlet.find(o => o.outlet_id === sourceOutletId)?.outlet_name || 'Outlet Asal';
    showToast(`✅ Transfer Stok Berhasil: ${qty} unit ${transferItem.item_name} dipindahkan dari ${sourceOutletName} ke ${transferItem.outlet_name}`);
    setTransferItem(null);
  };

  const handleSuggestionTransfer = (suggestion: TransferSuggestion) => {
    const recipientItem = (items ?? []).find(
      (i) =>
        i.outlet_id === suggestion.recipientOutletId &&
        i.bahan_baku_id === suggestion.bahan_baku_id
    );
    if (recipientItem) setTransferItem(recipientItem);
  };

  const handleThresholdChange = (outletId: string, bahanBakuId: string, value: number) => {
    const overrideKey = `${outletId}-${bahanBakuId}`;
    setLocalThresholdOverrides(prev => ({
      ...prev,
      [overrideKey]: value
    }));
    showToast(`✅ Batas minimum (Threshold) diperbarui menjadi ${value}`);
  };



  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com'
  let resolvedPortalUrl = portalUrl
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    resolvedPortalUrl = 'http://localhost:3010'
  }

  const renderNotificationBell = () => {
    return (
      <div className="relative">
        <button
          onClick={() => setIsNotificationOpen(!isNotificationOpen)}
          className="text-suka-brown/60 hover:text-suka-orange p-2 rounded-full transition-colors relative flex items-center justify-center hover:bg-suka-brown/5"
          title="Notifikasi"
        >
          <span className="text-xl">🔔</span>
          {totalNotificationCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-red-650 text-white text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center font-bold border-2 border-white shadow-sm">
              {totalNotificationCount}
            </span>
          )}
        </button>
        
        {isNotificationOpen && (
          <div className="absolute right-0 mt-3 w-80 bg-white border border-[#d9c2b2] rounded-2xl shadow-xl z-50 p-4 space-y-3 text-sm text-[#1e1b15] animate-in fade-in slide-in-from-top-2 duration-150">
            <h4 className="font-black text-xs text-suka-brown tracking-wider uppercase border-b border-suka-brown/10 pb-2 flex justify-between items-center">
              <span>Notifikasi ({totalNotificationCount})</span>
            </h4>
            <div className="max-h-[280px] overflow-y-auto space-y-2 pr-1">
              {totalNotificationCount === 0 ? (
                <p className="text-xs text-suka-brown/50 italic text-center py-6 font-medium">
                  Tidak ada notifikasi baru
                </p>
              ) : (
                <>
                  {/* Critical Stock Alerts */}
                  {criticalAlertItems.map((alert) => (
                    <div key={`${alert.outlet_id}-${alert.bahan_baku_id}`} className="p-2.5 bg-red-50/50 border border-red-200/60 rounded-xl flex items-start gap-2">
                      <span className="text-xs">🚨</span>
                      <div className="flex-1">
                        <p className="text-xs font-black text-red-950 uppercase tracking-wide">{alert.item_name}</p>
                        <p className="text-[10px] text-red-800 font-medium">
                          Stok kritis di {alert.outlet_name.replace('SUKA SHAWARMA ', '')} ({alert.current_qty} {alert.satuan})
                        </p>
                      </div>
                    </div>
                  ))}
                  
                  {/* Request Approvals Alerts */}
                  {pendingApprovals.map((req) => (
                    <div key={req.id} className="p-2.5 bg-[#ffdcc2]/20 border border-[#ffdcc2]/65 rounded-xl flex items-start gap-2">
                      <span className="text-xs">⏳</span>
                      <div className="flex-1">
                        <p className="text-xs font-black text-[#6d3900] uppercase tracking-wide">Persetujuan Bahan</p>
                        <p className="text-[10px] text-[#544437] font-medium">
                          Permintaan dari {req.outlet_name ?? req.outlet_id} ({req.items.length} item)
                        </p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col md:h-screen md:overflow-hidden bg-[#fff8f1] text-[#1e1b15] min-h-screen">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 bg-suka-orange text-white px-4 py-3 rounded-lg shadow-lg border border-white/20 z-50 animate-bounce font-bold text-sm">
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-45 bg-white border-b border-suka-brown/10 px-4 md:px-6 py-3 md:py-4 flex flex-col md:flex-row md:justify-between md:items-center shadow-sm flex-shrink-0 gap-3 md:gap-0">
        <div className="flex items-center justify-between w-full md:w-auto">
          <div className="flex items-center gap-2 md:gap-3">
            <Link href="/dashboard" className="w-8 h-8 flex items-center justify-center rounded-full bg-[#faf2e9] hover:bg-[#f5ede3] border border-[#d9c2b2]/50 text-[#701604] transition-colors" title="Kembali ke Dashboard">
              ←
            </Link>
            <img src="/logo.png" alt="Logo Suka Shawarma" className="h-8 md:h-10 w-auto object-contain" />
            <div className="flex flex-col">
              <h2 className="text-base md:text-xl font-bold text-[#701604] tracking-tight">SPV Monitoring Dashboard</h2>
              <p className="hidden md:block text-xs text-suka-brown/70 font-semibold mt-0.5">
                Halo, {outletStaff?.name || 'Supervisor'} | Last updated: {lastFetched ? new Date(lastFetched).toLocaleTimeString('id-ID') : 'Never'}
              </p>
            </div>
          </div>

          {/* Mobile-only tools */}
          <div className="flex items-center gap-2 md:hidden">
            {isError && <span className="text-xs" title="Koneksi tidak stabil">⚠️</span>}
            <a
              href={resolvedPortalUrl}
              className="text-[11px] font-bold text-suka-brown/70 hover:text-suka-brown bg-[#faf2e9]/50 px-2.5 py-1 rounded-lg border border-suka-brown/15 transition-all"
            >
              Portal
            </a>
            {renderNotificationBell()}
          </div>
        </div>

        {/* Desktop-only info and tools */}
        <div className="hidden md:flex items-center gap-3">
          {isError && (
            <div className="bg-yellow-50 text-yellow-700 px-3 py-1.5 rounded-lg text-xs border border-yellow-200">
              Koneksi tidak stabil, menampilkan data lokal cache
            </div>
          )}
          
          {currentTime && (
            <span className="text-xs font-semibold text-suka-brown/70 bg-[#fff7ed] px-3 py-1.5 rounded-lg border border-suka-brown/10 shadow-sm flex items-center gap-1.5">
              📅 {currentTime.toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })} — {currentTime.toLocaleTimeString('id-ID')}
            </span>
          )}

          <div className="h-8 w-[1px] bg-suka-brown/10 mx-1"></div>

          <a
            href={resolvedPortalUrl}
            className="text-xs font-bold text-suka-brown/70 hover:text-suka-brown bg-white hover:bg-suka-cream px-3 py-1.5 rounded-lg border border-suka-brown/20 transition-all active:scale-95 flex items-center gap-1 shrink-0"
          >
            ← Portal
          </a>

          {renderNotificationBell()}
        </div>

        {/* Mobile-only identity info & updated time */}
        <div className="flex md:hidden justify-between items-center text-[10px] text-suka-brown/70 font-semibold border-t border-suka-brown/5 pt-2 w-full">
          <span>Halo, {outletStaff?.name || 'Supervisor'}</span>
          <span>Update: {lastFetched ? new Date(lastFetched).toLocaleTimeString('id-ID') : 'Never'}</span>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex-shrink-0">
        <SPVTabs activeTab={activeTab} onTabChange={setActiveTab} alertCount={alertCount} approvalCount={pendingApprovals.length} />
      </div>

      {/* Mobile Outlets Horizontal Strip */}
      {activeTab === 'overview' && (
        <div className="flex md:hidden overflow-x-auto gap-2 px-4 py-2.5 bg-[#faf2e9] border-b border-[#d9c2b2]/20 scrollbar-none flex-shrink-0 w-full">
          {outlets.byOutlet.map((outlet) => {
            const isActive = selectedOutletId === outlet.outlet_id;
            const cleanName = outlet.outlet_name.replace('SUKA SHAWARMA ', '').toUpperCase();
            let statusCircleColor = 'bg-suka-green';
            if (outlet.status === 'below') statusCircleColor = 'bg-red-650 animate-pulse';
            else if (outlet.status === 'warning') statusCircleColor = 'bg-suka-orange';

            return (
              <button
                key={outlet.outlet_id}
                onClick={() => setSelectedOutletId(outlet.outlet_id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 ${
                  isActive
                    ? 'border-suka-orange bg-white text-suka-orange shadow-sm scale-102'
                    : 'border-suka-brown/10 bg-white/80 text-suka-brown hover:border-suka-orange/30'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${statusCircleColor}`} />
                <span>{cleanName}</span>
                {outlet.status !== 'ok' && (
                  <span className="text-[10px] text-suka-brown/40 font-normal">
                    ({outlet.status === 'below' ? outlet.kritisCount : outlet.menipisCount})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Overview Tab - Split view */}
        {activeTab === 'overview' && (
          <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">
            {/* Left Column: Outlets (Collapsible) - Desktop Only */}
            <aside className={`hidden md:block ${isSidebarCollapsed ? 'md:w-[60px] p-2' : 'md:w-[250px] lg:w-[22%] p-6'} bg-[#faf2e9] border-r border-[#d9c2b2] overflow-y-auto space-y-6 transition-all duration-300 flex-shrink-0`}>
              <div className="flex justify-between items-center border-b border-suka-brown/10 pb-2">
                {!isSidebarCollapsed && (
                  <h3 className="font-bold text-xs text-suka-brown/70 tracking-wider uppercase">
                    {allowedOutletIds ? `Outlet Binaan (${allowedOutletIds.length})` : 'Daftar 19 Outlet'}
                  </h3>
                )}
                <button
                  onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  className="w-6 h-6 flex items-center justify-center rounded-lg bg-white border border-suka-brown/15 text-suka-brown hover:bg-suka-brown/5 text-xs font-bold transition-all mx-auto"
                  title={isSidebarCollapsed ? "Tampilkan Sidebar" : "Sembunyikan Sidebar"}
                >
                  {isSidebarCollapsed ? "→" : "←"}
                </button>
              </div>
              
              <div className="flex flex-col gap-6">
                {isLoading && !data ? (
                  [1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2 px-2">
                      {!isSidebarCollapsed && <Skeleton className="h-3 w-16" />}
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ))
                ) : (
                  ['Central Kitchen', 'Bogor', 'Jakarta', 'Depok', 'Bekasi', 'Tangerang'].map((region) => {
                    const regionOutlets = outlets.byRegion[region] || [];
                    if (regionOutlets.length === 0) return null;
                  
                  return (
                    <div key={region} className="flex flex-col gap-2">
                      {!isSidebarCollapsed && (
                        <h4 className="text-xs font-bold text-suka-orange/70 uppercase tracking-widest px-2">
                          {region}
                        </h4>
                      )}
                      <div className="flex flex-col gap-2">
                        {regionOutlets.map((outlet) => {
                          const isActive = selectedOutletId === outlet.outlet_id;
                          const cleanName = outlet.outlet_name.replace('SUKA SHAWARMA ', '').toUpperCase();
                          const shortName = cleanName.slice(0, 3);
                          
                          let statusCircleColor = 'bg-suka-green';
                          if (outlet.status === 'below') statusCircleColor = 'bg-red-650 animate-pulse';
                          else if (outlet.status === 'warning') statusCircleColor = 'bg-suka-orange';

                          const getSubLocation = (nameStr: string) => {
                            if (nameStr.includes('KITCHEN')) return 'Suka Shawarma';
                            if (nameStr.includes('SUDIRMAN')) return 'Sudirman Center';
                            if (nameStr.includes('KEMANG')) return 'Kemang Raya';
                            if (nameStr.includes('MENTENG')) return 'Menteng Raya';
                            if (nameStr.includes('BINTARO')) return 'Bintaro Plaza';
                            if (nameStr.includes('TEBET')) return 'Tebet Timur';
                            
                            const formatted = nameStr.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                            return `${formatted} Branch`;
                          };

                          const subLocation = getSubLocation(cleanName);

                          if (isSidebarCollapsed) {
                            return (
                              <button
                                key={outlet.outlet_id}
                                onClick={() => setSelectedOutletId(outlet.outlet_id)}
                                className={`flex items-center justify-center p-2 rounded-lg border relative transition-all ${
                                  isActive
                                    ? 'border-suka-orange bg-white shadow-sm'
                                    : 'border-suka-brown/10 bg-white hover:border-suka-orange/30'
                                }`}
                                title={`${cleanName} (${outlet.status === 'below' ? 'Kritis' : outlet.status === 'warning' ? 'Menipis' : 'Aman'})`}
                              >
                                <span className={`w-3.5 h-3.5 rounded-full ${statusCircleColor} flex items-center justify-center text-[8px] text-white font-bold`}>
                                  {outlet.status !== 'ok' ? (outlet.status === 'below' ? outlet.kritisCount : outlet.menipisCount) : ''}
                                </span>
                                <span className="absolute -top-1 -right-1 text-[8px] font-black text-suka-brown/40">{shortName}</span>
                              </button>
                            );
                          }

                          return (
                            <button
                              key={outlet.outlet_id}
                              onClick={() => setSelectedOutletId(outlet.outlet_id)}
                              className={`text-left p-4 rounded-xl border transition-all ${
                                isActive
                                  ? 'border-2 border-suka-orange bg-white shadow-[0px_4px_12px_rgba(112,22,4,0.08)]'
                                  : 'border-suka-brown/10 bg-white hover:border-suka-orange/30'
                              }`}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <h4 className={`font-bold text-sm uppercase tracking-wide ${isActive ? 'text-suka-orange' : 'text-suka-ink'}`}>
                                  {cleanName}
                                </h4>
                                <div className={`w-3 h-3 rounded-full ${statusCircleColor}`} />
                              </div>
                              <div className="flex items-center gap-2 text-xs font-semibold">
                                {outlet.status === 'below' && (
                                  <span className="text-red-650 font-bold">{outlet.kritisCount} Kritis</span>
                                )}
                                {outlet.status === 'warning' && (
                                  <span className="text-orange-650 font-bold">{outlet.menipisCount} Menipis</span>
                                )}
                                {outlet.status === 'ok' && (
                                  <span className="text-green-700">Aman</span>
                                )}
                                <span className="text-suka-brown/30">•</span>
                                <span className="text-suka-brown/60 font-medium">{subLocation}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
              </div>
            </aside>

            {/* Middle Column: Details & Tables */}
            <section className="flex-shrink-0 md:flex-1 bg-white flex flex-col border-b md:border-b-0 md:border-r border-[#d9c2b2] overflow-visible md:overflow-hidden">
              {isLoading && !data ? (
                <div className="flex-1 flex flex-col p-4 md:p-6 bg-white border border-suka-brown/10 rounded-xl space-y-6 overflow-y-auto">
                  <Skeleton className="h-8 w-48" />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                  <SPVTable
                    items={[]}
                    tab="overview"
                    loading={true}
                    onRowClick={setSelectedItem}
                  />
                </div>
              ) : selectedOutletId ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Sub-header with search & filters */}
                  <div className="p-4 md:p-6 border-b border-suka-brown/10 flex flex-col gap-4 bg-white z-10 flex-shrink-0 shadow-sm">
                    <div className="flex justify-between items-center flex-wrap gap-4">
                      <h3 className="text-base md:text-lg font-black text-[#701604] uppercase tracking-tight">
                        DETAIL STOK: {outlets.byOutlet.find(o => o.outlet_id === selectedOutletId)?.outlet_name.replace('SUKA SHAWARMA ', '')}
                      </h3>
                      <div className="relative w-full sm:w-auto">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-suka-brown/50 text-sm">🔍</span>
                        <input
                          className="pl-9 pr-4 py-2 bg-[#faf2e9]/40 border border-[#d9c2b2]/80 focus:border-suka-orange focus:ring-1 focus:ring-suka-orange rounded-xl text-sm w-full sm:w-64 transition-all font-bold placeholder-suka-brown/40"
                          placeholder="Cari nama bahan..."
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Filter buttons */}
                    <div className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm font-bold text-suka-brown flex-wrap">
                      <label className="flex items-center gap-1.5 cursor-pointer group">
                        <input
                          type="radio"
                          name="filter"
                          checked={filterStatus === 'all'}
                          onChange={() => setFilterStatus('all')}
                          className="w-4 h-4 text-suka-orange border-suka-brown/30 focus:ring-suka-orange accent-suka-orange"
                        />
                        <span className="group-hover:text-suka-orange transition-colors">Semua</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer group text-red-650">
                        <input
                          type="radio"
                          name="filter"
                          checked={filterStatus === 'below'}
                          onChange={() => setFilterStatus('below')}
                          className="w-4 h-4 border-red-300 focus:ring-red-500 accent-red-650"
                        />
                        <span className="group-hover:opacity-80 transition-opacity">Kritis (Below)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer group text-orange-650">
                        <input
                          type="radio"
                          name="filter"
                          checked={filterStatus === 'warning'}
                          onChange={() => setFilterStatus('warning')}
                          className="w-4 h-4 border-orange-300 focus:ring-orange-500 accent-orange-650"
                        />
                        <span className="group-hover:opacity-80 transition-opacity">Menipis (Warning)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer group text-green-700">
                        <input
                          type="radio"
                          name="filter"
                          checked={filterStatus === 'ok'}
                          onChange={() => setFilterStatus('ok')}
                          className="w-4 h-4 border-green-300 focus:ring-green-500 accent-green-650"
                        />
                        <span className="group-hover:opacity-80 transition-opacity">Aman (OK)</span>
                      </label>
                    </div>
                  </div>

                  {/* Scrollable table & KPI Summary Grid */}
                  <div className="flex-1 p-4 md:p-6 overflow-visible md:overflow-y-auto space-y-6">
                    {/* KPI Widgets Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                      {/* KPI 1: Stok Kritis */}
                      <button
                        onClick={() => setFilterStatus('below')}
                        className={`bg-white border-2 rounded-2xl p-4 text-left shadow-[0px_4px_12px_rgba(112,22,4,0.04)] hover:scale-102 transition-all flex flex-col justify-between group h-24 ${
                          filterStatus === 'below' ? 'border-[#ba1a1a] bg-[#ffdad6]/10' : 'border-[#d9c2b2]/40'
                        }`}
                      >
                        <span className="text-[10px] font-black uppercase text-[#ba1a1a] tracking-wider flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-[#ba1a1a] animate-pulse"></span>
                          Stok Kritis
                        </span>
                        <div className="flex items-baseline gap-1 mt-2">
                          <span className="text-2xl font-black text-[#ba1a1a]">{criticalCount}</span>
                          <span className="text-[10px] text-suka-brown/60 font-semibold">bahan</span>
                        </div>
                      </button>

                      {/* KPI 2: Forecasted Stockouts */}
                      <div className="bg-white border-2 border-[#d9c2b2]/40 rounded-2xl p-4 text-left shadow-[0px_4px_12px_rgba(112,22,4,0.04)] flex flex-col justify-between h-24">
                        <span className="text-[10px] font-black uppercase text-suka-orange tracking-wider flex items-center gap-1">
                          <span>⏳</span>
                          Forecast 24j
                        </span>
                        <div className="flex items-baseline gap-1 mt-2">
                          <span className="text-2xl font-black text-suka-orange">{outletForecastCount}</span>
                          <span className="text-[10px] text-suka-brown/60 font-semibold">akan habis</span>
                        </div>
                      </div>

                      {/* KPI 3: Waste Events Today */}
                      <div className="bg-white border-2 border-[#d9c2b2]/40 rounded-2xl p-4 text-left shadow-[0px_4px_12px_rgba(112,22,4,0.04)] flex flex-col justify-between h-24">
                        <span className="text-[10px] font-black uppercase text-[#701604] tracking-wider flex items-center gap-1">
                          <span>🗑️</span>
                          Waste Hari Ini
                        </span>
                        <div className="flex items-baseline gap-1 mt-2">
                          <span className="text-2xl font-black text-[#701604]">{outletWasteCount}</span>
                          <span className="text-[10px] text-suka-brown/60 font-semibold">kejadian</span>
                        </div>
                      </div>

                      {/* KPI 4: Health Score */}
                      <button
                        onClick={() => setFilterStatus('ok')}
                        className={`bg-white border-2 rounded-2xl p-4 text-left shadow-[0px_4px_12px_rgba(112,22,4,0.04)] hover:scale-102 transition-all flex flex-col justify-between group h-24 ${
                          filterStatus === 'ok' ? 'border-suka-green bg-green-50/10' : 'border-[#d9c2b2]/40'
                        }`}
                      >
                        <span className="text-[10px] font-black uppercase text-suka-green tracking-wider flex items-center gap-1">
                          <span>✅</span>
                          Health Score
                        </span>
                        <div className="flex items-baseline gap-1 mt-2">
                          <span className="text-2xl font-black text-suka-green">{healthScore}%</span>
                          <span className="text-[10px] text-suka-brown/60 font-semibold">optimal</span>
                        </div>
                      </button>
                    </div>

                    {/* Stock Detail Table */}
                    <SPVTable
                      items={items}
                      tab="overview"
                      selectedOutletId={selectedOutletId}
                      searchTerm={searchTerm}
                      filterStatus={filterStatus}
                      hideFilters={true}
                      onRowClick={setSelectedItem}
                      onThresholdChange={handleThresholdChange}
                      onRestockRequest={handleRestockRequest}
                      onTransferRequest={setTransferItem}
                      loading={isLoading && !data}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-suka-brown/50 text-sm font-semibold bg-white p-6 text-center gap-2">
                  <span className="text-4xl">🥙</span>
                  <p>Pilih outlet untuk melihat detail bahan baku</p>
                </div>
              )}
            </section>

            {/* Right Column: Action & Predictive Hub (Action Drawer) */}
            <aside className="w-full md:w-[320px] lg:w-[28%] xl:w-[23%] bg-[#faf2e9] overflow-visible md:overflow-y-auto p-4 flex flex-col gap-6 flex-shrink-0 border-t md:border-t-0 border-[#d9c2b2]">
              {/* Widget 0: Approval Permintaan */}
              <div className="bg-white p-4 rounded-2xl border border-[#d9c2b2]/60 shadow-[0px_2px_8px_rgba(112,22,4,0.02)] space-y-3">
                <h3 className="font-black text-xs text-suka-brown tracking-wider uppercase border-b border-suka-brown/10 pb-2 flex items-center gap-1.5">
                  <span>📝</span> Approval Permintaan
                </h3>
                <div className="max-h-[300px] overflow-y-auto pr-1">
                  <ApprovalList />
                </div>
              </div>

              {/* Widget 1: Saran Transfer */}
              <div className="bg-white p-4 rounded-2xl border border-[#d9c2b2]/60 shadow-[0px_2px_8px_rgba(112,22,4,0.02)] space-y-3">
                <h3 className="font-black text-xs text-suka-brown tracking-wider uppercase border-b border-suka-brown/10 pb-2 flex items-center gap-1.5">
                  <span>🔄</span> Saran Transfer
                </h3>
                <div className="max-h-[300px] overflow-y-auto pr-1">
                  <TransferSuggestionPanel
                    items={items ?? []}
                    onTransfer={handleSuggestionTransfer}
                  />
                </div>
              </div>

              {/* Widget 2: Predictive Stockouts (Forecast) */}
              <div className="bg-white p-4 rounded-2xl border border-[#d9c2b2]/60 shadow-[0px_2px_8px_rgba(112,22,4,0.02)] space-y-3">
                <h3 className="font-black text-xs text-[#701604] tracking-wider uppercase border-b border-[#701604]/10 pb-2 flex items-center gap-1.5">
                  <span>🔮</span> Prediksi Habis (&lt;24j)
                </h3>
                <div className="space-y-2">
                  {selectedOutletId ? (
                    stockoutForecast.filter(f => f.outlet_id === selectedOutletId).length === 0 ? (
                      <p className="text-[11px] text-suka-brown/50 italic text-center py-2">
                        Stok terpantau aman hingga 24 jam ke depan
                      </p>
                    ) : (
                      stockoutForecast.filter(f => f.outlet_id === selectedOutletId).map((f) => (
                        <div key={f.bahan_baku_id} className="p-2.5 bg-red-50 border border-red-200/80 rounded-xl flex items-center justify-between text-xs">
                          <div>
                            <p className="font-extrabold text-red-950 uppercase tracking-wide">{f.item_name}</p>
                            <p className="text-[10px] text-red-800 font-medium">Sisa {f.days_left * 24} jam ({f.current_qty} {f.satuan})</p>
                          </div>
                          <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-black uppercase">
                            Warning
                          </span>
                        </div>
                      ))
                    )
                  ) : (
                    <p className="text-[11px] text-suka-brown/50 italic text-center py-2">
                      Pilih outlet untuk melihat forecast
                    </p>
                  )}
                </div>
              </div>

              {/* Widget 3: Live Activity Feed */}
              <div className="bg-white p-4 rounded-2xl border border-[#d9c2b2]/60 shadow-[0px_2px_8px_rgba(112,22,4,0.02)] space-y-3">
                <h3 className="font-black text-xs text-suka-brown tracking-wider uppercase border-b border-suka-brown/10 pb-2 flex items-center gap-1.5">
                  <span>⚡</span> Live Activity
                </h3>
                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {selectedOutletId ? (
                    recentLedger.filter(l => l.outlet_id === selectedOutletId).slice(0, 5).length === 0 ? (
                      <p className="text-[11px] text-suka-brown/50 italic text-center py-2">
                        Belum ada aktivitas hari ini
                      </p>
                    ) : (
                      recentLedger.filter(l => l.outlet_id === selectedOutletId).slice(0, 5).map((l) => {
                        const dateObj = new Date(l.created_at);
                        const timeStr = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                        const isAdd = l.qty > 0;
                        return (
                          <div key={l.id} className="p-2.5 bg-suka-cream/5 border border-suka-brown/10 rounded-xl flex flex-col gap-1 text-[11px]">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-suka-ink uppercase tracking-wide truncate max-w-[120px]">{l.item_name}</span>
                              <span className={`px-1.5 py-0.5 rounded font-mono text-[9px] font-black ${
                                isAdd ? 'bg-suka-green/10 text-suka-green' : 'bg-red-50 text-[#ba1a1a]'
                              }`}>
                                {isAdd ? '+' : ''}{l.qty}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-[9px] text-suka-brown/50">
                              <span className="bg-suka-brown/5 px-1.5 py-0.5 rounded uppercase font-semibold">
                                {l.tipe.replace('_', ' ')}
                              </span>
                              <span className="font-mono">{timeStr}</span>
                            </div>
                          </div>
                        );
                      })
                    )
                  ) : (
                    <p className="text-[11px] text-suka-brown/50 italic text-center py-2">
                      Pilih outlet untuk melihat log aktivitas
                    </p>
                  )}
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* Alerts Tab - Global alerting view */}
        {activeTab === 'alerts' && (
          <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#faf2e9]/30">
            <div className="bg-white rounded-xl border border-suka-brown/10 shadow-sm p-4 md:p-6 max-w-7xl mx-auto space-y-4">
              <h2 className="text-base md:text-lg font-bold text-suka-brown border-b border-suka-brown/10 pb-3 uppercase tracking-tight">
                PERINGATAN BAHAN BAKU GLOBAL (KRITIS/MENIPIS)
              </h2>
              <SPVTable
                items={items}
                tab="alerts"
                onRowClick={setSelectedItem}
                onThresholdChange={handleThresholdChange}
                onRestockRequest={handleRestockRequest}
                onTransferRequest={setTransferItem}
                loading={isLoading && !data}
              />
            </div>
          </main>
        )}

        {/* Approval Tab */}
        {activeTab === 'approval' && (
          <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#faf2e9]/30">
            <div className="bg-white rounded-xl border border-suka-brown/10 shadow-sm p-4 md:p-6 max-w-4xl mx-auto space-y-4">
              <h2 className="text-base md:text-lg font-bold text-suka-brown border-b border-suka-brown/10 pb-3 uppercase tracking-tight">
                Approval Permintaan Bahan
              </h2>
              <ApprovalList />
            </div>
          </main>
        )}
      </div>

      {/* Floating Action Button (FAB) exactly as in mockup */}
      <button
        onClick={() => showToast('➕ Simulasi: Menambahkan stok bahan baku baru')}
        className="fixed bottom-6 right-6 w-16 h-16 bg-[#701604] text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-50 text-3xl font-bold"
      >
        +
      </button>

      {/* Detail Modal */}
      {selectedItem && (
        <MonitoringDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          isOpen={!!selectedItem}
        />
      )}

      {/* Transfer Stock Modal */}
      <TransferModal
        item={transferItem}
        allInventory={items}
        isOpen={!!transferItem}
        onClose={() => setTransferItem(null)}
        onConfirm={handleTransferConfirm}
      />
    </div>
  );
}
