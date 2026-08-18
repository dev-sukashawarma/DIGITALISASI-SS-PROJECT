'use client';

import React, { useState, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ShoppingBag,
  Banknote,
  Calendar,
  ChevronDown,
  Clock,
  Search,
  Store,
  Flame,
  UtensilsCrossed,
  ArrowLeft,
  RefreshCw,
  SlidersHorizontal
} from 'lucide-react';

type DateRange = 'today' | 'yesterday' | '7days' | '30days' | 'all' | 'custom';

const RANGE_LABELS: Record<DateRange, string> = {
  today: 'Hari Ini',
  yesterday: 'Kemarin',
  '7days': '7 Hari Terakhir',
  '30days': '30 Hari Terakhir',
  all: 'Semua Waktu',
  custom: 'Kustom Tanggal',
};

const formatRupiah = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

interface LaporanPenjualanClientProps {
  analytics: {
    totalRevenue: number;
    netRevenue: number;
    totalDeductions: number;
    totalOrders: number;
    totalItemsSold: number;
    avgOrderValue: number;
    canceledCount: number;
    peakHour: number | null;
    hourly: number[];
    hourlyRevenue: number[];
    hourlyPorsi: number[];
    channelStats: Record<string, { label: string; count: number; revenue: number; porsi: number }>;
    bestSellers: Array<{ name: string; qty: number; revenue: number; orderCount: number }>;
    outletVolumeList: Array<{
      outletId: string;
      outletName: string;
      category: 'mitra' | 'internal';
      totalRevenue: number;
      totalOrders: number;
      itemsSold: number;
      items: Record<string, number>;
    }>;
  };
  outlets: Array<{
    id: string;
    name: string;
    cleanName: string;
    category: 'mitra' | 'internal';
  }>;
  initialFilters: {
    range: string;
    customStart: string;
    customEnd: string;
    channelFilter: string;
    outletFilter: string;
  };
  staffName?: string;
}

