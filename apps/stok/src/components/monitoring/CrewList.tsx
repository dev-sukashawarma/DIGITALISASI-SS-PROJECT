'use client';

import React, { useState, useMemo } from 'react';
import type { MonitoringItem } from '@/lib/types/monitoring';
import { Skeleton } from '@suka/design-system';
import { formatCompositeSaldo } from '@/lib/format/compositeUnit';

interface CrewListProps {
  items: MonitoringItem[];
  onItemClick: (item: MonitoringItem) => void;
  loading?: boolean;
}

type SortBy = 'status' | 'name';

const getStorageLocation = (category: string, name: string) => {
  const nameLower = name.toLowerCase();
  const catLower = (category || '').toLowerCase();

  // Kategori baru: item core, bumbu, minuman, kemasan, lainnya
  if (catLower === 'item core' || nameLower.includes('daging') || nameLower.includes('ayam')) {
    return 'Frozen Storage';
  }
  if (catLower === 'minuman' || nameLower.includes('garlic')) {
    return 'Chilled Storage';
  }
  if (nameLower.includes('lpg') || nameLower.includes('gas')) {
    return 'Utility Area';
  }

  // Bumbu, kemasan, lainnya → Dry Storage
  return 'Dry Storage';
};

/** Normalisasi kategori lama → kategori baru.
 * Data di DB sebagian masih pakai nilai lama (protein, sayur, saus, gas).
 * Mapping ini memastikan tampilan selalu pakai 5 kategori baru.
 */
const normalizeKategori = (kategori: string): string => {
  const c = (kategori || '').toLowerCase();
  // Kategori lama → baru
  if (c === 'protein' || c === 'sayur') return 'item core';
  if (c === 'saus')                     return 'bumbu';
  if (c === 'gas')                      return 'lainnya';
  // Kategori baru sudah benar
  if (['item core', 'bumbu', 'minuman', 'kemasan', 'lainnya'].includes(c)) return c;
  return 'lainnya';
};

const KATEGORI_ORDER: { key: string; label: string; headerColor: string }[] = [
  { key: 'item core', label: '⭐ Item Core', headerColor: 'text-[#904d00]' },
  { key: 'bumbu',     label: '🌶️ Bumbu',    headerColor: 'text-[#7a2d00]' },
  { key: 'minuman',   label: '🥤 Minuman',   headerColor: 'text-[#006496]' },
  { key: 'kemasan',   label: '📦 Kemasan',   headerColor: 'text-[#544437]' },
  { key: 'lainnya',   label: '📋 Lainnya',   headerColor: 'text-[#544437]' },
];

const getKategoriLabel = (kategori: string): string => {
  const found = KATEGORI_ORDER.find(k => k.key === normalizeKategori(kategori));
  return found ? found.label : (kategori || 'Bahan Baku');
};

