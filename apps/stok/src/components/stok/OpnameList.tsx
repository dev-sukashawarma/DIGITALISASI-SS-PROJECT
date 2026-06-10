'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Opname } from '@/types/stok';

const TIPE_LABEL: Record<string, string> = {
  harian: 'Harian 📅',
  mingguan: 'Mingguan 📆',
  ad_hoc: 'Ad Hoc ⚡',
};

const FILTER_LABELS: Record<string, string> = {
  all: 'Semua',
  finalized: 'Selesai 🟢',
  draft: 'Draft 📝',
};

export function OpnameList({ items }: { items: Opname[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  const draftCount = useMemo(() => items.filter((o) => o.status === 'draft').length, [items]);
  const finalToday = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return items.filter((o) => o.status === 'finalized' && o.tanggal === todayStr).length;
  }, [items]);

  // Format Date to Localized String
  const formatOpnameDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  // Filter items based on search and status
  const filteredItems = useMemo(() => {
    return items.filter((o) => {
      const formattedDate = formatOpnameDate(o.tanggal);
      const matchesSearch =
        o.tanggal.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.tipe.toLowerCase().includes(searchTerm.toLowerCase()) ||
        formattedDate.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.notes || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.outlet_staff?.name || '').toLowerCase().includes(searchTerm.toLowerCase());

      let matchesFilter = false;
      if (activeFilter === 'all') {
        matchesFilter = true;
      } else if (activeFilter === 'finalized') {
        matchesFilter = o.status === 'finalized';
      } else if (activeFilter === 'draft') {
        matchesFilter = o.status === 'draft';
      }

      return matchesSearch && matchesFilter;
    });
  }, [items, searchTerm, activeFilter]);

  return (
    <div className="space-y-6">
      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-white border border-[#701604]/10 rounded-2xl shadow-[0px_4px_12px_rgba(112,22,4,0.02)] flex flex-col justify-center">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#701604]/50">
            Selesai Hari Ini
          </span>
          <span className="text-xl font-extrabold text-[#0a7d2c] mt-1">
            {finalToday} <span className="text-xs font-bold text-gray-400">laporan</span>
          </span>
        </div>
        <div className="p-4 bg-white border border-[#701604]/10 rounded-2xl shadow-[0px_4px_12px_rgba(112,22,4,0.02)] flex flex-col justify-center">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#701604]/50">
            Draft Tertunda
          </span>
          <span className="text-xl font-extrabold text-[#f29744] mt-1">
            {draftCount} <span className="text-xs font-bold text-gray-400">draft</span>
          </span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            className="w-full px-4.5 py-3.5 pl-11 rounded-xl border border-[#701604]/10 bg-white focus:outline-none focus:ring-2 focus:ring-[#f29744] focus:border-[#f29744] text-xs font-medium text-suka-ink shadow-sm"
            placeholder="Cari berdasarkan tanggal, tipe, atau catatan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-base">🔍</span>
        </div>

        {/* Status Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-thin">
          {Object.entries(FILTER_LABELS).map(([key, label]) => {
            const isActive = activeFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveFilter(key)}
                className={`px-4 py-2 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition-all border whitespace-nowrap shadow-sm ${
                  isActive
                    ? 'bg-[#701604] border-[#701604] text-white'
                    : 'bg-white border-[#701604]/10 text-[#701604]/70 hover:bg-[#faf2e9]/50'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Opname List Cards */}
      <div className="space-y-3">
        {filteredItems.map((o) => {
          const isFinalized = o.status === 'finalized';
          const formattedDate = formatOpnameDate(o.tanggal);
          
          const totalCounted = o.opname_item?.filter((item) => item.qty_fisik !== null).length || 0;
          const discrepancyCount = o.opname_item?.filter((item) => item.qty_fisik !== null && item.selisih !== 0).length || 0;
          const flaggedCount = o.opname_item?.filter((item) => item.qty_fisik !== null && item.flagged).length || 0;

          return (
            <Link key={o.id} href={`/stok/opname/${o.id}`}>
              <div className={`bg-white rounded-2xl border p-5 flex justify-between items-center shadow-[0px_4px_12px_rgba(112,22,4,0.02)] transition-all duration-200 cursor-pointer mb-3 ${
                isFinalized 
                  ? 'border-[#701604]/10 hover:border-[#0a7d2c]/30 hover:scale-[1.005]' 
                  : 'border-[#f29744]/30 bg-white hover:border-[#f29744] hover:scale-[1.005]'
              }`}>
                {/* Left Section */}
                <div className="space-y-2.5 min-w-0 flex-1 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-extrabold uppercase tracking-wide text-[#701604]/60 bg-[#faf2e9] px-2 py-0.5 rounded border border-[#701604]/5">
                      {TIPE_LABEL[o.tipe] || o.tipe}
                    </span>
                  </div>
                  
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-[#701604] text-sm tracking-wide uppercase">
                      {formattedDate}
                    </h4>

                    {/* Metadata Info Row */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-gray-500 font-bold mt-1">
                      {o.outlet_staff?.name && (
                        <span className="flex items-center gap-1 bg-[#faf2e9] text-[#701604] px-2 py-0.5 rounded border border-[#701604]/5">
                          👤 {o.outlet_staff.name}
                        </span>
                      )}
                      
                      {o.opname_item && o.opname_item.length > 0 ? (
                        <>
                          <span className="flex items-center gap-1 text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                            📦 {totalCounted} Bahan
                          </span>
                          {discrepancyCount > 0 && (
                            <span className={`flex items-center gap-1 px-2 py-0.5 rounded border ${
                              flaggedCount > 0
                                ? 'bg-red-50 text-red-700 border-red-100'
                                : 'bg-amber-50 text-amber-700 border-amber-100'
                            }`}>
                              ⚖️ {discrepancyCount} Selisih
                              {flaggedCount > 0 && (
                                <span className="ml-1 px-1 py-0.2 text-[8px] bg-red-600 text-white font-extrabold rounded-full">
                                  {flaggedCount} Kritis
                                </span>
                              )}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-gray-400 font-medium italic">Belum ada item terhitung</span>
                      )}
                    </div>
                  </div>

                  {o.notes && (
                    <p className="text-[10px] text-gray-500 font-medium truncate mt-1 max-w-md">
                      📝 {o.notes}
                    </p>
                  )}
                </div>

                {/* Right Section: Status Badge */}
                <div className="flex-shrink-0">
                  <span className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider border shadow-sm ${
                    isFinalized
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-orange-50 text-[#f29744] border-orange-200'
                  }`}>
                    {isFinalized ? 'Selesai' : 'Draft'}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}

        {filteredItems.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-[#701604]/10 p-8 shadow-sm">
            <span className="text-3xl">📭</span>
            <p className="font-bold text-sm text-[#701604]/80 mt-2">Belum Ada Catatan Opname</p>
            <p className="text-xs text-gray-500 mt-1">Tidak ada opname yang cocok dengan pencarian atau filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
