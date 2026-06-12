'use client';

import React, { useState, useMemo } from 'react';
import { SPVTabs } from './SPVTabs';
import { SPVTable } from './SPVTable';
import { MonitoringDetailModal } from './MonitoringDetailModal';
import { TransferModal } from './TransferModal';
import { TransferSuggestionPanel } from './TransferSuggestionPanel';
import type { TransferSuggestion } from '@/lib/stok/transferSuggestion';
import { useSPVMonitoringData } from '@/hooks/useMonitoringData';
import { useQuery } from '@tanstack/react-query';
import { fetchOpnameStatus } from '@/lib/queries/monitoring';
import type { MonitoringItem } from '@/lib/types/monitoring';
import Link from 'next/link';

const getOutletRegion = (outletName: string): 'Central Kitchen' | 'Jakarta' | 'Bogor' | 'Depok' | 'Bekasi' | 'Tangerang' => {
  const name = outletName.toUpperCase();
  if (name.includes('KITCHEN')) return 'Central Kitchen';
  if (name.includes('JATIASIH') || name.includes('JATIWANGIN')) return 'Bekasi';
  if (name.includes('CIRENDEU')) return 'Tangerang';
  if (name.includes('CIBINONG') || name.includes('CISEENG') || name.includes('CITAYAM') || name.includes('DRAMAGA') || name.includes('EMPANG') || name.includes('BEJI')) return 'Bogor';
  if (name.includes('DEPOK') || name.includes('SUKMAJAYA') || name.includes('PALEDANG') || name.includes('PAJA JARAN')) return 'Depok';
  if (name.includes('TEBET') || name.includes('KALISARI') || name.includes('PEKAYON') || name.includes('JAGAKARSA') || name.includes('CIMANGGUL')) return 'Jakarta';
  return 'Jakarta'; // Default
};

