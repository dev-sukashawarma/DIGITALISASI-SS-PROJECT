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
    <div className="space-y-5">
      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-white border border-[#d9c2b2]/45 rounded-2xl shadow-[0px_4px_12px_rgba(144,77,0,0.03)] flex flex-col justify-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#544437]/50">
            Selesai Hari Ini
          </span>
          <span className="text-lg font-black text-[#0a7d2c] mt-1">
            {finalToday} <span className="text-xs font-bold text-[#544437]/40">laporan</span>
          </span>
        </div>
        <div className="p-4 bg-white border border-[#d9c2b2]/45 rounded-2xl shadow-[0px_4px_12px_rgba(144,77,0,0.03)] flex flex-col justify-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#544437]/50">
            Draft Tertunda
          </span>
          <span className="text-lg font-black text-[#f29744] mt-1">
            {draftCount} <span className="text-xs font-bold text-[#544437]/40">draft</span>
          </span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            className="w-full px-4 py-2.5 pl-9 rounded-xl border border-[#d9c2b2]/40 bg-white focus:outline-none focus:ring-1 focus:ring-[#f29744] focus:border-[#f29744] text-xs text-[#1e1b15] placeholder-[#544437]/45 font-medium transition-all shadow-sm"
            placeholder="Cari berdasarkan tanggal, tipe, staf, atau catatan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#544437]/40 text-xs">🔍</span>
        </div>

        {/* Status Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
          {Object.entries(FILTER_LABELS).map(([key, label]) => {
            const isActive = activeFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border whitespace-nowrap cursor-pointer shadow-sm ${
                  isActive
                    ? 'bg-[#701604] border-[#701604] text-white shadow-sm'
                    : 'bg-white border-[#d9c2b2]/40 text-[#544437]/80 hover:bg-[#fff8f1]/50'
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
              <div className="bg-white rounded-2xl border border-[#d9c2b2]/45 p-4 flex justify-between items-center shadow-[0px_4px_12px_rgba(144,77,0,0.03)] hover:border-[#f29744]/45 hover:shadow-md active:scale-[0.98] transition-all duration-200 cursor-pointer mb-2.5">
                {/* Left Section */}
                <div className="space-y-2 min-w-0 flex-1 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] font-bold uppercase tracking-wider text-[#701604]/60 bg-[#faf2e9] px-2 py-0.5 rounded border border-[#d9c2b2]/30">
                      {TIPE_LABEL[o.tipe] || o.tipe}
                    </span>
                  </div>
                  
                  <div className="space-y-1">
                    <h4 className="font-bold text-[#1e1b15] text-xs uppercase tracking-wide">
                      {formattedDate}
                    </h4>

                    {/* Metadata Info Row */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] text-[#544437]/65 font-bold mt-1">
                      {o.outlet_staff?.name && (
                        <span className="flex items-center gap-1 bg-[#faf2e9] text-[#701604] px-2 py-0.5 rounded border border-[#d9c2b2]/30">
                          👤 {o.outlet_staff.name}
                        </span>
                      )}
                      
                      {o.opname_item && o.opname_item.length > 0 ? (
                        <>
                          <span className="flex items-center gap-1 text-[#544437]/70 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
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
                                <span className="ml-0.5 px-1.5 py-0.2 text-[7px] bg-[#ba1a1a] text-white font-extrabold rounded-full">
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
                    <p className="text-[9px] text-[#544437]/60 font-medium truncate mt-1 max-w-md">
                      📝 {o.notes}
                    </p>
                  )}
                </div>

                {/* Right Section: Status Badge */}
                <div className="flex-shrink-0 pl-2">
                  {isFinalized ? (
                    <span className="bg-[#93f997]/15 text-[#006e24] border border-[#93f997]/25 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider">
                      Selesai
                    </span>
                  ) : (
                    <span className="bg-[#ffdcc2] text-[#904d00] border border-[#ffdcc2]/10 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider">
                      Draft
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}

        {filteredItems.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-[#d9c2b2]/40 p-8 shadow-[0px_4px_12px_rgba(144,77,0,0.03)]">
            <span className="text-3xl">📭</span>
            <p className="font-bold text-sm text-[#701604]/80 mt-2">Belum Ada Catatan Opname</p>
            <p className="text-xs text-gray-500 mt-1">Tidak ada opname yang cocok dengan pencarian atau filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
