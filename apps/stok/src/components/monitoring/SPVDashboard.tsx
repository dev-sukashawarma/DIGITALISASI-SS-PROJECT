'use client';

import React, { useState, useMemo } from 'react';
import { SPVTabs } from './SPVTabs';
import { SPVTable } from './SPVTable';
import { MonitoringDetailModal } from './MonitoringDetailModal';
import { TransferModal } from './TransferModal';
import {
  useSPVMonitoringData,
  useLeaderMonitoringData,
  useStockoutForecast,
  useWasteToday,
  useMonitoringRealtime
} from '@/hooks/useMonitoringData';
import type { MonitoringItem } from '@/lib/types/monitoring';
import { formatCompositeSaldoAdaptive } from '@/lib/format/compositeUnit';
import { useAuth, createSupabaseBrowserClient } from '@suka/auth';
import { useApprovalList } from '@/hooks/usePermintaan';
import { ApprovalList } from '../permintaan/ApprovalList';
import WasteApprovalPage from '@/app/stok/waste-approval/page';
import { POInboundTabContent } from './POInboundTabContent';
import { HargaBahanBoard } from '@/components/harga-bahan/HargaBahanBoard';
import { Skeleton } from '@suka/design-system/src/components/SkeletonBase';
import { RefreshCw, Search, X, Bell, AlertTriangle, CheckCircle2, TrendingDown, Trash2, Store } from 'lucide-react';
import { fetchPendingWasteReports } from '@/app/actions/waste';
import { useQuery } from '@tanstack/react-query';
import { updateThresholdAction } from '@/app/actions/threshold';
import { useOutletScope } from '@/hooks/useOutletScope';

const getOutletRegion = (outletName: string): 'Central Kitchen' | 'Bogor' | 'Jakarta' | 'Depok' | 'Bekasi' | 'Tangerang' | 'Developer' => {
  const name = outletName.toUpperCase();
  
  if (
    name.includes('GLOBAL OUTLET') || 
    name.includes('GLOBAL SYSTEM') || 
    name.includes('OUTLET TES') || 
    name.includes('OUTLET TEST') || 
    name.includes('SHOOPE') || 
    name.includes('SHOPEE') || 
    name.includes('TITKOSHOP') || 
    name.includes('TIKTOK') || 
    name.includes('TIKTOKSHOP') || 
    name.includes('TIKTOK SHOP')
  ) {
    return 'Developer';
  }

  if (name.includes('BNR')) return 'Bogor';
  if (name.includes('GUDANG PUSAT') || name.includes('KANTOR PUSAT')) return 'Central Kitchen';
  if (name.includes('KITCHEN (PUSAT)')) return 'Bogor';
  if (name.includes('KITCHEN')) return 'Central Kitchen';
  
  if (name.includes('PEKAYON') || name.includes('JATIASIH') || name.includes('JATIWARINGIN') || name.includes('JATIWANGIN')) return 'Bekasi';
  if (name.includes('CIRENDEU')) return 'Tangerang';
  if (
    name.includes('CIBINONG') || 
    name.includes('CISEENG') || 
    name.includes('CITAYAM') || 
    name.includes('DRAMAGA') || 
    name.includes('EMPANG') || 
    name.includes('CIMANGGU') || 
    name.includes('CIBUBUR') || 
    name.includes('PAJAJARAN') || 
    name.includes('PAJA JARAN') || 
    name.includes('PALEDANG') || 
    name.includes('CICURUG') || 
    name.includes('SENTUL') || 
    name.includes('CILEUNGSI')
  ) {
    return 'Bogor';
  }
  if (name.includes('DEPOK') || name.includes('SUKMAJAYA') || name.includes('BEJI') || name.includes('SAWANGAN') || name.includes('WANGAN')) return 'Depok';
  if (name.includes('TEBET') || name.includes('KALISARI') || name.includes('JAGAKARSA')) return 'Jakarta';
  
  return 'Jakarta';
};

