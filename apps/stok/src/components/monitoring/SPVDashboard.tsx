'use client';

import React, { useState, useMemo } from 'react';
import { SPVTabs } from './SPVTabs';
import { SPVTable } from './SPVTable';
import { MonitoringDetailModal } from './MonitoringDetailModal';
import { TransferModal } from './TransferModal';
import {
  useSPVMonitoringData,
  useLeaderMonitoringData,
  useRecentLedger,
  useStockoutForecast,
  useWasteToday
} from '@/hooks/useMonitoringData';
import type { MonitoringItem } from '@/lib/types/monitoring';
import { formatCompositeSaldo, formatCompositeDelta } from '@/lib/format/compositeUnit';
import { useAuth, createSupabaseBrowserClient } from '@suka/auth';
import { useApprovalList } from '@/hooks/usePermintaan';
import { ApprovalList } from '../permintaan/ApprovalList';
import WasteApprovalPage from '@/app/stok/waste-approval/page';
import { Skeleton, Avatar } from '@suka/design-system';
import { LogOut, RefreshCw } from 'lucide-react';
import { fetchPendingWasteReports } from '@/app/actions/waste';
import { useQuery } from '@tanstack/react-query';
import { BottomNav } from '@/components/common/BottomNav';
import { ProductionEstimateWidget } from './ProductionEstimateWidget';

const getOutletRegion = (outletName: string): 'Central Kitchen' | 'Jakarta' | 'Bogor' | 'Depok' | 'Bekasi' | 'Tangerang' => {
  const name = outletName.toUpperCase();
  
  if (name.includes('GUDANG PUSAT') || name.includes('KANTOR PUSAT')) return 'Central Kitchen';
  if (name.includes('KITCHEN (PUSAT)')) return 'Bogor';
  if (name.includes('KITCHEN')) return 'Central Kitchen';
  
  if (name.includes('PEKAYON') || name.includes('JATIASIH') || name.includes('JATIWARINGIN') || name.includes('JATIWANGIN')) return 'Bekasi';
  if (name.includes('CIRENDEU')) return 'Tangerang';
  if (name.includes('CIBINONG') || name.includes('CISEENG') || name.includes('CITAYAM') || name.includes('DRAMAGA') || name.includes('EMPANG') || name.includes('CIMANGGU') || name.includes('CIBUBUR') || name.includes('PAJAJARAN') || name.includes('PAJA JARAN') || name.includes('PALEDANG')) return 'Bogor';
  if (name.includes('DEPOK') || name.includes('SUKMAJAYA') || name.includes('BEJI') || name.includes('SAWANGAN') || name.includes('WANGAN')) return 'Depok';
  if (name.includes('TEBET') || name.includes('KALISARI') || name.includes('JAGAKARSA')) return 'Jakarta';
  
  return 'Jakarta'; // Default
};