export function SPVDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'alerts' | 'compliance'>('overview');
  const [selectedItem, setSelectedItem] = useState<MonitoringItem | null>(null);
  
  // State for split view outlet selection
  const [selectedOutletId, setSelectedOutletId] = useState<string | null>(null);
  
  // State for Transfer modal
  const [transferItem, setTransferItem] = useState<MonitoringItem | null>(null);
  
  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Live clock state
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

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

  const { data, isLoading, isError, lastFetched, refetch, autoRefresh } = useSPVMonitoringData();

  // Fetch compliance/opname status
  const { data: opnameStatuses, isLoading: isOpnameLoading } = useQuery({
    queryKey: ['monitoring', 'opnameStatus'],
    queryFn: fetchOpnameStatus,
    enabled: activeTab === 'compliance',
  });

  // Local state override for edited thresholds to allow immediate UI response
  const [localThresholdOverrides, setLocalThresholdOverrides] = useState<Record<string, number>>({});

  // Compute final items with local threshold overrides
  const items = useMemo(() => {
    const originalItems = data?.items || [];
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
  }, [data?.items, localThresholdOverrides]);

  const alertCount = useMemo(() => {
    return items.filter((item) => item.status !== 'ok' || item.is_flagged).length;
  }, [items]);

  // Stats computations for the selected outlet
  const currentOutletItems = useMemo(() => {
    if (!selectedOutletId) return [];
    return items.filter(item => item.outlet_id === selectedOutletId);
  }, [items, selectedOutletId]);

  const criticalCount = useMemo(() => {
    return currentOutletItems.filter(item => item.status === 'below').length;
  }, [currentOutletItems]);

  const pendingRequestsCount = useMemo(() => {
    return currentOutletItems.filter(item => item.is_flagged).length;
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
    // Generate request document detail
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

  if (isLoading && !data) {
    return <div className="text-center py-8 text-suka-brown font-medium">Memuat data monitoring...</div>;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#fff8f1] text-[#1e1b15]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 bg-suka-orange text-white px-4 py-3 rounded-lg shadow-lg border border-white/20 z-50 animate-bounce font-bold text-sm">
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-suka-brown/10 px-6 py-4 flex justify-between items-center shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="w-8 h-8 flex items-center justify-center rounded-full bg-[#faf2e9] hover:bg-[#f5ede3] border border-[#d9c2b2]/50 text-[#701604] transition-colors" title="Kembali ke Dashboard">
            ←
          </Link>
          <img src="/logo.png" alt="Logo Suka Shawarma" className="h-10 w-auto object-contain" />
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-[#701604] tracking-tight">SPV Monitoring Dashboard</h2>
            <p className="text-xs text-suka-brown/60 mt-0.5">
              Last updated: {lastFetched ? new Date(lastFetched).toLocaleTimeString('id-ID') : 'Never'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
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

          <button
            onClick={() => refetch()}
            className="px-4 py-1.5 bg-[#701604] text-white rounded-lg font-bold text-xs flex items-center gap-1 hover:opacity-90 transition-opacity shadow-sm"
          >
            Refresh
          </button>
          <button
            onClick={autoRefresh.isPaused() ? autoRefresh.resume : autoRefresh.pause}
            className="px-4 py-1.5 border-2 border-[#701604] text-[#701604] rounded-lg font-bold text-xs flex items-center gap-1 hover:bg-[#701604]/5 transition-colors"
          >
            {autoRefresh.isPaused() ? 'Resume (30s)' : 'Pause'}
          </button>
          <div className="h-8 w-[1px] bg-suka-brown/10 mx-1"></div>
          <button className="text-suka-brown/60 hover:text-suka-orange p-1 rounded-full transition-colors">
            🔔
          </button>
          <img
            alt="Supervisor Profile"
            className="w-10 h-10 rounded-full border border-suka-brown/10"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCVWynnJOG4uWIASz9z1mXUR7yeGBBv3iaaZfvHs8koWxn4-njsaLL3iEMb-PHlCLYm-PKpAfLgobkvjpqfDk9SuA0e-EfkqStMwrjzO5cUUGcP323bAAsOqR-uyK7syfe7I9te7WV1yx3h8Eqh2r2iADNA4IgKlibFmSY1u3tSW2PRwimIr5YIEcP_gex3lSZTSM_R2SDl26I19fWlfY0d9nfx9QZPwVySk5_KAcpohzFCWx2zWGOfYz0D5YbINtX5ZxFJxJWc4yXz"
          />
        </div>
      </header>

      {/* Tabs */}
      <div className="flex-shrink-0">
        <SPVTabs activeTab={activeTab} onTabChange={setActiveTab} alertCount={alertCount} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Overview Tab - Split view */}
        {activeTab === 'overview' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Left panel: Outlets */}
            <aside className="w-[25%] bg-[#faf2e9] border-r border-[#d9c2b2] overflow-y-auto p-6 space-y-6">
              <h3 className="font-bold text-xs text-suka-brown/70 tracking-wider uppercase border-b border-suka-brown/10 pb-2">
                Daftar 19 Outlet
              </h3>
              <div className="flex flex-col gap-6">
                {['Central Kitchen', 'Bogor', 'Jakarta', 'Depok', 'Bekasi', 'Tangerang'].map((region) => (
                  outlets.byRegion[region] && outlets.byRegion[region].length > 0 && (
                    <div key={region} className="flex flex-col gap-2">
                      <h4 className="text-xs font-bold text-suka-orange/70 uppercase tracking-widest px-2">
                        {region}
                      </h4>
                      <div className="flex flex-col gap-2">
                        {outlets.byRegion[region].map((outlet) => {
                  const isActive = selectedOutletId === outlet.outlet_id;
                  const cleanName = outlet.outlet_name.replace('SUKA SHAWARMA ', '').toUpperCase();
                  
                  let statusCircleColor = 'bg-suka-green';
                  if (outlet.status === 'below') statusCircleColor = 'bg-red-600 animate-pulse';
                  else if (outlet.status === 'warning') statusCircleColor = 'bg-suka-orange';

                  // Location subdescription mapping
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
                          <span className="text-red-600">{outlet.kritisCount} Kritis</span>
                        )}
                        {outlet.status === 'warning' && (
                          <span className="text-orange-600">{outlet.menipisCount} Menipis</span>
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
                  )
                ))}
              </div>
            </aside>

            {/* Right panel: Details */}
            <section className="flex-1 bg-white overflow-hidden flex flex-col">
              {selectedOutletId ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Sticky right pane sub-header */}
                  <div className="p-6 border-b border-suka-brown/10 flex flex-col gap-4 bg-white z-10 flex-shrink-0">
                    <div className="flex justify-between items-center flex-wrap gap-4">
                      <h3 className="text-lg font-bold text-suka-brown uppercase tracking-tight">
                        DETAIL STOK: {outlets.byOutlet.find(o => o.outlet_id === selectedOutletId)?.outlet_name}
                      </h3>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-suka-brown/50 text-sm">🔍</span>
                        <input
                          className="pl-9 pr-4 py-2 bg-suka-cream/30 border border-suka-brown/15 focus:border-suka-orange focus:ring-1 focus:ring-suka-orange rounded-lg text-sm w-64 transition-all"
                          placeholder="Cari nama bahan..."
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Filter buttons exactly matching mockup */}
                    <div className="flex items-center gap-6 text-sm font-bold text-suka-brown">
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
                      <label className="flex items-center gap-1.5 cursor-pointer group text-red-600">
                        <input
                          type="radio"
                          name="filter"
                          checked={filterStatus === 'below'}
                          onChange={() => setFilterStatus('below')}
                          className="w-4 h-4 border-red-300 focus:ring-red-500 accent-red-650"
                        />
                        <span className="group-hover:opacity-80 transition-opacity">Kritis (Below)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer group text-orange-600">
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

                  {/* Scrollable table and stats */}
                  <div className="flex-1 p-6 overflow-y-auto space-y-6">
                    <SPVTable
                      items={items}
                      tab="overview"
                      selectedOutletId={selectedOutletId}
                      searchTerm={searchTerm}
                      filterStatus={filterStatus}
                      hideFilters={true} // Hide internal filters inside SPVTable
                      onRowClick={setSelectedItem}
                      onThresholdChange={handleThresholdChange}
                      onRestockRequest={handleRestockRequest}
                      onTransferRequest={setTransferItem}
                    />

                    {/* Quick Stats Cards below table */}
                    <div className="grid grid-cols-3 gap-6 pt-4">
                      <div className="bg-red-50 p-6 rounded-xl border border-red-200/60 flex flex-col justify-between shadow-sm">
                        <div className="flex items-center gap-2 text-red-800 mb-2 font-bold text-xs uppercase tracking-wider">
                          <span>⚠️</span>
                          <span>Critical Stock</span>
                        </div>
                        <div className="text-xl font-bold text-red-950">{criticalCount} Materials</div>
                      </div>

                      <div className="bg-orange-50 p-6 rounded-xl border border-orange-200/60 flex flex-col justify-between shadow-sm">
                        <div className="flex items-center gap-2 text-orange-850 mb-2 font-bold text-xs uppercase tracking-wider">
                          <span>⏳</span>
                          <span>Pending Requests</span>
                        </div>
                        <div className="text-xl font-bold text-orange-950">{pendingRequestsCount} Active</div>
                      </div>

                      <div className="bg-green-50 p-6 rounded-xl border border-green-200/60 flex flex-col justify-between shadow-sm">
                        <div className="flex items-center gap-2 text-green-800 mb-2 font-bold text-xs uppercase tracking-wider">
                          <span>✅</span>
                          <span>Health Score</span>
                        </div>
                        <div className="text-xl font-bold text-green-950">{healthScore}% Optimal</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-suka-brown/50 text-sm font-semibold bg-white">
                  Pilih outlet di sebelah kiri untuk melihat detail bahan baku
                </div>
              )}
            </section>
          </div>
        )}

        {/* Alerts Tab - Global alerting view */}
        {activeTab === 'alerts' && (
          <main className="flex-1 overflow-y-auto p-6 bg-[#faf2e9]/30">
            <div className="bg-white rounded-xl border border-suka-brown/10 shadow-sm p-6 max-w-7xl mx-auto space-y-4">
              <h2 className="text-lg font-bold text-suka-brown border-b border-suka-brown/10 pb-3 uppercase tracking-tight">
                PERINGATAN BAHAN BAKU GLOBAL (KRITIS/MENIPIS)
              </h2>
              <SPVTable
                items={items}
                tab="alerts"
                onRowClick={setSelectedItem}
                onThresholdChange={handleThresholdChange}
                onRestockRequest={handleRestockRequest}
                onTransferRequest={setTransferItem}
              />
            </div>
          </main>
        )}

        {/* Compliance Tab - Overdue lists & operational checklist */}
        {activeTab === 'compliance' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Left panel: Opname freshness status */}
            <aside className="w-[30%] bg-[#faf2e9] border-r border-[#d9c2b2] overflow-y-auto p-6 space-y-4">
              <h3 className="font-bold text-xs text-suka-brown/70 tracking-wider uppercase border-b border-suka-brown/10 pb-2">
                Kepatuhan Opname Fisik
              </h3>
              {isOpnameLoading ? (
                <p className="text-xs text-suka-brown/60">Memuat status opname...</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {opnameStatuses?.map((o) => {
                    const isActive = selectedOutletId === o.outlet_id;
                    const cleanName = o.outlet_name.replace('SUKA SHAWARMA ', '').toUpperCase();
                    return (
                      <button
                        key={o.outlet_id}
                        onClick={() => setSelectedOutletId(o.outlet_id)}
                        className={`text-left p-4 rounded-xl border transition-all flex justify-between items-center ${
                          isActive
                            ? 'border-2 border-suka-orange bg-white shadow-md'
                            : 'border-suka-brown/10 bg-white hover:border-suka-orange/30'
                        }`}
                      >
                        <div>
                          <p className={`font-bold text-sm uppercase tracking-wide ${isActive ? 'text-suka-orange' : 'text-suka-ink'}`}>
                            {cleanName}
                          </p>
                          <p className="text-xs text-suka-brown/60 mt-1">
                            Terakhir: {o.last_opname_date ? new Date(o.last_opname_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : 'Never'}
                          </p>
                        </div>
                        <span className={`text-[11px] px-2.5 py-1 rounded-md font-bold uppercase tracking-wide ${
                          o.is_overdue
                            ? 'bg-red-100 text-red-800 border border-red-200'
                            : 'bg-green-100 text-green-800 border border-green-200'
                        }`}>
                          {o.is_overdue ? `Terlambat (${o.days_since} hari)` : 'OK'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </aside>

            {/* Right panel: Operational compliance checklists */}
            <section className="flex-1 bg-white overflow-y-auto p-6 space-y-6">
              {selectedOutletId ? (
                <div className="space-y-4">
                  <h2 className="text-lg font-bold text-suka-brown border-b border-suka-brown/10 pb-3 uppercase tracking-tight">
                    CHECKLIST OPERASIONAL OUTLET: {outlets.byOutlet.find(o => o.outlet_id === selectedOutletId)?.outlet_name}
                  </h2>
                  
                  {/* Mock Compliance Checklist items */}
                  <div className="space-y-3">
                    {[
                      { title: 'Kebersihan Area Dapur & Wastafel', status: 'Lengkap', desc: 'Dapur telah dibersihkan, wastafel steril' },
                      { title: 'Suhu Chiller / Freezer (0°C - 4°C)', status: 'Lengkap', desc: 'Suhu chiller stabil pada 2.8°C' },
                      { title: 'Kesesuaian Atribut SPV & Crew', status: 'Lengkap', desc: 'Apron, sarung tangan, dan hairnet dipakai lengkap' },
                      { title: 'Enroll Wajah & PDP Consent Staf Baru', status: 'Kritis', desc: 'Staf baru a.n Rian belum enroll data biometrik wajah' },
                      { title: 'Rekonsiliasi Kas POS vs Kas Fisik', status: 'Lengkap', desc: 'Total sales sinkron, tidak ada selisih kas' },
                    ].map((chk, i) => (
                      <div key={i} className="p-4 border border-suka-brown/10 rounded-xl flex justify-between items-start bg-suka-cream/5 hover:bg-suka-cream/10 transition-colors">
                        <div className="space-y-1">
                          <h3 className="font-bold text-sm text-suka-ink">{chk.title}</h3>
                          <p className="text-xs text-suka-brown/70">{chk.desc}</p>
                        </div>
                        <span className={`text-[10px] px-2.5 py-1 rounded-md font-bold uppercase tracking-wide ${
                          chk.status === 'Kritis' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {chk.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-suka-brown/50 text-sm font-semibold">
                  Pilih outlet di sebelah kiri untuk melihat kepatuhan operasional
                </div>
              )}
            </section>
          </div>
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

      {/* Transfer Suggestions */}
      <section className="space-y-3">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-suka-brown/70">
          Saran Transfer Antar-Outlet
        </h2>
        <TransferSuggestionPanel
          items={items ?? []}
          onTransfer={handleSuggestionTransfer}
        />
      </section>

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
