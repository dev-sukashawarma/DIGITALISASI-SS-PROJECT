'use client';

import React, { useState, useMemo } from 'react';
import {
  Layers,
  ChevronRight,
  ArrowLeft,
  Store,
  Building2,
  Trophy,
  BarChart3,
  Search,
  Flame,
  Percent,
  Sparkles,
  TrendingUp
} from 'lucide-react';

export interface OutletOmzetInfo {
  id: string;
  name: string;
  omzet: number;
}

export interface ZoneOmzetInfo {
  zoneName: string;
  outlets: OutletOmzetInfo[];
  totalOmzet: number;
}

const formatRupiah = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

interface ZonePerformanceTableProps {
  zones: ZoneOmzetInfo[];
}

export default function ZonePerformanceTable({ zones }: ZonePerformanceTableProps) {
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Calculate Aggregates
  const grandTotalOmzet = useMemo(() => zones.reduce((sum, z) => sum + z.totalOmzet, 0), [zones]);
  const totalOutletsCount = useMemo(() => zones.reduce((sum, z) => sum + z.outlets.length, 0), [zones]);
  const sortedZones = useMemo(() => [...zones].sort((a, b) => b.totalOmzet - a.totalOmzet), [zones]);

  const topZone = sortedZones.length > 0 ? sortedZones[0] : null;
  const avgZoneOmzet = zones.length > 0 ? Math.round(grandTotalOmzet / zones.length) : 0;

  // Filtered zones for Level 1 search
  const filteredZones = useMemo(() => {
    if (!searchQuery.trim()) return sortedZones;
    const q = searchQuery.toLowerCase();
    return sortedZones.filter(z =>
      z.zoneName.toLowerCase().includes(q) ||
      z.outlets.some(o => o.name.toLowerCase().includes(q))
    );
  }, [sortedZones, searchQuery]);

  const activeZoneData = useMemo(() => zones.find(z => z.zoneName === selectedZone), [zones, selectedZone]);

  // Filtered outlets for Level 2 search
  const filteredOutlets = useMemo(() => {
    if (!activeZoneData) return [];
    const sorted = [...activeZoneData.outlets].sort((a, b) => b.omzet - a.omzet);
    if (!searchQuery.trim()) return sorted;
    const q = searchQuery.toLowerCase();
    return sorted.filter(o => o.name.toLowerCase().includes(q));
  }, [activeZoneData, searchQuery]);

  return (
    <div className="bg-white p-6 sm:p-7 rounded-3xl shadow-[0_4px_24px_rgba(44,24,16,0.04)] border border-suka-brown/10 space-y-6">
      
      {/* 🌟 Top Summary KPI Bar for Zone Performance */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* KPI 1: Total Region Revenue */}
        <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent p-4 rounded-2xl border border-amber-500/20 relative overflow-hidden group transition-all duration-300 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-900/70">Total Region Omzet</span>
            <div className="p-2 bg-amber-500/15 text-amber-700 rounded-xl">
              <Trophy size={18} />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-suka-brown mt-2">
            {formatRupiah(grandTotalOmzet)}
          </p>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] font-bold text-amber-800/80">
            <span className="px-2 py-0.5 bg-amber-500/15 rounded-full font-black text-amber-900">{zones.length} Zona</span>
            <span>• {totalOutletsCount} Cabang Aktif</span>
          </div>
        </div>

        {/* KPI 2: Top Performing Zone */}
        <div className="bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent p-4 rounded-2xl border border-emerald-500/20 relative overflow-hidden group transition-all duration-300 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-900/70">Zona Tertinggi (Rank #1)</span>
            <div className="p-2 bg-emerald-500/15 text-emerald-700 rounded-xl">
              <Flame size={18} />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-suka-brown mt-2 truncate">
            {topZone ? topZone.zoneName : '-'}
          </p>
          <div className="flex items-center justify-between mt-2 text-[11px] font-bold text-emerald-800/80">
            <span>{topZone ? formatRupiah(topZone.totalOmzet) : 'Rp 0'}</span>
            {topZone && grandTotalOmzet > 0 && (
              <span className="px-2 py-0.5 bg-emerald-500/15 rounded-full text-emerald-900 font-black">
                {((topZone.totalOmzet / grandTotalOmzet) * 100).toFixed(1)}% Kontribusi
              </span>
            )}
          </div>
        </div>

        {/* KPI 3: Average Omzet per Zone */}
        <div className="bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-transparent p-4 rounded-2xl border border-blue-500/20 relative overflow-hidden group transition-all duration-300 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-blue-900/70">Rata-rata / Zona</span>
            <div className="p-2 bg-blue-500/15 text-blue-700 rounded-xl">
              <BarChart3 size={18} />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-suka-brown mt-2">
            {formatRupiah(avgZoneOmzet)}
          </p>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] font-bold text-blue-800/80">
            <Sparkles size={12} className="text-blue-600" />
            <span>Tolok ukur rata-rata wilayah</span>
          </div>
        </div>

      </div>

      {/* 🛠️ Header Title & Interactive Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pt-2 pb-4 border-b border-suka-brown/10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-suka-orange text-white rounded-2xl shadow-sm">
            <Layers size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-suka-brown">Performa Zona AM</h3>
              {selectedZone !== 'all' && (
                <span className="px-2.5 py-0.5 bg-suka-orange/10 text-suka-orange rounded-full text-xs font-black">
                  Zona: {selectedZone}
                </span>
              )}
            </div>
            <p className="text-xs text-suka-gray-400 font-medium">Monitoring Omzet Aktual & Kontribusi Per-Area Manager</p>
          </div>
        </div>

        {/* Action Controls: Search & Zone Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto">
          
          {/* Quick Search */}
          <div className="relative flex-1 sm:w-56">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-suka-gray-400" />
            <input
              type="text"
              placeholder={selectedZone === 'all' ? "Cari Zona atau Outlet..." : "Cari Outlet..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs font-bold bg-suka-brown/[0.03] text-suka-brown placeholder-suka-gray-400 border border-suka-brown/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-suka-orange/30 transition-all"
            />
          </div>

          {/* Reset / Back Button */}
          {selectedZone !== 'all' && (
            <button
              onClick={() => {
                setSelectedZone('all');
                setSearchQuery('');
              }}
              className="px-3.5 py-2 text-xs font-black text-suka-brown bg-suka-brown/5 hover:bg-suka-brown/10 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
            >
              <ArrowLeft size={14} /> Semua Zona
            </button>
          )}

          {/* Zone Selector Dropdown */}
          <select
            value={selectedZone}
            onChange={(e) => {
              setSelectedZone(e.target.value);
              setSearchQuery('');
            }}
            className="px-3.5 py-2 text-xs font-black bg-white text-suka-brown border border-suka-brown/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-suka-orange/30 cursor-pointer shadow-sm hover:border-suka-orange/50 transition-all"
          >
            <option value="all">Semua Zona ({zones.length} Area)</option>
            {zones.map((z) => (
              <option key={z.zoneName} value={z.zoneName}>
                Zona {z.zoneName} ({z.outlets.length} Outlet)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 📊 LEVEL 1: Macro View - All Zones Table */}
      {selectedZone === 'all' ? (
        <div className="overflow-x-auto rounded-2xl border border-suka-brown/10 shadow-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-suka-brown/[0.03] border-b border-suka-brown/10 text-[11px] font-black text-suka-brown/60 uppercase tracking-wider">
                <th className="py-3.5 px-4 text-center w-14">Peringkat</th>
                <th className="py-3.5 px-4">Zona / Area Manager</th>
                <th className="py-3.5 px-4 text-center">Jumlah Cabang</th>
                <th className="py-3.5 px-4">Porsi Kontribusi</th>
                <th className="py-3.5 px-4 text-right">Total Omzet</th>
                <th className="py-3.5 px-4 text-center w-24">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-suka-brown/5 text-sm font-semibold text-suka-brown bg-white">
              {filteredZones.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-suka-gray-400 text-xs">
                    Pencarian tidak menemukan data zona.
                  </td>
                </tr>
              ) : (
                filteredZones.map((z, idx) => {
                  const sharePct = grandTotalOmzet > 0 ? (z.totalOmzet / grandTotalOmzet) * 100 : 0;
                  const rank = sortedZones.findIndex(sz => sz.zoneName === z.zoneName) + 1;

                  // Rank Badge styling
                  let rankBadgeClass = "bg-suka-brown/5 text-suka-brown/70 border-suka-brown/10";
                  if (rank === 1) rankBadgeClass = "bg-amber-100 text-amber-900 border-amber-300 font-black shadow-xs";
                  if (rank === 2) rankBadgeClass = "bg-slate-100 text-slate-800 border-slate-300 font-black";
                  if (rank === 3) rankBadgeClass = "bg-orange-100 text-orange-900 border-orange-300 font-black";

                  return (
                    <tr
                      key={z.zoneName}
                      onClick={() => {
                        setSelectedZone(z.zoneName);
                        setSearchQuery('');
                      }}
                      className="hover:bg-suka-orange/[0.04] cursor-pointer transition-all duration-150 group"
                    >
                      {/* Rank Badge */}
                      <td className="py-4 px-4 text-center">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs border ${rankBadgeClass}`}>
                          #{rank}
                        </span>
                      </td>

                      {/* Zone Name */}
                      <td className="py-4 px-4 font-extrabold flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-suka-orange/10 text-suka-orange group-hover:bg-suka-orange group-hover:text-white transition-colors">
                          <Building2 size={16} />
                        </div>
                        <span className="group-hover:text-suka-orange transition-colors">Zona {z.zoneName}</span>
                      </td>

                      {/* Branch Count */}
                      <td className="py-4 px-4 text-center">
                        <span className="px-3 py-1 bg-suka-brown/5 rounded-full text-xs font-bold text-suka-brown">
                          {z.outlets.length} Outlet
                        </span>
                      </td>

                      {/* Contribution Progress Bar */}
                      <td className="py-4 px-4 min-w-[140px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-suka-brown/10 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-suka-orange to-amber-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(sharePct, 100)}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-black text-suka-brown/70 min-w-[38px] text-right">
                            {sharePct.toFixed(1)}%
                          </span>
                        </div>
                      </td>

                      {/* Omzet Value */}
                      <td className="py-4 px-4 text-right font-black text-suka-brown text-base">
                        {formatRupiah(z.totalOmzet)}
                      </td>

                      {/* Action */}
                      <td className="py-4 px-4 text-center">
                        <span className="px-2.5 py-1 text-xs font-bold rounded-lg text-suka-gray-400 group-hover:bg-suka-orange group-hover:text-white inline-flex items-center gap-1 transition-all">
                          Detail <ChevronRight size={14} />
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Footer Summary */}
            {filteredZones.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-suka-brown/15 bg-suka-brown/[0.03] text-sm font-black text-suka-brown">
                  <td colSpan={2} className="py-4 px-4 uppercase tracking-wider text-xs font-black">
                    Total Region ({zones.length} Zona)
                  </td>
                  <td className="py-4 px-4 text-center text-xs">{totalOutletsCount} Outlet</td>
                  <td className="py-4 px-4 text-xs text-suka-brown/60">100% Total Kontribusi</td>
                  <td className="py-4 px-4 text-right text-lg font-black text-suka-orange">
                    {formatRupiah(grandTotalOmzet)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      ) : (
        /* 🔍 LEVEL 2: Micro View - Selected Zone Outlets Table */
        <div className="space-y-3">
          
          {/* Breadcrumb Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-suka-orange/10 via-amber-500/10 to-transparent border border-suka-orange/20 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className="flex items-center gap-2 text-xs font-black text-suka-brown">
              <Building2 size={16} className="text-suka-orange" />
              <span>Detail Cabang dalam Zona:</span>
              <span className="px-2.5 py-1 bg-suka-orange text-white rounded-lg uppercase tracking-wider text-[11px]">
                {selectedZone}
              </span>
            </div>
            <div className="text-xs font-bold text-suka-brown/70 flex items-center gap-2">
              <span>Total Omzet Zona Ini:</span>
              <span className="font-black text-suka-orange text-sm">
                {formatRupiah(activeZoneData?.totalOmzet || 0)}
              </span>
            </div>
          </div>

          {/* Micro Outlets Table */}
          <div className="overflow-x-auto rounded-2xl border border-suka-brown/10 shadow-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-suka-brown/[0.03] border-b border-suka-brown/10 text-[11px] font-black text-suka-brown/60 uppercase tracking-wider">
                  <th className="py-3.5 px-4 text-center w-14">Rank</th>
                  <th className="py-3.5 px-4">Nama Outlet / Cabang</th>
                  <th className="py-3.5 px-4">Porsi dalam Zona</th>
                  <th className="py-3.5 px-4 text-right">Total Omzet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-suka-brown/5 text-sm font-semibold text-suka-brown bg-white">
                {filteredOutlets.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-suka-gray-400 text-xs">
                      Tidak ada outlet yang cocok dengan kueri pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredOutlets.map((outlet, idx) => {
                    const zoneTotal = activeZoneData?.totalOmzet || 1;
                    const outletShare = zoneTotal > 0 ? (outlet.omzet / zoneTotal) * 100 : 0;

                    return (
                      <tr key={outlet.id} className="hover:bg-suka-brown/[0.02] transition-colors">
                        <td className="py-3.5 px-4 text-center text-xs font-black text-suka-brown/50">
                          #{idx + 1}
                        </td>
                        <td className="py-3.5 px-4 font-extrabold flex items-center gap-2.5">
                          <Store size={16} className="text-suka-brown/40" />
                          <span>{outlet.name}</span>
                        </td>
                        <td className="py-3.5 px-4 min-w-[140px]">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-suka-brown/10 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-suka-orange h-full rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(outletShare, 100)}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-black text-suka-brown/70 min-w-[38px] text-right">
                              {outletShare.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-suka-brown text-base">
                          {formatRupiah(outlet.omzet)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {activeZoneData && activeZoneData.outlets.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-suka-brown/15 bg-suka-brown/[0.03] text-sm font-black text-suka-brown">
                    <td colSpan={2} className="py-4 px-4 uppercase tracking-wider text-xs">
                      Total Zona {selectedZone} ({activeZoneData.outlets.length} Outlet)
                    </td>
                    <td className="py-4 px-4 text-xs text-suka-brown/60">100% Kontribusi Zona</td>
                    <td className="py-4 px-4 text-right text-lg font-black text-suka-orange">
                      {formatRupiah(activeZoneData.totalOmzet)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
