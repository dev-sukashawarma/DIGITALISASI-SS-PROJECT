'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@suka/auth';
import { useOutletScope } from '@/hooks/useOutletScope';
import { useInboundOutbound } from '@/hooks/useInboundOutbound';
import { useBahanBaku } from '@/hooks/useBahanBaku';
import { InboundOutboundList, getDistribusiCalculation } from '@/components/stok/InboundOutboundList';
import { OutletSwitcher } from '@/components/common/OutletSwitcher';
import { UserAvatarDropdown } from '@/components/common/UserAvatarDropdown';
import { AppLayout } from '@/components/layout/AppLayout';
import { 
  Loader2, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  X, 
  RotateCcw, 
  ShieldAlert, 
  Store, 
  Package,
  Scale
} from 'lucide-react';
import { InboundOutboundTipe } from '@/types/stok';
import { format, subDays, startOfMonth } from 'date-fns';

type DatePreset = 'ALL' | 'TODAY' | '7DAYS' | 'THIS_MONTH' | 'CUSTOM';

export default function InboundOutboundPage() {
  const { outletStaff } = useAuth();
  const { boundOutlets, selectedOutletId, setSelectedOutletId: syncGlobalOutlet } = useOutletScope();
  const { bahanBaku } = useBahanBaku();
  
  const [currentOutletId, setCurrentOutletId] = useState<string>(selectedOutletId || 'ALL');
  const [userHasSelectedOutlet, setUserHasSelectedOutlet] = useState(false);
  const [selectedBahanId, setSelectedBahanId] = useState<string>('ALL');

  const [page, setPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipe, setFilterTipe] = useState<InboundOutboundTipe | 'ALL'>('ALL');
  
  // Date filter state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activePreset, setActivePreset] = useState<DatePreset>('ALL');

  // Sinkronisasi outlet aktif dari scope saat pertama kali dimuat
  useEffect(() => {
    if (!userHasSelectedOutlet && selectedOutletId && currentOutletId === 'ALL') {
      setCurrentOutletId(selectedOutletId);
    }
  }, [selectedOutletId, userHasSelectedOutlet, currentOutletId]);

  const handleOutletChange = (newId: string) => {
    setUserHasSelectedOutlet(true);
    setCurrentOutletId(newId);
    setPage(0);
    if (newId !== 'ALL') {
      syncGlobalOutlet(newId);
    }
  };

  const handleBahanChange = (newId: string) => {
    setSelectedBahanId(newId);
    setPage(0);
  };

  const { data, loading, error } = useInboundOutbound(
    currentOutletId, 
    page, 
    searchTerm,
    startDate || undefined,
    endDate || undefined,
    selectedBahanId
  );

  const applyPreset = (preset: 'ALL' | 'TODAY' | '7DAYS' | 'THIS_MONTH') => {
    setActivePreset(preset);
    setPage(0);
    const now = new Date();
    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'TODAY') {
      const todayStr = format(now, 'yyyy-MM-dd');
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === '7DAYS') {
      setStartDate(format(subDays(now, 6), 'yyyy-MM-dd'));
      setEndDate(format(now, 'yyyy-MM-dd'));
    } else if (preset === 'THIS_MONTH') {
      setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'));
      setEndDate(format(now, 'yyyy-MM-dd'));
    }
  };

  const handleCustomStartDate = (val: string) => {
    setStartDate(val);
    setActivePreset('CUSTOM');
    setPage(0);
  };

  const handleCustomEndDate = (val: string) => {
    setEndDate(val);
    setActivePreset('CUSTOM');
    setPage(0);
  };

  const resetAllFilters = () => {
    setSearchTerm('');
    setFilterTipe('ALL');
    setSelectedBahanId('ALL');
    handleOutletChange('ALL');
    applyPreset('ALL');
    setPage(0);
  };

  // Menyembunyikan menu di nav saja tidak cukup -- URL-nya tetap bisa dibuka
  // langsung. Datanya sendiri sudah dibatasi RLS `ledger_read`, guard ini
  // menegakkan maksudnya: halaman arus barang gudang khusus staff gudang, admin, dan purchasing.
  const canViewInboundOutbound = ['kitchen', 'admin', 'purchasing', 'developer'].includes(outletStaff?.role ?? '');
  if (outletStaff && !canViewInboundOutbound) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-[#fff8f1] flex items-center justify-center px-6">
          <div className="bg-white border border-suka-brown/10 rounded-2xl shadow-xs p-10 max-w-md text-center">
            <div className="w-14 h-14 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-7 h-7 text-amber-600" />
            </div>
            <p className="text-suka-brown font-extrabold text-sm">Halaman khusus staff gudang & manajemen</p>
            <p className="text-suka-brown/60 text-xs mt-2 leading-relaxed">
              Inbound / Outbound mencatat arus barang Gudang Pusat. Untuk riwayat stok
              outletmu, buka halaman <span className="font-bold">Ledger Stok</span>.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!outletStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fff8f1]">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-suka-orange mx-auto" />
          <p className="text-suka-brown font-bold uppercase tracking-wider text-sm">Memuat Data...</p>
        </div>
      </div>
    );
  }

  const filteredData = useMemo(() => {
    const raw = (data || []).filter(item => {
      const matchesTipe = filterTipe === 'ALL' || item.tipe === filterTipe;
      const matchesBahan = !selectedBahanId || selectedBahanId === 'ALL' || item.bahan_baku_id === selectedBahanId;
      return matchesTipe && matchesBahan;
    });

    const outletMap = new Map(boundOutlets.map(o => [o.id, o.name]));
    return raw.map(item => ({
      ...item,
      outlet_nama: outletMap.get(item.outlet_id) || null,
    }));
  }, [data, filterTipe, selectedBahanId, boundOutlets]);

  // Kalkulasi Ringkasan Inbound, Outbound, dan Selisih untuk Card
  const summary = useMemo(() => {
    let inTotalNilai = 0;
    let outTotalNilai = 0;
    let inKg = 0;
    let outKg = 0;
    let inCount = 0;
    let outCount = 0;
    let inOtherQty = 0;
    let outOtherQty = 0;
    let hasOtherUnit = false;
    let otherUnitLabel = '';

    const isSingleBahan = selectedBahanId && selectedBahanId !== 'ALL';

    for (const item of filteredData) {
      const calc = getDistribusiCalculation(item);
      const nilai = calc.totalNilai || 0;
      const unit = (calc.unitLabel || '').toLowerCase().trim();
      const isKg = unit === 'kg' || unit === 'gram' || unit === 'gr';
      const kgVal = (unit === 'gram' || unit === 'gr') ? calc.qtyNumber / 1000 : calc.qtyNumber;

      if (item.tipe === 'IN') {
        inCount++;
        inTotalNilai += nilai;
        if (isKg || isSingleBahan) {
          inKg += kgVal;
        } else {
          hasOtherUnit = true;
          inOtherQty += calc.qtyNumber;
          otherUnitLabel = calc.unitLabel;
        }
      } else if (item.tipe === 'OUT') {
        outCount++;
        outTotalNilai += nilai;
        if (isKg || isSingleBahan) {
          outKg += kgVal;
        } else {
          hasOtherUnit = true;
          outOtherQty += calc.qtyNumber;
          otherUnitLabel = calc.unitLabel;
        }
      }
    }

    const unitLabel = isSingleBahan
      ? (filteredData[0]?.bahan_baku?.satuan_distribusi || filteredData[0]?.bahan_baku?.satuan || 'kg')
      : 'kg';

    const formatNumber = (val: number) => {
      const rounded = Math.round(val * 100) / 100;
      return rounded.toLocaleString('id-ID');
    };

    const inKgDisplay = isSingleBahan
      ? `${formatNumber(inKg)} ${unitLabel}`
      : hasOtherUnit && inOtherQty > 0
      ? `${formatNumber(inKg)} kg (+${Math.round(inOtherQty).toLocaleString('id-ID')} ${otherUnitLabel})`
      : `${formatNumber(inKg)} kg`;

    const outKgDisplay = isSingleBahan
      ? `${formatNumber(outKg)} ${unitLabel}`
      : hasOtherUnit && outOtherQty > 0
      ? `${formatNumber(outKg)} kg (+${Math.round(outOtherQty).toLocaleString('id-ID')} ${otherUnitLabel})`
      : `${formatNumber(outKg)} kg`;

    const diffNilai = inTotalNilai - outTotalNilai;
    const diffKg = inKg - outKg;

    const diffSign = diffKg > 0 ? '+' : '';
    const diffKgDisplay = `${diffSign}${formatNumber(diffKg)} ${unitLabel}`;

    return {
      inCount,
      outCount,
      inTotalNilai,
      outTotalNilai,
      inKg,
      outKg,
      inKgDisplay,
      outKgDisplay,
      diffNilai,
      diffKg,
      diffKgDisplay,
    };
  }, [filteredData, selectedBahanId]);

  const isFiltered = Boolean(
    searchTerm || 
    filterTipe !== 'ALL' || 
    startDate || 
    endDate || 
    currentOutletId !== 'ALL' || 
    selectedBahanId !== 'ALL'
  );

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-24">
        {/* Header Banner */}
        <header className="bg-white/95 backdrop-blur-md border-b border-suka-brown/10 px-4 sm:px-6 lg:px-8 xl:px-10 py-4 flex items-center justify-between shadow-2xs sticky top-0 z-20">
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-suka-brown tracking-tight truncate">
              Inbound / Outbound
            </h1>
            <p className="text-[10px] text-suka-brown/60 font-bold uppercase tracking-wider mt-0.5">
              Barang Masuk dari Vendor & Keluar ke Outlet
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <OutletSwitcher
              allowAll
              allLabel="Semua Outlet"
              value={currentOutletId}
              onChange={handleOutletChange}
            />
            <UserAvatarDropdown />
          </div>
        </header>

        {/* Main Container */}
        <main className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 mt-6 space-y-5">
          {/* Top Action & Search Bar */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col lg:flex-row gap-3 items-stretch justify-between">
              {/* Outlet & Bahan Baku Selectors */}
              <div className="flex flex-col sm:flex-row gap-2.5 flex-1">
                {/* Outlet Filter */}
                <div className="relative flex-1 min-w-[180px]">
                  <Store className="w-4 h-4 text-suka-brown/40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={currentOutletId}
                    onChange={(e) => handleOutletChange(e.target.value)}
                    className="w-full pl-10 pr-8 py-2.5 bg-white border border-suka-brown/10 rounded-xl text-xs font-bold text-suka-brown focus:outline-none focus:ring-2 focus:ring-suka-orange shadow-xs cursor-pointer truncate"
                  >
                    <option value="ALL">🏢 Semua Outlet</option>
                    {boundOutlets.map((outlet) => (
                      <option key={outlet.id} value={outlet.id}>
                        {outlet.name}
                      </option>
                    ))}
                  </select>
                  {currentOutletId !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => handleOutletChange('ALL')}
                      title="Reset ke Semua Outlet"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-suka-brown/40 hover:text-suka-brown p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Bahan Baku Filter */}
                <div className="relative flex-1 min-w-[200px]">
                  <Package className="w-4 h-4 text-suka-brown/40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={selectedBahanId}
                    onChange={(e) => handleBahanChange(e.target.value)}
                    className="w-full pl-10 pr-8 py-2.5 bg-white border border-suka-brown/10 rounded-xl text-xs font-bold text-suka-brown focus:outline-none focus:ring-2 focus:ring-suka-orange shadow-xs cursor-pointer truncate"
                  >
                    <option value="ALL">📦 Semua Bahan Baku</option>
                    {bahanBaku.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nama} {b.satuan ? `(${b.satuan})` : ''}
                      </option>
                    ))}
                  </select>
                  {selectedBahanId !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => handleBahanChange('ALL')}
                      title="Reset filter bahan"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-suka-brown/40 hover:text-suka-brown p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Search Bar & Tipe Switcher */}
              <div className="flex flex-col sm:flex-row gap-2.5 flex-1 lg:max-w-xl">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-suka-brown/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari nomor SJ, PO, vendor, atau catatan..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setPage(0);
                    }}
                    className="w-full pl-10 pr-8 py-2.5 bg-white border border-suka-brown/10 rounded-xl text-xs font-medium text-suka-brown placeholder-suka-brown/40 focus:outline-none focus:ring-2 focus:ring-suka-orange shadow-xs"
                  />
                  {searchTerm && (
                    <button 
                      onClick={() => { setSearchTerm(''); setPage(0); }} 
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-suka-brown/40 hover:text-suka-brown cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Tipe Filter (Semua / Inbound / Outbound) */}
                <div className="flex bg-white rounded-xl p-1 shadow-xs border border-suka-brown/10 sm:w-64 shrink-0">
                  <button
                    onClick={() => { setFilterTipe('ALL'); setPage(0); }}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${filterTipe === 'ALL' ? 'bg-suka-brown text-white shadow-2xs' : 'text-suka-brown/60 hover:text-suka-brown'}`}
                  >
                    Semua
                  </button>
                  <button
                    onClick={() => { setFilterTipe('IN'); setPage(0); }}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${filterTipe === 'IN' ? 'bg-green-600 text-white shadow-2xs' : 'text-suka-brown/60 hover:text-suka-brown'}`}
                  >
                    <ArrowDownCircle className="w-3.5 h-3.5" /> In
                  </button>
                  <button
                    onClick={() => { setFilterTipe('OUT'); setPage(0); }}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${filterTipe === 'OUT' ? 'bg-red-600 text-white shadow-2xs' : 'text-suka-brown/60 hover:text-suka-brown'}`}
                  >
                    <ArrowUpCircle className="w-3.5 h-3.5" /> Out
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Date Filter Bar */}
          <div className="bg-white border border-suka-brown/10 rounded-2xl p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex items-center gap-1.5 mr-1 text-xs font-black text-suka-brown">
                <Calendar className="w-4 h-4 text-suka-orange" />
                <span className="hidden sm:inline">Periode:</span>
              </div>
              <button
                onClick={() => applyPreset('ALL')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  activePreset === 'ALL'
                    ? 'bg-suka-orange text-white border-suka-orange shadow-2xs'
                    : 'bg-white text-suka-brown/70 border-suka-brown/10 hover:border-suka-brown/30'
                }`}
              >
                Semua
              </button>
              <button
                onClick={() => applyPreset('TODAY')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  activePreset === 'TODAY'
                    ? 'bg-suka-orange text-white border-suka-orange shadow-2xs'
                    : 'bg-white text-suka-brown/70 border-suka-brown/10 hover:border-suka-brown/30'
                }`}
              >
                Hari Ini
              </button>
              <button
                onClick={() => applyPreset('7DAYS')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  activePreset === '7DAYS'
                    ? 'bg-suka-orange text-white border-suka-orange shadow-2xs'
                    : 'bg-white text-suka-brown/70 border-suka-brown/10 hover:border-suka-brown/30'
                }`}
              >
                7 Hari Terakhir
              </button>
              <button
                onClick={() => applyPreset('THIS_MONTH')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  activePreset === 'THIS_MONTH'
                    ? 'bg-suka-orange text-white border-suka-orange shadow-2xs'
                    : 'bg-white text-suka-brown/70 border-suka-brown/10 hover:border-suka-brown/30'
                }`}
              >
                Bulan Ini
              </button>
            </div>

            {/* Custom Date Range Picker */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-[#fcfaf8] border border-suka-brown/15 rounded-xl px-2.5 py-1">
                <span className="text-[10px] font-extrabold text-suka-brown/60 uppercase">Dari</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleCustomStartDate(e.target.value)}
                  className="bg-transparent text-xs font-bold text-suka-brown focus:outline-none cursor-pointer"
                />
              </div>

              <span className="text-xs font-black text-suka-brown/40">—</span>

              <div className="flex items-center gap-1.5 bg-[#fcfaf8] border border-suka-brown/15 rounded-xl px-2.5 py-1">
                <span className="text-[10px] font-extrabold text-suka-brown/60 uppercase">Sampai</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => handleCustomEndDate(e.target.value)}
                  className="bg-transparent text-xs font-bold text-suka-brown focus:outline-none cursor-pointer"
                />
              </div>

              {isFiltered && (
                <button
                  onClick={resetAllFilters}
                  title="Reset Semua Filter"
                  className="p-1.5 text-suka-brown/50 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Kartu Ringkasan (Inbound, Outbound, Selisih) saat Filter Tipe = Semua */}
          {filterTipe === 'ALL' && !loading && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4 animate-fade-in">
              {/* Card Inbound */}
              <div className="bg-white border border-green-200/80 rounded-2xl p-4 sm:p-5 shadow-xs relative overflow-hidden flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-green-100/80 text-green-700 flex items-center justify-center shrink-0">
                      <ArrowDownCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-green-700 block">
                        Arus Masuk
                      </span>
                      <h3 className="text-sm font-black text-suka-brown">Total Inbound</h3>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                    {summary.inCount} Transaksi
                  </span>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-suka-brown/5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] font-bold text-suka-brown/60">Total Harga:</span>
                    <span className="text-base sm:text-lg font-black text-green-700 tracking-tight">
                      Rp {Math.round(summary.inTotalNilai).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] font-bold text-suka-brown/60">Total Volume:</span>
                    <span className="text-xs sm:text-sm font-extrabold text-suka-brown">
                      {summary.inKgDisplay}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Outbound */}
              <div className="bg-white border border-red-200/80 rounded-2xl p-4 sm:p-5 shadow-xs relative overflow-hidden flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-red-100/80 text-red-600 flex items-center justify-center shrink-0">
                      <ArrowUpCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-red-600 block">
                        Arus Keluar
                      </span>
                      <h3 className="text-sm font-black text-suka-brown">Total Outbound</h3>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                    {summary.outCount} Transaksi
                  </span>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-suka-brown/5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] font-bold text-suka-brown/60">Total Harga:</span>
                    <span className="text-base sm:text-lg font-black text-red-600 tracking-tight">
                      Rp {Math.round(summary.outTotalNilai).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] font-bold text-suka-brown/60">Total Volume:</span>
                    <span className="text-xs sm:text-sm font-extrabold text-suka-brown">
                      {summary.outKgDisplay}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Total / Selisih */}
              <div className="bg-white border border-suka-orange/30 rounded-2xl p-4 sm:p-5 shadow-xs relative overflow-hidden flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-suka-orange flex items-center justify-center shrink-0">
                      <Scale className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-suka-orange block">
                        Net Mutasi
                      </span>
                      <h3 className="text-sm font-black text-suka-brown">Total / Selisih</h3>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-suka-cream text-suka-brown/70 border border-suka-brown/10">
                    Masuk - Keluar
                  </span>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-suka-brown/5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] font-bold text-suka-brown/60">Selisih Harga:</span>
                    <span className={`text-base sm:text-lg font-black tracking-tight ${
                      summary.diffNilai > 0
                        ? 'text-green-700'
                        : summary.diffNilai < 0
                        ? 'text-red-600'
                        : 'text-suka-brown'
                    }`}>
                      {summary.diffNilai > 0 ? '+' : ''}Rp {Math.round(summary.diffNilai).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] font-bold text-suka-brown/60">Selisih Volume:</span>
                    <span className={`text-xs sm:text-sm font-extrabold ${
                      summary.diffKg > 0
                        ? 'text-green-700'
                        : summary.diffKg < 0
                        ? 'text-red-600'
                        : 'text-suka-brown'
                    }`}>
                      {summary.diffKgDisplay}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-xs font-bold text-red-700">
              🚨 Error: {error}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-suka-orange mx-auto" />
              <p className="text-suka-brown/70 font-bold uppercase tracking-wider text-xs mt-4 animate-pulse">Memuat riwayat pergerakan...</p>
            </div>
          ) : (
            <>
              <InboundOutboundList items={filteredData} />

              {/* Pagination Controls */}
              {(data || []).length > 0 && (
                <div className="flex justify-between items-center bg-white border border-suka-brown/10 p-4 rounded-2xl shadow-xs mt-6">
                  <button
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    className="px-4 py-2 flex items-center gap-2 bg-white border border-suka-brown/15 hover:bg-suka-cream text-suka-brown disabled:opacity-35 disabled:hover:bg-white rounded-xl font-bold text-xs transition-all shadow-2xs active:scale-95 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" /> Halaman Sebelumnya
                  </button>
                  <span className="text-xs font-bold text-suka-brown/60">
                    Halaman {page + 1}
                  </span>
                  <button
                    disabled={(data || []).length < 100}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-4 py-2 flex items-center gap-2 bg-white border border-suka-brown/15 hover:bg-suka-cream text-suka-brown disabled:opacity-35 disabled:hover:bg-white rounded-xl font-bold text-xs transition-all shadow-2xs active:scale-95 cursor-pointer"
                  >
                    Halaman Berikutnya <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </AppLayout>
  );
}