export function SPVDashboard({ allowedOutletIds }: { allowedOutletIds?: string[] } = {}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'alerts' | 'approval' | 'waste_approval'>('overview');
  const [selectedItem, setSelectedItem] = useState<MonitoringItem | null>(null);
  
  // State for split view outlet selection
  const [selectedOutletId, setSelectedOutletId] = useState<string | null>(null);
  
  // State for Transfer modal
  const [transferItem, setTransferItem] = useState<MonitoringItem | null>(null);
  
  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Collapsible sidebar state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Notification dropdown open state
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  // Search and filter states for the right-hand detail pane
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'below' | 'warning' | 'ok'>('all');

  // Auth context for username
  const { outletStaff } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const isLeaderScoped = !!allowedOutletIds;
  const spvQuery = useSPVMonitoringData(!isLeaderScoped);
  const leaderQuery = useLeaderMonitoringData(isLeaderScoped);
  const { data, isLoading, isError } = isLeaderScoped ? leaderQuery : spvQuery;

  // Real-time and proactive hooks
  const recentLedgerQuery = useRecentLedger(15);
  const stockoutForecastQuery = useStockoutForecast(1, 6);
  const wasteTodayQuery = useWasteToday();

  // Pending request approvals hook
  const { permintaan: pendingApprovals } = useApprovalList();

  const { data: pendingWaste } = useQuery({
    queryKey: ['waste_pending_all'],
    queryFn: () => fetchPendingWasteReports(),
    refetchInterval: 30000
  })

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
      (item) => {
        if (item.outlet_name.toUpperCase().includes('KANTOR PUSAT')) return false;
        return !allowedOutletIds || allowedOutletIds.includes(item.outlet_id);
      }
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

  const totalNotificationCount = criticalAlertItems.length + pendingApprovals.length + (pendingWaste?.length || 0);

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

  const visibleOutlets = React.useMemo(() => {
    return outlets.byOutlet;
  }, [outlets.byOutlet, outletStaff?.role]);

  // Automatically set first outlet as active on initial load
  React.useEffect(() => {
    if (visibleOutlets.length > 0 && !selectedOutletId) {
      let defaultOutletId = visibleOutlets[0].outlet_id;
      
      const isKitchenRole = outletStaff?.role === 'kitchen' || outletStaff?.role === 'admin' || outletStaff?.role === 'admin_hr';
      if (isKitchenRole) {
        const gudang = visibleOutlets.find(o => o.outlet_name.toUpperCase().includes('GUDANG'));
        if (gudang) {
          defaultOutletId = gudang.outlet_id;
        }
      }
      
      setSelectedOutletId(defaultOutletId);
    }
  }, [visibleOutlets, selectedOutletId, outletStaff?.role]);

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
    const sourceOutletName = visibleOutlets.find(o => o.outlet_id === sourceOutletId)?.outlet_name || 'Outlet Asal';
    showToast(`✅ Transfer Stok Berhasil: ${qty} unit ${transferItem.item_name} dipindahkan dari ${sourceOutletName} ke ${transferItem.outlet_name}`);
    setTransferItem(null);
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
                          Stok kritis di {alert.outlet_name.replace('SUKA SHAWARMA ', '')} ({formatCompositeSaldo(alert.current_qty, alert.satuan, alert.satuan_kecil, alert.faktor_tampilan)})
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
    <div className="flex flex-col md:h-screen md:overflow-hidden bg-suka-cream text-suka-ink min-h-screen pb-24 md:pb-24">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 bg-suka-orange text-white px-4 py-3 rounded-lg shadow-lg border border-white/20 z-50 animate-bounce font-bold text-sm">
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-45 bg-white/80 backdrop-blur-md border-b border-suka-brown/10 px-4 sm:px-6 py-3 md:py-4 flex flex-col md:flex-row md:justify-between md:items-center shadow-sm relative gap-3 md:gap-0 flex-shrink-0">
        {/* Row 1: Logo & Title (left) & Avatar (right on mobile) */}
        <div className="flex justify-between items-center w-full md:w-auto">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-white rounded-xl sm:rounded-2xl p-1 shadow-sm border border-suka-orange/10 flex items-center justify-center shrink-0">
              <img
                alt="Suka Shawarma Logo"
                className="w-full h-full object-contain"
                src="/logo.png"
              />
            </div>
            <div className="flex flex-col">
              <h1 className="font-black text-sm sm:text-base text-suka-brown leading-tight font-display tracking-wide">
                SPV Monitoring Dashboard
              </h1>
              <p className="text-[10px] text-suka-gray-500 font-extrabold tracking-widest uppercase mt-0.5">
                Kitchen Logistics
              </p>
            </div>
          </div>
          {/* Mobile-only tools */}
          <div className="md:hidden flex items-center gap-3 relative">
            {isError && <span className="text-xs" title="Koneksi tidak stabil">⚠️</span>}
            {renderNotificationBell()}
            <button 
              onClick={() => setShowDropdown(!showDropdown)}
              className="w-8 h-8 rounded-full ring-2 ring-suka-orange/20 overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center cursor-pointer transition-transform active:scale-95"
            >
              <Avatar name={outletStaff?.name || ''} size={32} />
            </button>
            {showDropdown && (
              <div className="absolute right-0 top-full mt-2 w-40 bg-white rounded-xl shadow-lg border border-suka-brown/10 py-1.5 z-50 flex flex-col">
                <a href={resolvedPortalUrl} className="px-4 py-2.5 text-xs font-bold text-[#544437] hover:bg-[#faf2e9] transition-colors">
                  ← Portal Utama
                </a>
                <button onClick={() => { isLeaderScoped ? leaderQuery.refetch() : spvQuery.refetch() }} className="px-4 py-2.5 text-xs font-bold text-suka-brown hover:bg-suka-cream text-left flex items-center gap-2 transition-colors">
                  <RefreshCw size={12} /> Refresh Data
                </button>
                <button onClick={handleLogout} className="px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 text-left flex items-center gap-2 transition-colors border-t border-suka-brown/5">
                  <LogOut size={12} /> Keluar
                </button>
              </div>
            )}
          </div>
        </div>

        {/* User Session Bar - Stacks below on mobile, inline on desktop */}
        <div className="flex items-center justify-between w-full md:w-auto gap-3 border-t md:border-t-0 border-suka-brown/5 pt-2.5 md:pt-0">
          <div className="flex flex-col text-left md:text-right">
            <span className="text-xs font-extrabold text-[#1e1b15]">{outletStaff?.name || 'Supervisor'}</span>
            <span className="text-[10px] text-suka-orange font-bold uppercase tracking-wider mt-0.5">
              {outletStaff?.role ? outletStaff.role.replace('_', ' ').toUpperCase() : 'SPV KITCHEN'}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-4 relative">
            {isError && (
              <div className="bg-yellow-50 text-yellow-700 px-3 py-1.5 rounded-lg text-xs border border-yellow-200">
                Data lokal cache
              </div>
            )}
            
            {renderNotificationBell()}
            
            <button 
              onClick={() => setShowDropdown(!showDropdown)}
              className="w-9 h-9 rounded-full ring-2 ring-suka-orange/20 overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center cursor-pointer transition-transform active:scale-95"
            >
              <Avatar name={outletStaff?.name || ''} size={36} />
            </button>
            {showDropdown && (
              <div className="absolute right-0 top-full mt-2 w-40 bg-white rounded-xl shadow-lg border border-suka-brown/10 py-1.5 z-50 flex flex-col">
                <a href={resolvedPortalUrl} className="px-4 py-2.5 text-xs font-bold text-[#544437] hover:bg-[#faf2e9] transition-colors">
                  ← Portal Utama
                </a>
                <button onClick={() => { isLeaderScoped ? leaderQuery.refetch() : spvQuery.refetch() }} className="px-4 py-2.5 text-xs font-bold text-suka-brown hover:bg-suka-cream text-left flex items-center gap-2 transition-colors">
                  <RefreshCw size={12} /> Refresh Data
                </button>
                <button onClick={handleLogout} className="px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 text-left flex items-center gap-2 transition-colors border-t border-suka-brown/5">
                  <LogOut size={12} /> Keluar
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex-shrink-0">
        <SPVTabs 
          activeTab={activeTab as any} 
          onTabChange={setActiveTab} 
          alertCount={alertCount} 
          approvalCount={pendingApprovals.length} 
          wasteApprovalCount={pendingWaste?.length || 0}
        />
      </div>

      {/* Mobile Outlets Horizontal Strip */}
      {activeTab === 'overview' && (
        <div className="flex lg:hidden overflow-x-auto gap-2 px-4 py-2.5 bg-suka-cream/50 border-b border-suka-brown/20 scrollbar-none flex-shrink-0 w-full">
          {visibleOutlets.map((outlet) => {
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
        {activeTab === 'waste_approval' && (
          <div className="flex-1 overflow-y-auto">
            <WasteApprovalPage />
          </div>
        )}

        {/* Overview Tab - Split view */}
        {activeTab === 'overview' && (
          <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
            {/* Left Column: Outlets (Collapsible) - Desktop Only */}
            <aside className={`hidden lg:block ${isSidebarCollapsed ? 'lg:w-[60px] p-2' : 'lg:w-[250px] xl:w-[22%] p-6'} bg-suka-cream/50 border-r border-suka-brown/20 overflow-y-auto space-y-6 transition-all duration-300 flex-shrink-0`}>
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
                                  ? 'border-2 border-suka-orange bg-white shadow-sm'
                                  : 'border-suka-brown/20 bg-white hover:border-suka-orange/30 hover:scale-[1.02]'
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
            <section className="flex-shrink-0 lg:flex-1 bg-white flex flex-col border-b lg:border-b-0 lg:border-r border-suka-brown/20 overflow-visible lg:overflow-hidden">
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
                      <h3 className="text-base md:text-lg font-black text-suka-brown uppercase tracking-tight">
                        DETAIL STOK: {visibleOutlets.find(o => o.outlet_id === selectedOutletId)?.outlet_name.replace('SUKA SHAWARMA ', '')}
                      </h3>
                      <div className="relative w-full sm:w-auto">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-suka-brown/50 text-sm">🔍</span>
                        <input
                          className="pl-9 pr-4 py-2 bg-suka-cream/50 border border-suka-brown/20 focus:border-suka-orange focus:ring-1 focus:ring-suka-orange rounded-xl text-sm w-full sm:w-64 transition-all font-bold placeholder-suka-brown/40"
                          placeholder="Cari nama bahan..."
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Filter buttons - Desktop (Pills) */}
                    <div className="hidden md:flex items-center gap-2 sm:gap-3 text-xs sm:text-sm font-bold flex-wrap">
                      <button
                        onClick={() => setFilterStatus('all')}
                        className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border transition-all ${
                          filterStatus === 'all'
                            ? 'bg-suka-brown text-white border-suka-brown shadow-sm'
                            : 'bg-white text-suka-brown/70 border-suka-brown/20 hover:border-suka-brown hover:text-suka-brown'
                        }`}
                      >
                        Semua
                      </button>
                      <button
                        onClick={() => setFilterStatus('below')}
                        className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border transition-all ${
                          filterStatus === 'below'
                            ? 'bg-red-650 text-white border-red-650 shadow-sm'
                            : 'bg-white text-red-650/70 border-red-200 hover:border-red-650 hover:text-red-650'
                        }`}
                      >
                        Kritis (Below)
                      </button>
                      <button
                        onClick={() => setFilterStatus('warning')}
                        className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border transition-all ${
                          filterStatus === 'warning'
                            ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                            : 'bg-white text-orange-500/70 border-orange-200 hover:border-orange-500 hover:text-orange-500'
                        }`}
                      >
                        Menipis (Warning)
                      </button>
                      <button
                        onClick={() => setFilterStatus('ok')}
                        className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border transition-all ${
                          filterStatus === 'ok'
                            ? 'bg-green-650 text-white border-green-650 shadow-sm'
                            : 'bg-white text-green-650/70 border-green-200 hover:border-green-650 hover:text-green-650'
                        }`}
                      >
                        Aman (OK)
                      </button>
                    </div>

                    {/* Filter buttons - Mobile (Radio) */}
                    <div className="flex md:hidden items-center gap-3 text-xs font-bold text-suka-brown flex-wrap mt-2">
                      <label className="flex items-center gap-1.5 cursor-pointer group">
                        <input
                          type="radio"
                          name="filter-mobile"
                          checked={filterStatus === 'all'}
                          onChange={() => setFilterStatus('all')}
                          className="w-4 h-4 text-suka-orange border-suka-brown/30 focus:ring-suka-orange accent-suka-orange"
                        />
                        <span className="group-hover:text-suka-orange transition-colors">Semua</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer group text-red-650">
                        <input
                          type="radio"
                          name="filter-mobile"
                          checked={filterStatus === 'below'}
                          onChange={() => setFilterStatus('below')}
                          className="w-4 h-4 border-red-300 focus:ring-red-500 accent-red-650"
                        />
                        <span className="group-hover:opacity-80 transition-opacity">Kritis (Below)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer group text-orange-650">
                        <input
                          type="radio"
                          name="filter-mobile"
                          checked={filterStatus === 'warning'}
                          onChange={() => setFilterStatus('warning')}
                          className="w-4 h-4 border-orange-300 focus:ring-orange-500 accent-orange-650"
                        />
                        <span className="group-hover:opacity-80 transition-opacity">Menipis (Warning)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer group text-green-700">
                        <input
                          type="radio"
                          name="filter-mobile"
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
                        className={`bg-white border-2 rounded-2xl p-4 text-left shadow-sm hover:scale-[1.02] transition-all flex flex-col justify-between group h-24 ${
                          filterStatus === 'below' ? 'border-red-600 bg-red-50' : 'border-suka-brown/20'
                        }`}
                      >
                        <span className="text-[10px] font-black uppercase text-red-600 tracking-wider flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                          Stok Kritis
                        </span>
                        <div className="flex items-baseline gap-1 mt-2">
                          <span className="text-2xl font-black text-red-600">{criticalCount}</span>
                          <span className="text-[10px] text-suka-brown/60 font-semibold">bahan</span>
                        </div>
                      </button>

                      {/* KPI 2: Forecasted Stockouts */}
                      <div className="bg-white border-2 border-suka-brown/20 rounded-2xl p-4 text-left shadow-sm flex flex-col justify-between h-24">
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
                      <div className="bg-white border-2 border-suka-brown/20 rounded-2xl p-4 text-left shadow-sm flex flex-col justify-between h-24">
                        <span className="text-[10px] font-black uppercase text-suka-brown tracking-wider flex items-center gap-1">
                          <span>🗑️</span>
                          Waste Hari Ini
                        </span>
                        <div className="flex items-baseline gap-1 mt-2">
                          <span className="text-2xl font-black text-suka-brown">{outletWasteCount}</span>
                          <span className="text-[10px] text-suka-brown/60 font-semibold">kejadian</span>
                        </div>
                      </div>

                      {/* KPI 4: Health Score */}
                      <button
                        onClick={() => setFilterStatus('ok')}
                        className={`bg-white border-2 rounded-2xl p-4 text-left shadow-sm hover:scale-[1.02] transition-all flex flex-col justify-between group h-24 ${
                          filterStatus === 'ok' ? 'border-suka-green bg-green-50/50' : 'border-suka-brown/20'
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
            <aside className="w-full lg:w-[320px] xl:w-[23%] bg-suka-cream/50 overflow-visible lg:overflow-y-auto p-4 flex flex-col gap-6 flex-shrink-0 border-t lg:border-t-0 border-suka-brown/20">
              {/* Widget: Estimasi Produksi (khusus kitchen) */}
              {outletStaff?.role === 'kitchen' && currentOutletItems.length > 0 && (
                <ProductionEstimateWidget items={currentOutletItems} />
              )}

              {/* Widget 0: Approval Permintaan */}
              <details className="group bg-white rounded-2xl border border-suka-brown/20 shadow-sm">
                <summary className="flex items-center justify-between cursor-pointer list-none [&::-webkit-details-marker]:hidden px-4 py-3.5 select-none">
                  <h3 className="font-black text-xs text-suka-brown tracking-wider uppercase flex items-center gap-1.5">
                    <span>📝</span> Approval Permintaan
                    {pendingApprovals.length > 0 && (
                      <span className="ml-1 bg-suka-orange text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                        {pendingApprovals.length}
                      </span>
                    )}
                  </h3>
                  <span className="text-suka-brown/50 transition-transform group-open:rotate-180">▼</span>
                </summary>
                <div className="max-h-[300px] overflow-y-auto px-4 pb-4">
                  <ApprovalList />
                </div>
              </details>

              {/* Widget 3: Live Activity Feed */}
              <details className="group bg-white rounded-2xl border border-[#d9c2b2]/60 shadow-[0px_2px_8px_rgba(112,22,4,0.02)]">
                <summary className="flex items-center justify-between cursor-pointer list-none [&::-webkit-details-marker]:hidden px-4 py-3.5 select-none">
                  <h3 className="font-black text-xs text-suka-brown tracking-wider uppercase flex items-center gap-1.5">
                    <span>⚡</span> Live Activity
                  </h3>
                  <span className="text-suka-brown/50 transition-transform group-open:rotate-180">▼</span>
                </summary>
                <div className="space-y-2.5 max-h-[300px] overflow-y-auto px-4 pb-4">
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
                                {formatCompositeDelta(l.qty, l.satuan ?? '', l.satuan_kecil, l.faktor_tampilan)}
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
              </details>
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
            <div className="bg-white rounded-xl border border-suka-brown/10 shadow-sm p-4 md:p-6 max-w-4xl mx-auto space-y-6">

              {/* Estimasi Produksi — hanya untuk kitchen */}
              {outletStaff?.role === 'kitchen' && currentOutletItems.length > 0 && (
                <div className="space-y-2">
                  <h2 className="text-base md:text-lg font-bold text-suka-brown border-b border-suka-brown/10 pb-3 uppercase tracking-tight flex items-center gap-2">
                    <span>🥙</span> Estimasi Produksi Hari Ini
                  </h2>
                  <p className="text-xs text-suka-brown/60 font-medium">
                    Berdasarkan saldo stok: {visibleOutlets.find(o => o.outlet_id === selectedOutletId)?.outlet_name || 'outlet aktif'}
                  </p>
                  <ProductionEstimateWidget items={currentOutletItems} />
                </div>
              )}

              <div className="space-y-4">
                <h2 className="text-base md:text-lg font-bold text-suka-brown border-b border-suka-brown/10 pb-3 uppercase tracking-tight">
                  Approval Permintaan Bahan
                </h2>
                <ApprovalList />
              </div>
            </div>
          </main>
        )}
      </div>

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
      
      <BottomNav />
    </div>
  );
}