export function CrewList({ items, onItemClick, loading = false }: CrewListProps) {
  const [sortBy, setSortBy] = useState<SortBy>('status');
  const [filterStatus, setFilterStatus] = useState<'all' | 'below' | 'flagged'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // useMemo WAJIB dieksekusi sebelum early-return `loading` (Rules of Hooks).
  const groupedItems = useMemo(() => {
    let result = [...items];

    // Filter by status
    if (filterStatus === 'below') {
      result = result.filter((item) => item.status === 'below');
    } else if (filterStatus === 'flagged') {
      result = result.filter((item) => item.is_flagged);
    }

    // Filter by search
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      result = result.filter((item) => item.item_name.toLowerCase().includes(term));
    }

    const compare = (a: MonitoringItem, b: MonitoringItem) => {
      if (sortBy === 'status') {
        const statusOrder = { below: 0, warning: 1, ok: 2 };
        const aOrder = statusOrder[a.status];
        const bOrder = statusOrder[b.status];
        if (aOrder !== bOrder) return aOrder - bOrder;
      }
      return a.item_name.localeCompare(b.item_name);
    };

    // Grup berdasarkan 5 kategori baru
    const map: Record<string, MonitoringItem[]> = {};
    for (const cat of KATEGORI_ORDER) map[cat.key] = [];

    for (const item of result) {
      const key = normalizeKategori(item.kategori);
      if (map[key]) map[key].push(item);
      else map['lainnya'].push(item);
    }

    // Sort tiap grup
    for (const key of Object.keys(map)) map[key].sort(compare);

    return map;
  }, [items, sortBy, filterStatus, searchTerm]);

  const filteredAndSorted = KATEGORI_ORDER.flatMap(cat => groupedItems[cat.key] ?? []);

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Skeleton summary counts */}
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>

        {/* Skeleton search */}
        <Skeleton className="h-10 w-full" />

        {/* Skeleton sort options */}
        <Skeleton className="h-10 w-full" />

        {/* Skeleton list */}
        <div className="bg-white rounded-xl border border-[#d9c2b2]/40 divide-y divide-[#d9c2b2]/20 shadow-sm overflow-hidden p-2 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex justify-between items-center p-3">
              <div className="flex items-center gap-3">
                <Skeleton className="w-4 h-4 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <div className="space-y-2 flex flex-col items-end">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-14" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const belowCount = items.filter((item) => item.status === 'below').length;
  const flaggedCount = items.filter((item) => item.is_flagged).length;
  const okCount = items.filter((item) => item.status === 'ok' && !item.is_flagged).length;

  const renderItemRow = (item: MonitoringItem) => {
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

    const { large, small } = (() => {
      if (!item.faktor_tampilan || !item.satuan_kecil) return { large: item.current_qty, small: 0 };
      let whole = Math.trunc(item.current_qty);
      const remainderRaw = (item.current_qty - whole) * item.faktor_tampilan;
      let remainder = Math.round(remainderRaw * 100) / 100;
      if (Math.abs(remainder) >= item.faktor_tampilan) {
        whole += Math.sign(remainder);
        remainder = 0;
      }
      return { large: whole, small: Math.abs(remainder) };
    })();

    return (
      <div
        key={item.bahan_baku_id}
        onClick={() => onItemClick(item)}
        className="grid grid-cols-[2.5fr_1.5fr_1.5fr_1.5fr_1.5fr] gap-2 items-center p-3 hover:bg-gray-50/50 cursor-pointer transition-colors min-h-[56px] text-xs sm:text-sm"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <div className={`hidden sm:block shrink-0 w-2 h-2 rounded-full ${statusDotColor} ring-2`}></div>
          <div className="flex flex-col overflow-hidden">
            <span className="font-semibold text-gray-900 truncate" title={item.item_name}>{item.item_name}</span>
            <span className="text-[10px] text-gray-400 truncate">
              {getStorageLocation(item.kategori, item.item_name)}
            </span>
          </div>
        </div>

        <div className="text-gray-600 text-center font-medium">
          {item.threshold} <span className="text-[9px] opacity-70 font-normal">{item.satuan}</span>
        </div>

        <div className="font-bold text-gray-800 text-center">
          {large} <span className="text-[9px] font-normal opacity-70">{item.satuan}</span>
        </div>

        <div className="font-bold text-gray-800 text-center">
          {item.satuan_kecil ? (
            <>{small} <span className="text-[9px] font-normal opacity-70">{item.satuan_kecil}</span></>
          ) : (
            <span className="text-gray-300">-</span>
          )}
        </div>

        <div className="flex flex-col items-end justify-center pr-1">
          <span className={`text-[10px] font-extrabold uppercase tracking-wider ${statusLabelColor}`}>
            {statusLabelText} {item.is_flagged && <span className="text-[#ba1a1a] font-bold">*</span>}
          </span>
          <div className={`sm:hidden w-1.5 h-1.5 rounded-full mt-1 ${statusDotColor} ring-2`}></div>
        </div>
      </div>
    );
  };

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

      {/* Header table (visible on slightly larger screens or standard mobile if it fits) */}
      <div className="grid grid-cols-[2.5fr_1.5fr_1.5fr_1.5fr_1.5fr] gap-2 px-4 py-2.5 bg-[#f4e9de] text-[#544437] text-[9px] sm:text-[10px] font-bold uppercase tracking-wider rounded-xl border border-[#d9c2b2]/40 shadow-sm">
        <div className="col-span-1">Nama Item</div>
        <div className="text-center">Threshold</div>
        <div className="text-center">Sat. Besar</div>
        <div className="text-center">Sat. Kecil</div>
        <div className="text-right">Status</div>
      </div>

      {/* Items list — dikelompokkan per kategori */}
      <div className="bg-white rounded-xl border border-[#d9c2b2]/40 shadow-sm overflow-hidden">
        {filteredAndSorted.length === 0 ? (
          <div className="text-center py-8 text-xs text-[#544437] font-medium bg-white">
            {searchTerm ? 'Bahan tidak ditemukan' : (filterStatus === 'all' ? 'No items found' : `No ${filterStatus} items`)}
          </div>
        ) : (
          <>
            {KATEGORI_ORDER.map((cat) => {
              const catItems = groupedItems[cat.key] ?? [];
              if (catItems.length === 0) return null;
              return (
                <div key={cat.key} className="divide-y divide-[#d9c2b2]/20">
                  <div className={`px-4 py-2 bg-[#faf2e9] text-[10px] font-extrabold uppercase tracking-wider ${cat.headerColor}`}>
                    {cat.label}
                  </div>
                  {catItems.map((item) => renderItemRow(item))}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
