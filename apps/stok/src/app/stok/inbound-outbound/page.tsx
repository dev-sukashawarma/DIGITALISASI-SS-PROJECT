'use client';

import { useState } from 'react';
import { useAuth } from '@suka/auth';
import { useOutletScope } from '@/hooks/useOutletScope';
import { useInboundOutbound } from '@/hooks/useInboundOutbound';
import { InboundOutboundList } from '@/components/stok/InboundOutboundList';
import { InboundOutboundDrawer } from '@/components/stok/InboundOutboundDrawer';
import { OutletSwitcher } from '@/components/common/OutletSwitcher';
import { UserAvatarDropdown } from '@/components/common/UserAvatarDropdown';
import { AppLayout } from '@/components/layout/AppLayout';
import { 
  Plus, 
  Loader2, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  Calendar,
  X,
  RotateCcw
} from 'lucide-react';
import { InboundOutboundTipe } from '@/types/stok';
import { format, subDays, startOfMonth } from 'date-fns';

type DatePreset = 'ALL' | 'TODAY' | '7DAYS' | 'THIS_MONTH' | 'CUSTOM';

export default function InboundOutboundPage() {
  const { outletStaff } = useAuth();
  const { selectedOutletId } = useOutletScope();
  
  const [page, setPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipe, setFilterTipe] = useState<InboundOutboundTipe | 'ALL'>('ALL');
  
  // Date filter state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activePreset, setActivePreset] = useState<DatePreset>('ALL');

  const { data, loading, error, refresh } = useInboundOutbound(
    selectedOutletId || undefined, 
    page, 
    searchTerm,
    startDate || undefined,
    endDate || undefined
  );
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

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
    applyPreset('ALL');
    setPage(0);
  };

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

  const filteredData = (data || []).filter(item => filterTipe === 'ALL' || item.tipe === filterTipe);
  const isFiltered = Boolean(searchTerm || filterTipe !== 'ALL' || startDate || endDate);

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
              Catatan Pergerakan Stok Gudang
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <OutletSwitcher />
            <UserAvatarDropdown />
          </div>
        </header>

        {/* Main Container */}
        <main className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 mt-6 space-y-5">
          {/* Top Action & Search Bar */}
          <div className="flex flex-col lg:flex-row gap-3 items-stretch justify-between">
            <button 
              onClick={() => setIsDrawerOpen(true)}
              className="py-3 px-6 bg-suka-brown hover:bg-suka-brown/90 text-white rounded-2xl font-black text-xs sm:text-sm transition-all shadow-xs uppercase tracking-wider active:scale-95 flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" /> Catat Mutasi Baru
            </button>
            
            <div className="flex flex-col sm:flex-row gap-3 flex-1 justify-end">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-lg">
                <Search className="w-4 h-4 text-suka-brown/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari bahan baku, kategori, cabang tujuan, atau nomor SJ..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(0);
                  }}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-suka-brown/10 rounded-xl text-xs font-medium text-suka-brown placeholder-suka-brown/40 focus:outline-none focus:ring-2 focus:ring-suka-orange shadow-xs"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-suka-brown/40 hover:text-suka-brown"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Tipe Filter (Semua / Inbound / Outbound) */}
              <div className="flex bg-white rounded-xl p-1 shadow-xs border border-suka-brown/10 sm:w-72 shrink-0">
                <button
                  onClick={() => setFilterTipe('ALL')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${filterTipe === 'ALL' ? 'bg-suka-brown text-white shadow-2xs' : 'text-suka-brown/60 hover:text-suka-brown'}`}
                >
                  Semua
                </button>
                <button
                  onClick={() => setFilterTipe('IN')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${filterTipe === 'IN' ? 'bg-green-600 text-white shadow-2xs' : 'text-suka-brown/60 hover:text-suka-brown'}`}
                >
                  <ArrowDownCircle className="w-3.5 h-3.5" /> Inbound
                </button>
                <button
                  onClick={() => setFilterTipe('OUT')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${filterTipe === 'OUT' ? 'bg-red-600 text-white shadow-2xs' : 'text-suka-brown/60 hover:text-suka-brown'}`}
                >
                  <ArrowUpCircle className="w-3.5 h-3.5" /> Outbound
                </button>
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
                className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                  activePreset === 'ALL'
                    ? 'bg-suka-orange text-white border-suka-orange shadow-2xs'
                    : 'bg-white text-suka-brown/70 border-suka-brown/10 hover:border-suka-brown/30'
                }`}
              >
                Semua
              </button>
              <button
                onClick={() => applyPreset('TODAY')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                  activePreset === 'TODAY'
                    ? 'bg-suka-orange text-white border-suka-orange shadow-2xs'
                    : 'bg-white text-suka-brown/70 border-suka-brown/10 hover:border-suka-brown/30'
                }`}
              >
                Hari Ini
              </button>
              <button
                onClick={() => applyPreset('7DAYS')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                  activePreset === '7DAYS'
                    ? 'bg-suka-orange text-white border-suka-orange shadow-2xs'
                    : 'bg-white text-suka-brown/70 border-suka-brown/10 hover:border-suka-brown/30'
                }`}
              >
                7 Hari Terakhir
              </button>
              <button
                onClick={() => applyPreset('THIS_MONTH')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
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

      {selectedOutletId && (
        <InboundOutboundDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          outletId={selectedOutletId}
          onSuccess={refresh}
        />
      )}
    </AppLayout>
  );
}
