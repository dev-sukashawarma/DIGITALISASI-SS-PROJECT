'use client';

import React, { useState, useMemo } from 'react';
import type { MonitoringItem } from '@/lib/types/monitoring';

interface CrewListProps {
  items: MonitoringItem[];
  onItemClick: (item: MonitoringItem) => void;
}

type SortBy = 'status' | 'name';

const getStorageLocation = (category: string, name: string) => {
  const nameLower = name.toLowerCase();
  const catLower = (category || '').toLowerCase();
  if (nameLower.includes('daging') || nameLower.includes('ayam') || catLower === 'protein') {
    return 'Frozen Storage';
  }
  if (nameLower.includes('saus') || nameLower.includes('garlic') || catLower === 'sauce' || catLower === 'chilled') {
    return 'Chilled Storage';
  }
  if (nameLower.includes('gas') || nameLower.includes('lpg') || nameLower.includes('utility')) {
    return 'Utility Area';
  }
  return 'Dry Storage';
};

export function CrewList({ items, onItemClick }: CrewListProps) {
  const [sortBy, setSortBy] = useState<SortBy>('status');
  const [filterStatus, setFilterStatus] = useState<'all' | 'below' | 'flagged'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredAndSorted = useMemo(() => {
    let result = [...items];

    // Filter by status
    if (filterStatus === 'below') {
      result = result.filter((item) => item.status === 'below');
    } else if (filterStatus === 'flagged') {
      result = result.filter((item) => item.is_flagged);
    }

    // Filter by name (case-insensitive search specifically for ingredient/material names)
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      result = result.filter((item) => item.item_name.toLowerCase().includes(term));
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'status') {
        const statusOrder = { below: 0, warning: 1, ok: 2 };
        const aOrder = statusOrder[a.status];
        const bOrder = statusOrder[b.status];
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.item_name.localeCompare(b.item_name);
      } else {
        return a.item_name.localeCompare(b.item_name);
      }
    });

    return result;
  }, [items, sortBy, filterStatus, searchTerm]);

  const belowCount = items.filter((item) => item.status === 'below').length;
  const flaggedCount = items.filter((item) => item.is_flagged).length;
  const okCount = items.filter((item) => item.status === 'ok' && !item.is_flagged).length;

  return (
    <div className="space-y-4">
      {/* Summary counts */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setFilterStatus(filterStatus === 'below' ? 'all' : 'below')}
          className={`p-3.5 rounded-xl border text-center transition-all active:scale-95 ${
            filterStatus === 'below'
              ? 'bg-[#ffdad6] border-[#ba1a1a] text-[#ba1a1a]'
              : 'bg-white border-[#d9c2b2]/40 text-[#544437] hover:border-[#ba1a1a]/30 shadow-sm'
          }`}
        >
          <div className="text-2xl font-black">{belowCount}</div>
          <div className="text-[10px] font-bold uppercase tracking-wider opacity-85">Kritis</div>
        </button>

        <button
          onClick={() => setFilterStatus(filterStatus === 'flagged' ? 'all' : 'flagged')}
          className={`p-3.5 rounded-xl border text-center transition-all active:scale-95 ${
            filterStatus === 'flagged'
              ? 'bg-[#ffdcc2] border-[#f29744] text-[#904d00]'
              : 'bg-white border-[#d9c2b2]/40 text-[#544437] hover:border-[#f29744]/30 shadow-sm'
          }`}
        >
          <div className="text-2xl font-black">{flaggedCount}</div>
          <div className="text-[10px] font-bold uppercase tracking-wider opacity-85">Selisih</div>
        </button>

        <div className="p-3.5 rounded-xl border border-[#93f997]/25 bg-[#93f997]/10 text-center text-[#006e24] shadow-sm">
          <div className="text-2xl font-black">{okCount}</div>
          <div className="text-[10px] font-bold uppercase tracking-wider opacity-85">Aman</div>
        </div>
      </div>

      {/* Search Input Box specifically for ingredient/material name */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#544437]/60">🔍</span>
        <input
          type="text"
          placeholder="Cari nama bahan..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-8 py-2.5 bg-white border border-[#d9c2b2]/40 rounded-xl text-sm text-[#1e1b15] placeholder-[#544437]/50 focus:outline-none focus:ring-1 focus:ring-[#f29744] focus:border-[#f29744] transition-all shadow-sm"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#544437]/50 hover:text-[#ba1a1a] p-1"
            title="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* Sort options */}
      <div className="flex gap-4 text-xs font-semibold text-[#544437] bg-[#faf2e9] p-3 rounded-xl border border-[#d9c2b2]/30 shadow-sm">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="radio"
            name="sort"
            value="status"
            checked={sortBy === 'status'}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="text-[#f29744] focus:ring-[#f29744] border-[#d9c2b2]/60 focus:ring-offset-0"
          />
          Sort by Status
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="radio"
            name="sort"
            value="name"
            checked={sortBy === 'name'}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="text-[#f29744] focus:ring-[#f29744] border-[#d9c2b2]/60 focus:ring-offset-0"
          />
          Sort by Name
        </label>
      </div>

      {/* Items list */}
      <div className="bg-white rounded-xl border border-[#d9c2b2]/40 divide-y divide-[#d9c2b2]/20 shadow-sm overflow-hidden">
        {filteredAndSorted.length === 0 ? (
          <div className="text-center py-8 text-xs text-[#544437] font-medium bg-white">
            {searchTerm ? 'Bahan tidak ditemukan' : (filterStatus === 'all' ? 'No items found' : `No ${filterStatus} items`)}
          </div>
        ) : (
          filteredAndSorted.map((item) => {
            const statusDotColor =
              item.status === 'below'
                ? 'bg-[#ba1a1a] ring-[#ffdad6]'
                : item.status === 'warning'
                ? 'bg-[#fd7e62] ring-[#ffdad3]'
                : 'bg-[#006e24] ring-[#93f997]/35';

            const statusLabelText =
              item.status === 'below'
                ? 'Kritis'
                : item.status === 'warning'
                ? 'Warning'
                : 'Ready';

            const statusLabelColor =
              item.status === 'below'
                ? 'text-[#ba1a1a]'
                : item.status === 'warning'
                ? 'text-[#a43c26]'
                : 'text-[#006e24]';

            return (
              <div
                key={item.bahan_baku_id}
                onClick={() => onItemClick(item)}
                className="flex justify-between items-center p-4 hover:bg-gray-50/50 cursor-pointer transition-colors min-h-[56px]"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${statusDotColor} ring-4`}></div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-gray-900 text-sm">{item.item_name}</span>
                    <span className="text-[11px] text-gray-500 capitalize">{getStorageLocation(item.kategori, item.item_name)}</span>
                  </div>
                </div>
                
                <div className="flex flex-col items-end">
                  <span className="font-bold text-gray-900 text-sm">
                    {item.current_qty} {item.satuan} / {item.threshold} {item.satuan} {item.threshold === 0 ? ' (no threshold)' : ''}
                  </span>
                  <span className={`text-[10px] font-extrabold uppercase tracking-wider ${statusLabelColor}`}>
                    {statusLabelText} {item.is_flagged && <span className="text-[#ba1a1a] font-bold">*</span>}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
