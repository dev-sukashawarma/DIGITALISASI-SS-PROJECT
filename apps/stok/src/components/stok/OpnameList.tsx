'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Opname } from '@/types/stok';
import { Search, Calendar, User, Package, Scale, FileText, Clock, AlertTriangle, Inbox } from 'lucide-react';

const TIPE_LABEL: Record<string, string> = {
  harian: 'Harian',
  mingguan: 'Mingguan',
  ad_hoc: 'Ad Hoc',
};

const FILTER_LABELS: Record<string, string> = {
  all: 'Semua',
  finalized: 'Selesai',
  pending_approval: 'Menunggu Leader',
  rejected: 'Ditolak',
  draft: 'Draft',
};

export function OpnameList({ items }: { items: Opname[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  const draftCount = useMemo(() => items.filter((o) => o.status === 'draft').length, [items]);
  const pendingCount = useMemo(() => items.filter((o) => o.status === 'pending_approval').length, [items]);
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
      } else if (activeFilter === 'pending_approval') {
        matchesFilter = o.status === 'pending_approval';
      } else if (activeFilter === 'rejected') {
        matchesFilter = o.status === 'rejected';
      }

      return matchesSearch && matchesFilter;
    });
  }, [items, searchTerm, activeFilter]);

  return (
    <div className="space-y-5">
      {/* Stats Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 bg-[#93f997]/15 border border-[#93f997]/30 rounded-2xl shadow-sm flex flex-col justify-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#006e24]">
            Selesai Hari Ini
          </span>
          <span className="text-lg font-black text-[#006e24] mt-1">
            {finalToday} <span className="text-xs font-bold opacity-75">laporan</span>
          </span>
        </div>
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl shadow-sm flex flex-col justify-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
            Menunggu Leader
          </span>
          <span className="text-lg font-black text-amber-700 mt-1">
            {pendingCount} <span className="text-xs font-bold text-amber-600/70">opname</span>
          </span>
        </div>
        <div className="p-3 bg-[#ffdcc2]/35 border border-[#f29744]/35 rounded-2xl shadow-sm flex flex-col justify-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#904d00]">
            Draft Tertunda
          </span>
          <span className="text-lg font-black text-[#904d00] mt-1">
            {draftCount} <span className="text-xs font-bold opacity-75">draft</span>
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#544437]/50" />
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
                    <span className="inline-flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-[#701604] bg-[#faf2e9] px-2 py-0.5 rounded border border-[#d9c2b2]/30">
                      <Calendar className="w-2.5 h-2.5" />
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
                          <User className="w-2.5 h-2.5" /> {o.outlet_staff.name}
                        </span>
                      )}
                      
                      {o.opname_item && o.opname_item.length > 0 ? (
                        <>
                          <span className="flex items-center gap-1 text-[#544437]/70 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                            <Package className="w-2.5 h-2.5" /> {totalCounted} Bahan
                          </span>
                          {discrepancyCount > 0 && (
                            <span className={`flex items-center gap-1 px-2 py-0.5 rounded border ${
                              flaggedCount > 0
                                ? 'bg-red-50 text-red-700 border-red-100'
                                : 'bg-amber-50 text-amber-700 border-amber-100'
                            }`}>
                              <Scale className="w-2.5 h-2.5" /> {discrepancyCount} Selisih
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
                    <p className="text-[9px] text-[#544437]/60 font-medium truncate mt-1 max-w-md flex items-center gap-1">
                      <FileText className="w-2.5 h-2.5 shrink-0" /> {o.notes}
                    </p>
                  )}
                </div>

                {/* Right Section: Status Badge */}
                <div className="flex-shrink-0 pl-2">
                  {o.status === 'finalized' ? (
                    <span className="bg-[#93f997]/15 text-[#006e24] border border-[#93f997]/25 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider">
                      Selesai
                    </span>
                  ) : o.status === 'pending_approval' ? (
                    <span className="bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider animate-pulse flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" /> Menunggu
                    </span>
                  ) : o.status === 'rejected' ? (
                    <span className="bg-red-50 text-[#ba1a1a] border border-red-200 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                      <AlertTriangle className="w-2.5 h-2.5" /> Ditolak
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
          <div className="flex flex-col items-center justify-center py-12 bg-white rounded-2xl border border-[#d9c2b2]/40 p-8 shadow-[0px_4px_12px_rgba(144,77,0,0.03)]">
            <div className="w-12 h-12 bg-[#faf2e9] rounded-2xl flex items-center justify-center mb-3">
              <Inbox className="w-6 h-6 text-[#701604]/50" />
            </div>
            <p className="font-bold text-sm text-[#701604]">Belum Ada Catatan Opname</p>
            <p className="text-xs text-gray-500 mt-1">Tidak ada opname yang cocok dengan pencarian atau filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