export default function LaporanPenjualanClient({
  analytics,
  outlets,
  initialFilters,
  staffName = 'Admin Kitchen',
}: LaporanPenjualanClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [showRangePicker, setShowRangePicker] = useState(false);
  const [menuSearch, setMenuSearch] = useState('');
  const [outletSearch, setOutletSearch] = useState('');
  const [outletCategoryTab, setOutletCategoryTab] = useState<'all' | 'internal' | 'mitra'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sync state dengan URL query params
  const range = (searchParams.get('range') || initialFilters.range) as DateRange;
  const customStart = searchParams.get('customStart') || initialFilters.customStart;
  const customEnd = searchParams.get('customEnd') || initialFilters.customEnd;
  const channelFilter = searchParams.get('channel') || initialFilters.channelFilter;
  const outletFilter = searchParams.get('outlet_id') || initialFilters.outletFilter;

  const updateFilters = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'all') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const updateCustomRange = (start: string, end: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('range', 'custom');
    if (start) params.set('customStart', start);
    if (end) params.set('customEnd', end);
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  // Pengelompokan outlet Internal & Mitra untuk Dropdown
  const internalOutlets = useMemo(() => outlets.filter(o => o.category === 'internal'), [outlets]);
  const mitraOutlets = useMemo(() => outlets.filter(o => o.category === 'mitra'), [outlets]);

  // Filter menu items berdasarkan search
  const filteredBestSellers = useMemo(() => {
    const q = menuSearch.trim().toLowerCase();
    if (!q) return analytics.bestSellers;
    return analytics.bestSellers.filter(item => item.name.toLowerCase().includes(q));
  }, [analytics.bestSellers, menuSearch]);

  // Filter outlet volume berdasarkan kategori & search
  const filteredOutletVolumes = useMemo(() => {
    let list = analytics.outletVolumeList;
    if (outletCategoryTab !== 'all') {
      list = list.filter(o => o.category === outletCategoryTab);
    }
    const q = outletSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(o => o.outletName.toLowerCase().includes(q));
  }, [analytics.outletVolumeList, outletCategoryTab, outletSearch]);

  // Max porsi item for relative percentage
  const maxItemQty = analytics.bestSellers[0]?.qty || 1;
  const maxHourlyCount = Math.max(...analytics.hourly, 1);

  // Channel configuration
  const CHANNEL_CONFIG: Record<string, { label: string; bg: string; text: string; bar: string; icon: string }> = {
    offline: { label: 'Offline (Kasir)', bg: 'bg-emerald-50', text: 'text-emerald-700', bar: 'bg-emerald-500', icon: '🏪' },
    gofood: { label: 'GoFood', bg: 'bg-red-50', text: 'text-red-700', bar: 'bg-red-500', icon: '🛵' },
    grabfood: { label: 'GrabFood', bg: 'bg-emerald-50', text: 'text-green-700', bar: 'bg-green-600', icon: '🟢' },
    shopeefood: { label: 'ShopeeFood', bg: 'bg-orange-50', text: 'text-orange-700', bar: 'bg-orange-500', icon: '🛒' },
    tiktok: { label: 'TikTok Shop', bg: 'bg-gray-100', text: 'text-gray-900', bar: 'bg-gray-800', icon: '🎵' },
    lainnya: { label: 'Lainnya', bg: 'bg-amber-50', text: 'text-amber-700', bar: 'bg-amber-500', icon: '📦' },
  };

  return (
    <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-28">
      {/* ── Top Header Bar ── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#d9c2b2]/40 shadow-xs px-4 sm:px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="w-9 h-9 rounded-xl bg-[#faf2e9] hover:bg-[#ffdcc2] text-[#701604] flex items-center justify-center transition-all border border-[#d9c2b2]/50 active:scale-95 shrink-0"
              title="Kembali ke Dashboard Stok"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-black text-[#701604] tracking-tight flex items-center gap-2">
                  <span>📈</span> Laporan Penjualan Semua Outlet
                </h1>
                <span className="text-[10px] font-black uppercase tracking-wider bg-[#ffdcc2] text-[#701604] px-2 py-0.5 rounded-md border border-[#f29744]/30">
                  👨‍🍳 {staffName}
                </span>
              </div>
              <p className="text-xs font-semibold text-[#544437]/70 mt-0.5">
                Pantau volume porsi, omzet kotor, & tren permintaan menu untuk produksi dapur.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end md:self-auto">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-[#faf2e9] border border-[#d9c2b2] text-[#544437] rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
              title="Perbarui Data Transaksi"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-suka-orange' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Container ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-5 space-y-6">
        {/* ── Control & Filter Bar ── */}
        <div className="bg-white border border-[#d9c2b2]/60 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
          {/* Row 1: Date Presets & Outlet Filter */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Date Preset Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {(['today', 'yesterday', '7days', '30days'] as DateRange[]).map((r) => (
                <button
                  key={r}
                  onClick={() => updateFilters('range', r)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                    range === r
                      ? 'bg-[#f29744] text-white shadow-sm ring-2 ring-[#f29744]/20'
                      : 'bg-[#faf2e9] text-[#544437] hover:bg-[#ffdcc2] hover:text-[#701604]'
                  }`}
                >
                  {RANGE_LABELS[r]}
                </button>
              ))}

              {/* Custom Date Dropdown Button */}
              <div className="relative">
                <button
                  onClick={() => setShowRangePicker(!showRangePicker)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                    range === 'custom' || range === 'all'
                      ? 'bg-[#f29744] text-white shadow-sm'
                      : 'bg-[#faf2e9] text-[#544437] hover:bg-[#ffdcc2]'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{range === 'custom' || range === 'all' ? RANGE_LABELS[range] : 'Lainnya'}</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {showRangePicker && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowRangePicker(false)} />
                    <div className="absolute left-0 sm:right-0 sm:left-auto top-full mt-2 bg-white border border-[#d9c2b2] rounded-2xl shadow-xl py-2 z-50 w-48 animate-in fade-in zoom-in-95 duration-150">
                      {(['all', 'custom'] as DateRange[]).map((r) => (
                        <button
                          key={r}
                          onClick={() => {
                            updateFilters('range', r);
                            setShowRangePicker(false);
                          }}
                          className={`w-full text-left px-4 py-2 text-xs font-bold transition-colors ${
                            range === r ? 'bg-[#ffdcc2] text-[#701604] font-black' : 'text-[#544437] hover:bg-[#faf2e9]'
                          }`}
                        >
                          {RANGE_LABELS[r]}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Outlet Filter Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-[#544437] uppercase tracking-wider flex items-center gap-1 shrink-0">
                <Store className="w-3.5 h-3.5 text-[#f29744]" /> Outlet:
              </span>
              <select
                value={outletFilter}
                onChange={(e) => updateFilters('outlet_id', e.target.value)}
                className="w-full sm:w-64 bg-[#faf2e9] border border-[#d9c2b2] text-[#1e1b15] text-xs font-bold rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#f29744] cursor-pointer font-sans"
              >
                <option value="all">🏢 Semua Outlet Aktif ({outlets.length})</option>
                
                {internalOutlets.length > 0 && (
                  <optgroup label="🏢 OUTLET INTERNAL (PUSAT)">
                    {internalOutlets.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.cleanName}
                      </option>
                    ))}
                  </optgroup>
                )}

                {mitraOutlets.length > 0 && (
                  <optgroup label="🤝 OUTLET MITRA">
                    {mitraOutlets.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.cleanName}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          </div>

          {/* Row 2: Custom Date Inputs (if custom selected) */}
          {range === 'custom' && (
            <div className="flex flex-wrap items-center gap-3 p-3 bg-[#faf2e9] rounded-xl border border-[#d9c2b2]/60 animate-in fade-in">
              <span className="text-xs font-bold text-[#544437]">Rentang Tanggal:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => updateCustomRange(e.target.value, customEnd)}
                className="bg-white border border-[#d9c2b2] text-xs font-bold text-[#1e1b15] px-3 py-1.5 rounded-lg outline-none"
              />
              <span className="text-xs text-[#544437] font-bold">s.d</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => updateCustomRange(customStart, e.target.value)}
                className="bg-white border border-[#d9c2b2] text-xs font-bold text-[#1e1b15] px-3 py-1.5 rounded-lg outline-none"
              />
            </div>
          )}

          {/* Row 3: Channel Filter Pills */}
          <div className="flex items-center gap-2 pt-2 border-t border-[#d9c2b2]/40 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[11px] font-black text-[#544437] uppercase tracking-wider shrink-0 flex items-center gap-1 mr-1">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#f29744]" /> Channel:
            </span>
            {[
              { id: 'all', label: 'Semua Channel' },
              { id: 'offline', label: 'Offline / Kasir' },
              { id: 'food_apps', label: 'Semua Food Apps' },
              { id: 'gofood', label: 'GoFood' },
              { id: 'grabfood', label: 'GrabFood' },
              { id: 'shopeefood', label: 'ShopeeFood' },
              { id: 'tiktok', label: 'TikTok Shop' },
            ].map((ch) => (
              <button
                key={ch.id}
                onClick={() => updateFilters('channel', ch.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  channelFilter === ch.id
                    ? 'bg-[#701604] text-white shadow-xs'
                    : 'bg-[#faf2e9]/70 text-[#544437] hover:bg-[#ffdcc2] hover:text-[#701604]'
                }`}
              >
                {ch.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── 4 Top KPI Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Omzet Kotor */}
          <div className="bg-gradient-to-br from-[#f29744] to-[#e68329] p-5 rounded-2xl text-white shadow-md flex flex-col justify-between relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/10 rounded-full pointer-events-none" />
            <div>
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                <Banknote className="w-5 h-5 text-white" />
              </div>
              <p className="text-[11px] font-black text-white/85 uppercase tracking-wider">Total Omzet Kotor</p>
              <h3 className="text-2xl sm:text-3xl font-black mt-1 tracking-tight">
                {formatRupiah(analytics.totalRevenue)}
              </h3>
            </div>
            <div className="mt-3 pt-3 border-t border-white/20 text-[11px] font-bold text-white/90 space-y-0.5">
              <div className="flex justify-between">
                <span>Net (Diterima):</span>
                <span>{formatRupiah(analytics.netRevenue)}</span>
              </div>
              {analytics.totalDeductions > 0 && (
                <div className="flex justify-between text-white/75 text-[10px]">
                  <span>Diskon / Subsidi:</span>
                  <span>- {formatRupiah(analytics.totalDeductions)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Total Porsi Terjual */}
          <div className="bg-white border border-[#d9c2b2]/70 p-5 rounded-2xl shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mb-3">
                <UtensilsCrossed className="w-5 h-5 text-emerald-600" />
              </div>
              <p className="text-[11px] font-black text-[#544437]/70 uppercase tracking-wider">Total Menu Terjual</p>
              <h3 className="text-2xl sm:text-3xl font-black text-[#1e1b15] mt-1 tracking-tight">
                {analytics.totalItemsSold.toLocaleString('id-ID')} <span className="text-sm font-bold text-[#544437]">Porsi</span>
              </h3>
            </div>
            <p className="text-[11px] font-bold text-emerald-600 mt-3 pt-3 border-t border-[#d9c2b2]/30 flex items-center gap-1">
              <span>🍲</span> Total item diproduksi dapur
            </p>
          </div>

          {/* Card 3: Total Transaksi Selesai */}
          <div className="bg-white border border-[#d9c2b2]/70 p-5 rounded-2xl shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mb-3">
                <ShoppingBag className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-[11px] font-black text-[#544437]/70 uppercase tracking-wider">Pesanan Selesai</p>
              <h3 className="text-2xl sm:text-3xl font-black text-[#1e1b15] mt-1 tracking-tight">
                {analytics.totalOrders.toLocaleString('id-ID')} <span className="text-sm font-bold text-[#544437]">Order</span>
              </h3>
            </div>
            <p className="text-[11px] font-bold text-[#544437]/70 mt-3 pt-3 border-t border-[#d9c2b2]/30">
              Rata-rata/order: <span className="font-black text-[#701604]">{formatRupiah(analytics.avgOrderValue)}</span>
            </p>
          </div>

          {/* Card 4: Jam Tersibuk Dapur */}
          <div className="bg-white border border-[#d9c2b2]/70 p-5 rounded-2xl shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center mb-3">
                <Clock className="w-5 h-5 text-purple-600" />
              </div>
              <p className="text-[11px] font-black text-[#544437]/70 uppercase tracking-wider">Jam Puncak Dapur</p>
              <h3 className="text-2xl sm:text-3xl font-black text-[#701604] mt-1 tracking-tight">
                {analytics.peakHour !== null ? `${String(analytics.peakHour).padStart(2, '0')}:00 WIB` : '—'}
              </h3>
            </div>
            <p className="text-[11px] font-bold text-purple-700 mt-3 pt-3 border-t border-[#d9c2b2]/30 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-orange-500" /> Jam lonjakan pesanan tertinggi
            </p>
          </div>
        </div>

        {/* ── Mid Section: Channel Breakdown & Hourly Trend ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Kolom 1: Distribusi Channel Penjualan */}
          <div className="bg-white border border-[#d9c2b2]/60 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-black text-base text-[#701604] flex items-center gap-2">
                  <span>📊</span> Distribusi Channel Penjualan
                </h2>
                <p className="text-xs font-semibold text-[#544437]/70">Porsi & omzet per saluran penjualan</p>
              </div>
            </div>

            <div className="space-y-3.5 pt-1">
              {Object.entries(analytics.channelStats)
                .filter(([_, data]) => data.count > 0 || analytics.totalOrders === 0)
                .sort((a, b) => b[1].revenue - a[1].revenue)
                .map(([chKey, data]) => {
                  const cfg = CHANNEL_CONFIG[chKey] || CHANNEL_CONFIG.lainnya;
                  const revPercent = analytics.totalRevenue > 0 ? (data.revenue / analytics.totalRevenue) * 100 : 0;
                  const porsiPercent = analytics.totalItemsSold > 0 ? (data.porsi / analytics.totalItemsSold) * 100 : 0;

                  return (
                    <div key={chKey} className="p-3.5 bg-[#faf2e9]/50 rounded-xl border border-[#d9c2b2]/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{cfg.icon}</span>
                          <div>
                            <p className="text-xs font-black text-[#1e1b15]">{cfg.label}</p>
                            <p className="text-[10px] font-bold text-[#544437]/70">
                              {data.count} Transaksi • <span className="text-[#701604] font-black">{data.porsi} Porsi ({porsiPercent.toFixed(1)}%)</span>
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-black text-[#701604]">{formatRupiah(data.revenue)}</p>
                          <p className="text-[10px] font-bold text-[#544437]/70">{revPercent.toFixed(1)}% Omzet</p>
                        </div>
                      </div>

                      {/* Visual Progress Bar */}
                      <div className="w-full bg-[#d9c2b2]/30 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${cfg.bar} rounded-full transition-all duration-500`}
                          style={{ width: `${Math.max(revPercent, 2)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}

              {analytics.totalOrders === 0 && (
                <div className="text-center py-8 text-xs font-bold text-[#544437]/50 italic">
                  Tidak ada transaksi pada filter periode ini.
                </div>
              )}
            </div>
          </div>

          {/* Kolom 2: Grafik Jam Sibuk (Hourly Trend) */}
          <div className="bg-white border border-[#d9c2b2]/60 rounded-2xl p-5 shadow-xs space-y-4">
            <div>
              <h2 className="font-black text-base text-[#701604] flex items-center gap-2">
                <span>⏰</span> Pola Waktu Pemesanan (WIB)
              </h2>
              <p className="text-xs font-semibold text-[#544437]/70">Distribusi jumlah pesanan per jam untuk persiapan dapur</p>
            </div>

            {/* Custom Interactive SVG / HTML5 Bar Chart */}
            <div className="pt-2">
              <div className="h-48 flex items-end gap-1 sm:gap-1.5 px-2 border-b border-[#d9c2b2]/60 pb-1">
                {analytics.hourly.slice(7, 24).map((count, idx) => {
                  const hour = idx + 7;
                  const heightPercent = maxHourlyCount > 0 ? (count / maxHourlyCount) * 100 : 0;
                  const isPeak = analytics.peakHour === hour && count > 0;
                  const porsi = analytics.hourlyPorsi[hour] || 0;

                  return (
                    <div
                      key={hour}
                      className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                    >
                      {/* Tooltip on hover */}
                      <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-30 pointer-events-none">
                        <div className="bg-[#1e1b15] text-white text-[10px] rounded-lg py-1.5 px-2.5 shadow-lg whitespace-nowrap font-bold">
                          <p className="text-[#ffdcc2] font-black">{String(hour).padStart(2, '0')}:00 WIB</p>
                          <p>{count} Order</p>
                          <p className="text-[#f29744]">{porsi} Porsi Menu</p>
                        </div>
                        <div className="w-2 h-2 bg-[#1e1b15] rotate-45 -mt-1" />
                      </div>

                      {/* Count label above peak bar */}
                      {isPeak && (
                        <span className="text-[9px] font-black text-[#ba1a1a] mb-1 leading-none">
                          🔥
                        </span>
                      )}

                      {/* The Bar */}
                      <div
                        className={`w-full rounded-t-md transition-all duration-300 ${
                          isPeak
                            ? 'bg-[#ba1a1a] shadow-xs'
                            : count > 0
                            ? 'bg-[#f29744] hover:bg-[#e68329]'
                            : 'bg-[#d9c2b2]/30'
                        }`}
                        style={{ height: `${Math.max(heightPercent, count > 0 ? 8 : 2)}%` }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Hour X-Axis Labels */}
              <div className="flex items-center justify-between text-[9px] font-bold text-[#544437]/60 pt-2 px-2">
                <span>07:00</span>
                <span>10:00</span>
                <span>12:00 (Siang)</span>
                <span>15:00</span>
                <span>18:00 (Malam)</span>
                <span>21:00</span>
                <span>23:00</span>
              </div>
            </div>

            <div className="p-3 bg-[#faf2e9] rounded-xl border border-[#d9c2b2]/40 text-xs font-semibold text-[#544437] flex items-center justify-between">
              <span>💡 Puncak beban masak:</span>
              <span className="font-black text-[#701604]">
                {analytics.peakHour !== null
                  ? `Pukul ${String(analytics.peakHour).padStart(2, '0')}:00 WIB (${analytics.hourly[analytics.peakHour]} Order, ${analytics.hourlyPorsi[analytics.peakHour]} Porsi)`
                  : 'Belum ada data'}
              </span>
            </div>
          </div>
        </div>

        {/* ── Bottom Section: Best Sellers Demand & Outlet Breakdown ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Kolom 1 & 2: Menu Terlaris (2 Kolom Lebar) */}
          <div className="lg:col-span-2 bg-white border border-[#d9c2b2]/60 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-black text-base text-[#701604] flex items-center gap-2">
                  <span>🍳</span> Menu & Item Terjual ({analytics.bestSellers.length})
                </h2>
                <p className="text-xs font-semibold text-[#544437]/70">Daftar item untuk perhitungan kebutuhan bahan baku</p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-[#544437]/50 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari nama menu..."
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-[#faf2e9] border border-[#d9c2b2] rounded-xl text-xs font-bold text-[#1e1b15] outline-none focus:ring-2 focus:ring-[#f29744]"
                />
              </div>
            </div>

            {/* List Menu Items */}
            <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
              {filteredBestSellers.map((item, index) => {
                const percentage = maxItemQty > 0 ? (item.qty / maxItemQty) * 100 : 0;
                const totalPorsiPercent = analytics.totalItemsSold > 0 ? (item.qty / analytics.totalItemsSold) * 100 : 0;
                const isTop3 = index < 3 && !menuSearch;

                return (
                  <div
                    key={item.name}
                    className="p-3.5 bg-[#faf2e9]/40 hover:bg-[#faf2e9] rounded-xl border border-[#d9c2b2]/30 transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                            isTop3
                              ? 'bg-[#f29744] text-white shadow-xs'
                              : 'bg-[#d9c2b2]/50 text-[#544437]'
                          }`}
                        >
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-[#1e1b15] truncate">{item.name}</p>
                          <p className="text-[10px] font-bold text-[#544437]/70">
                            {formatRupiah(item.revenue)} • {totalPorsiPercent.toFixed(1)}% total dapur
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="inline-block bg-[#ffdcc2] text-[#701604] border border-[#f29744]/40 px-2.5 py-1 rounded-lg text-xs font-black">
                          {item.qty.toLocaleString('id-ID')} Porsi
                        </span>
                      </div>
                    </div>

                    {/* Progress relative to #1 best seller */}
                    <div className="w-full bg-[#d9c2b2]/20 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-[#f29744] h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(percentage, 3)}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              {filteredBestSellers.length === 0 && (
                <div className="text-center py-12 text-xs font-bold text-[#544437]/50 italic">
                  Tidak ada menu yang sesuai dengan pencarian.
                </div>
              )}
            </div>
          </div>

          {/* Kolom 3: Performa Penjualan per Outlet */}
          <div className="bg-white border border-[#d9c2b2]/60 rounded-2xl p-5 shadow-xs space-y-4 flex flex-col">
            <div>
              <h2 className="font-black text-base text-[#701604] flex items-center gap-2">
                <span>🏢</span> Volume per Outlet
              </h2>
              <p className="text-xs font-semibold text-[#544437]/70">Peringkat konsumsi porsi per outlet</p>
            </div>

            {/* Separasi / Tab Kategori Outlet */}
            <div className="flex items-center bg-[#faf2e9] p-1 rounded-xl border border-[#d9c2b2]/50 text-xs font-black">
              <button
                onClick={() => setOutletCategoryTab('all')}
                className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                  outletCategoryTab === 'all'
                    ? 'bg-white text-[#701604] shadow-xs'
                    : 'text-[#544437] hover:text-[#701604]'
                }`}
              >
                Semua ({analytics.outletVolumeList.length})
              </button>
              <button
                onClick={() => setOutletCategoryTab('internal')}
                className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                  outletCategoryTab === 'internal'
                    ? 'bg-[#f29744] text-white shadow-xs'
                    : 'text-[#544437] hover:text-[#701604]'
                }`}
              >
                🏢 Internal
              </button>
              <button
                onClick={() => setOutletCategoryTab('mitra')}
                className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                  outletCategoryTab === 'mitra'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-[#544437] hover:text-[#701604]'
                }`}
              >
                🤝 Mitra
              </button>
            </div>

            {/* Search Outlet */}
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 text-[#544437]/50 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cari nama outlet..."
                value={outletSearch}
                onChange={(e) => setOutletSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-[#faf2e9] border border-[#d9c2b2] rounded-xl text-xs font-bold text-[#1e1b15] outline-none focus:ring-2 focus:ring-[#f29744]"
              />
            </div>

            {/* List Outlets */}
            <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1 flex-1">
              {filteredOutletVolumes.map((outlet, idx) => {
                const isMitra = outlet.category === 'mitra';

                return (
                  <div
                    key={outlet.outletId}
                    className="p-3 bg-[#faf2e9]/50 hover:bg-[#faf2e9] rounded-xl border border-[#d9c2b2]/30 flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-[#d9c2b2]/50 text-[#544437] flex items-center justify-center text-[10px] font-black shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-black text-[#1e1b15] truncate">{outlet.outletName}</p>
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.2 rounded shrink-0 uppercase ${
                              isMitra
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : 'bg-[#ffdcc2] text-[#701604] border border-[#f29744]/30'
                            }`}
                          >
                            {isMitra ? 'Mitra' : 'Internal'}
                          </span>
                        </div>
                        <p className="text-[10px] font-bold text-[#544437]/70 mt-0.5">
                          {outlet.totalOrders} Order • {formatRupiah(outlet.totalRevenue)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-[#701604]">
                        {outlet.itemsSold.toLocaleString('id-ID')} <span className="text-[10px] text-[#544437] font-bold">porsi</span>
                      </span>
                    </div>
                  </div>
                );
              })}

              {filteredOutletVolumes.length === 0 && (
                <div className="text-center py-8 text-xs font-bold text-[#544437]/50 italic">
                  Tidak ada outlet ditemukan.
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