export function SPVDashboard({ allowedOutletIds }: { allowedOutletIds?: string[] } = {}) {
  useMonitoringRealtime();
  const { boundOutlets } = useOutletScope();
  const [activeTab, setActiveTab] = useState<'overview' | 'alerts' | 'approval' | 'waste_approval' | 'po_inbound' | 'harga_bahan'>('overview');
  const [selectedItem, setSelectedItem] = useState<MonitoringItem | null>(null);

  const { data: inboundPos = [] } = useQuery({
    queryKey: ['spv_inbound_pos'],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc('get_purchase_orders', {
        p_from: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
        p_to: new Date().toISOString().split('T')[0],
        p_status: null
      });
      if (error) return [];
      return (data ?? []).filter((p: any) => p.status === 'dikirim_ke_supplier' || p.status === 'sebagian_diterima');
    },
    refetchInterval: 30000
  });
  
  // State for split view outlet selection
  const [selectedOutletId, setSelectedOutletId] = useState<string | null>(null);
  
  // State for Transfer modal
  const [transferItem, setTransferItem] = useState<MonitoringItem | null>(null);
  
  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Notification dropdown open state
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  // Search and filter states for table
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'below' | 'warning' | 'ok'>('all');

  // Auth context for username
  const { outletStaff } = useAuth();
  const isOwner = outletStaff?.role === 'owner';

  const isLeaderScoped = !!allowedOutletIds;
  const spvQuery = useSPVMonitoringData(!isLeaderScoped);
  const leaderQuery = useLeaderMonitoringData(isLeaderScoped);
  const { data, isLoading } = isLeaderScoped ? leaderQuery : spvQuery;

  // Real-time and proactive hooks
  const stockoutForecastQuery = useStockoutForecast(1, 6);
  const wasteTodayQuery = useWasteToday();

  // Pending request approvals hook
  const { permintaan: pendingApprovals } = useApprovalList();

  const { data: pendingWaste } = useQuery({
    queryKey: ['waste_pending_all'],
    queryFn: () => fetchPendingWasteReports(),
    refetchInterval: 30000
  });

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

  const warningCount = useMemo(() => {
    return currentOutletItems.filter(item => item.status === 'warning').length;
  }, [currentOutletItems]);

  const okCount = useMemo(() => {
    return currentOutletItems.filter(item => item.status === 'ok').length;
  }, [currentOutletItems]);

  const healthScore = useMemo(() => {
    const total = currentOutletItems.length;
    if (total === 0) return 100;
    return Math.round((okCount / total) * 100);
  }, [currentOutletItems, okCount]);

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

    for (const outlet of boundOutlets) {
      if (outlet.name.toUpperCase().includes('KANTOR PUSAT')) continue;
      if (allowedOutletIds && !allowedOutletIds.includes(outlet.id)) continue;
      
      outletMap[outlet.id] = {
        outlet_id: outlet.id,
        outlet_name: outlet.name,
        region: getOutletRegion(outlet.name),
        items: [],
        kritisCount: 0,
        menipisCount: 0,
        status: 'ok',
      };
    }

    for (const item of items) {
      if (item.outlet_name.toUpperCase().includes('KANTOR PUSAT')) continue;
      if (allowedOutletIds && !allowedOutletIds.includes(item.outlet_id)) continue;

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
  }, [items, boundOutlets, allowedOutletIds]);

  const visibleOutlets = React.useMemo(() => {
    return outlets.byOutlet;
  }, [outlets.byOutlet]);

  // Automatically set first outlet as active on initial load
  React.useEffect(() => {
    if (visibleOutlets.length > 0 && !selectedOutletId) {
      let defaultOutletId = visibleOutlets[0].outlet_id;
      
      const isKitchenRole = outletStaff?.role === 'kitchen' || outletStaff?.role === 'admin' || outletStaff?.role === 'admin_hr' || outletStaff?.role === 'admin_finance';
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

  const handleThresholdChange = async (outletId: string, bahanBakuId: string, value: number) => {
    const overrideKey = `${outletId}-${bahanBakuId}`;
    setLocalThresholdOverrides(prev => ({
      ...prev,
      [overrideKey]: value
    }));
    
    try {
      await updateThresholdAction(outletId, bahanBakuId, value);
      showToast(`✅ Batas minimum diperbarui menjadi ${value}`);
      if (isLeaderScoped) {
        leaderQuery.refetch();
      } else {
        spvQuery.refetch();
      }
    } catch (error) {
      console.error('Failed to update threshold:', error);
      showToast('❌ Gagal menyimpan threshold. Silakan coba lagi.');
      setLocalThresholdOverrides(prev => {
        const next = { ...prev };
        delete next[overrideKey];
        return next;
      });
    }
  };

  const renderNotificationBell = () => {
    return (
      <div className="relative">
        <button
          onClick={() => setIsNotificationOpen(!isNotificationOpen)}
          className="text-suka-brown/70 hover:text-suka-orange p-2 rounded-2xl transition-colors relative flex items-center justify-center hover:bg-suka-cream/50 cursor-pointer"
          title="Notifikasi"
        >
          <Bell className="w-5 h-5" />
          {totalNotificationCount > 0 && (
            <span className="absolute 0 top-0.5 right-0.5 bg-red-600 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold border-2 border-white">
              {totalNotificationCount}
            </span>
          )}
        </button>
        
        {isNotificationOpen && (
          <div className="absolute right-0 mt-3 w-80 bg-white border border-suka-brown/15 rounded-2xl shadow-xl z-50 p-4 space-y-3 text-sm animate-in fade-in slide-in-from-top-2 duration-150">
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
                  {criticalAlertItems.map((alert) => (
                    <div key={`${alert.outlet_id}-${alert.bahan_baku_id}`} className="p-2.5 bg-red-50/70 border border-red-200 rounded-xl flex items-start gap-2">
                      <span className="text-xs">🚨</span>
                      <div className="flex-1">
                        <p className="text-xs font-black text-red-950 uppercase tracking-wide">{alert.item_name}</p>
                        <p className="text-[10px] text-red-800 font-medium">
                          Stok kritis di {alert.outlet_name.replace('SUKA SHAWARMA ', '')} ({formatCompositeSaldoAdaptive(alert.current_qty, alert.saldo_is_gram, alert.satuan, alert.satuan_kecil, alert.faktor_tampilan)})
                        </p>
                      </div>
                    </div>
                  ))}
                  
                  {pendingApprovals.map((req) => (
                    <div key={req.id} className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
                      <span className="text-xs">⏳</span>
                      <div className="flex-1">
                        <p className="text-xs font-black text-amber-900 uppercase tracking-wide">Persetujuan Bahan</p>
                        <p className="text-[10px] text-amber-800 font-medium">
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
    <div className="flex flex-col text-suka-brown w-full">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 bg-suka-orange text-white px-4 py-3 rounded-2xl shadow-xl border border-white/20 z-50 font-bold text-xs animate-in slide-in-from-top-2">
          {toastMessage}
        </div>
      )}

      {/* Header Bar */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-suka-brown/10 px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-2xs">
        <div>
          <h1 className="font-black text-base sm:text-lg text-suka-brown leading-tight font-display tracking-tight">
            Monitoring Stok Bahan Baku
          </h1>
          <p className="text-[10px] text-suka-brown/60 font-extrabold tracking-widest uppercase mt-0.5">
            Real-Time Balance & Opname Control
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => { isLeaderScoped ? leaderQuery.refetch() : spvQuery.refetch(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-suka-cream/50 hover:bg-suka-cream text-suka-brown border border-suka-brown/10 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
            title="Refresh Data"
          >
            <RefreshCw className="w-3.5 h-3.5 text-suka-orange" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          {renderNotificationBell()}
        </div>
      </header>

      {/* Tabs Bar */}
      <div className="flex-shrink-0">
        <SPVTabs 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
          alertCount={alertCount} 
          approvalCount={pendingApprovals.length} 
          wasteApprovalCount={pendingWaste?.length || 0}
          poInboundCount={inboundPos.length}
          readOnlyTabs={isOwner}
          showPOInbound={['kitchen', 'purchasing', 'admin', 'owner', 'admin_finance', 'developer'].includes(outletStaff?.role ?? '')}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {activeTab === 'waste_approval' && (
          <div className="flex-1 overflow-y-auto">
            <WasteApprovalPage />
          </div>
        )}

        {/* Overview Tab - 100% Full-Width Clean Workspace */}
        {activeTab === 'overview' && (
          <div className="flex-1 flex flex-col overflow-y-auto">
            {isLoading && !data ? (
              <div className="flex-1 p-6 space-y-6">
                <Skeleton className="h-8 w-64 rounded-xl" />
                <Skeleton className="h-16 w-full rounded-2xl" />
                <Skeleton className="h-96 w-full rounded-2xl" />
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                {/* Top Workspace Toolbar: Outlet Dropdown Filter + Search + Status Filter Pills */}
                <div className="p-4 md:p-6 bg-white border-b border-suka-brown/10 flex flex-col gap-4 shadow-2xs">
                  {/* Row 1: Outlet Dropdown Filter & Search Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Compact Outlet Dropdown */}
                    <div className="flex items-center gap-2 flex-1 max-w-md">
                      <div className="relative w-full flex items-center bg-suka-cream/40 border border-suka-brown/15 rounded-2xl px-3 py-2 hover:border-suka-orange transition-colors">
                        <Store className="w-4 h-4 text-suka-orange shrink-0 mr-2" />
                        <select
                          value={selectedOutletId || ''}
                          onChange={(e) => setSelectedOutletId(e.target.value)}
                          className="w-full bg-transparent text-xs font-black text-suka-brown outline-none cursor-pointer pr-2 font-sans"
                        >
                          {['Central Kitchen', 'Bogor', 'Jakarta', 'Depok', 'Bekasi', 'Tangerang', 'Developer'].map((region) => {
                            const regionOutlets = outlets.byRegion[region] || [];
                            if (regionOutlets.length === 0) return null;
                            return (
                              <optgroup key={region} label={`📍 ${region.toUpperCase()}`}>
                                {regionOutlets.map((o) => {
                                  const cleanName = o.outlet_name.replace('SUKA SHAWARMA ', '').toUpperCase();
                                  const alertBadge = o.status === 'below' ? ` (🚨 ${o.kritisCount} Kritis)` : o.status === 'warning' ? ` (⚠️ ${o.menipisCount})` : '';
                                  return (
                                    <option key={o.outlet_id} value={o.outlet_id}>
                                      {cleanName}{alertBadge}
                                    </option>
                                  );
                                })}
                              </optgroup>
                            );
                          })}
                        </select>
                      </div>
                    </div>

                    {/* Search Bar */}
                    <div className="relative w-full sm:w-72">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-suka-brown/40" />
                      <input
                        type="text"
                        placeholder="Cari nama bahan baku..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-8 py-2 bg-suka-cream/40 border border-suka-brown/10 rounded-2xl text-xs font-bold text-suka-brown focus:outline-none focus:border-suka-orange placeholder:text-suka-brown/40"
                      />
                      {searchTerm && (
                        <button
                          onClick={() => setSearchTerm('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-suka-brown/40 hover:text-suka-brown cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Status Filter Pills + Secondary Proactive Stats */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-suka-brown/5">
                    {/* Status Filter Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                      {[
                        { id: 'all', label: 'Semua Bahan', count: currentOutletItems.length },
                        { id: 'below', label: '🚨 Kritis', count: criticalCount },
                        { id: 'warning', label: '⚠️ Menipis', count: warningCount },
                        { id: 'ok', label: '✅ Aman', count: okCount },
                      ].map((btn) => {
                        const isActive = filterStatus === btn.id;
                        return (
                          <button
                            key={btn.id}
                            onClick={() => setFilterStatus(btn.id as any)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                              isActive
                                ? 'bg-suka-brown text-white shadow-2xs'
                                : 'bg-suka-cream/40 text-suka-brown/70 hover:bg-suka-cream hover:text-suka-brown'
                            }`}
                          >
                            <span>{btn.label}</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                              isActive ? 'bg-white/20 text-white' : 'bg-black/5 text-suka-brown/70'
                            }`}>
                              {btn.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Secondary Proactive Stats */}
                    <div className="flex items-center gap-4 text-xs font-bold text-suka-brown/70">
                      {outletForecastCount > 0 && (
                        <span className="flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                          <TrendingDown className="w-3.5 h-3.5" /> {outletForecastCount} habis dalam 24j
                        </span>
                      )}
                      {outletWasteCount > 0 && (
                        <span className="flex items-center gap-1 text-suka-brown/70 bg-suka-cream/60 px-2 py-1 rounded-lg border border-suka-brown/10">
                          <Trash2 className="w-3.5 h-3.5" /> {outletWasteCount} waste hari ini
                        </span>
                      )}
                      <span className="text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Health: {healthScore}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Full-Width Table View */}
                <div className="flex-1 p-4 md:p-6 overflow-y-auto">
                  <SPVTable
                    items={items}
                    tab="overview"
                    selectedOutletId={selectedOutletId || undefined}
                    searchTerm={searchTerm}
                    filterStatus={filterStatus}
                    hideFilters={true}
                    onRowClick={setSelectedItem}
                    onThresholdChange={isOwner ? undefined : handleThresholdChange}
                    onRestockRequest={isOwner ? undefined : handleRestockRequest}
                    onTransferRequest={isOwner ? undefined : setTransferItem}
                    loading={isLoading && !data}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Alerts Tab */}
        {activeTab === 'alerts' && (
          <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#faf2e9]/30">
            <div className="bg-white rounded-3xl border border-suka-brown/10 shadow-xs p-5 md:p-6 max-w-7xl mx-auto space-y-4">
              <div className="flex items-center justify-between border-b border-suka-brown/10 pb-3">
                <h2 className="text-base md:text-lg font-black text-suka-brown uppercase tracking-tight flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <span>Peringatan Stok Kritis & Menipis Seluruh Outlet</span>
                </h2>
                <span className="text-xs font-black text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
                  {alertCount} Item Butuh Perhatian
                </span>
              </div>
              <SPVTable
                items={items}
                tab="alerts"
                onRowClick={setSelectedItem}
                onThresholdChange={isOwner ? undefined : handleThresholdChange}
                onRestockRequest={isOwner ? undefined : handleRestockRequest}
                onTransferRequest={isOwner ? undefined : setTransferItem}
                loading={isLoading && !data}
              />
            </div>
          </main>
        )}

        {/* Approval Tab */}
        {activeTab === 'approval' && (
          <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#faf2e9]/30">
            <div className="bg-white rounded-3xl border border-suka-brown/10 shadow-xs p-5 md:p-6 max-w-4xl mx-auto space-y-4">
              <h2 className="text-base md:text-lg font-black text-suka-brown border-b border-suka-brown/10 pb-3 uppercase tracking-tight">
                Persetujuan Permintaan Bahan Baku Outlet
              </h2>
              <ApprovalList />
            </div>
          </main>
        )}

        {/* PO Inbound Tab */}
        {activeTab === 'po_inbound' && (
          <main className="flex-1 overflow-y-auto bg-[#faf2e9]/30">
            <POInboundTabContent />
          </main>
        )}

        {/* Board Harga Vendor Tab */}
        {activeTab === 'harga_bahan' && (
          <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#faf2e9]/30">
            <div className="max-w-7xl mx-auto">
              <HargaBahanBoard showBackButton={false} />
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
      {!isOwner && (
        <TransferModal
          item={transferItem}
          allInventory={items}
          isOpen={!!transferItem}
          onClose={() => setTransferItem(null)}
          onConfirm={handleTransferConfirm}
        />
      )}
    </div>
  );
}
