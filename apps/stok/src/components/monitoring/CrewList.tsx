'use client';

import React, { useState, useMemo } from 'react';
import type { MonitoringItem } from '@/lib/types/monitoring';
import { Skeleton, getBahanBakuSource } from '@suka/design-system';
import { decomposeTriUnitRaw } from '@/lib/format/compositeUnit';
import { Search, X, MapPin } from 'lucide-react';

interface CrewListProps {
  items: MonitoringItem[];
  onItemClick: (item: MonitoringItem) => void;
  loading?: boolean;
}

type SortBy = 'status' | 'name';

const getStorageLocation = (category: string, name: string) => {
  const nameLower = name.toLowerCase();
  const catLower = (category || '').toLowerCase();

  if (catLower === 'item core' || nameLower.includes('daging') || nameLower.includes('ayam')) {
    return 'Frozen Storage';
  }
  if (catLower === 'minuman' || nameLower.includes('garlic')) {
    return 'Chilled Storage';
  }
  if (nameLower.includes('lpg') || nameLower.includes('gas')) {
    return 'Utility Area';
  }

  return 'Dry Storage';
};

const normalizeKategori = (kategori: string): string => {
  const upper = (kategori || '').toUpperCase();
  if (['FOOD & BEVERAGE', 'PACKAGING', 'OPERASIONAL', 'BUMBU'].includes(upper)) return upper;
  return 'OPERASIONAL';
};

const formatNum = (val: number | string | null | undefined): string | number => {
  if (val === null || val === undefined || val === '') return '0';
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return val;
  if (Number.isInteger(num)) return num;
  return Number(num.toFixed(1));
};

const formatUnit = (unit: string | null | undefined): string => {
  if (!unit) return '';
  const u = unit.trim();
  const lower = u.toLowerCase();
  if (lower === 'gram' || lower === 'gr') return 'Gr';
  if (lower === 'kg' || lower === 'kilogram') return 'Kg';
  if (lower === 'lembar' || lower === 'lbr') return 'Lbr';
  if (lower === 'bungkus' || lower === 'bks') return 'Bks';
  if (lower === 'kompan' || lower === 'jerigen') return 'Kompan';
  if (lower === 'tabung') return 'Tabung';
  if (lower === 'bal') return 'Bal';
  if (lower === 'dus') return 'Dus';
  if (lower === 'pack' || lower === 'pck') return 'Pack';
  if (lower === 'roll') return 'Roll';
  if (lower === 'pcs' || lower === 'biji') return 'Pcs';
  return u.charAt(0).toUpperCase() + u.slice(1).toLowerCase();
};

const KATEGORI_ORDER: { key: string; label: string; headerColor: string }[] = [
  { key: 'FOOD & BEVERAGE', label: '🥩 Food & Beverage', headerColor: 'text-[#904d00]' },
  { key: 'BUMBU',           label: '🌶️ Bumbu',           headerColor: 'text-[#7c3300]' },
  { key: 'PACKAGING',       label: '📦 Packaging',       headerColor: 'text-[#544437]' },
  { key: 'OPERASIONAL',     label: '📋 Operasional',     headerColor: 'text-[#006496]' },
];

export function CrewList({ items, onItemClick, loading = false }: CrewListProps) {
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [filterStatus, setFilterStatus] = useState<'all' | 'below' | 'flagged'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const groupedItems = useMemo(() => {
    let result = [...items];

    result = result.filter((item) => {
      const source = getBahanBakuSource(item.item_name);
      const isGudang = (item.outlet_name || '').toUpperCase().includes('GUDANG');
      if (source === 'GUDANG_PUSAT' && !isGudang) {
        return false;
      }
      return true;
    });

    if (filterStatus === 'below') {
      result = result.filter((item) => item.status === 'below');
    } else if (filterStatus === 'flagged') {
      result = result.filter((item) => item.is_flagged);
    }

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

    const map: Record<string, MonitoringItem[]> = {};
    for (const cat of KATEGORI_ORDER) map[cat.key] = [];

    for (const item of result) {
      const key = normalizeKategori(item.kategori);
      if (map[key]) map[key].push(item);
      else map['OPERASIONAL'].push(item);
    }

    for (const key of Object.keys(map)) map[key].sort(compare);

    return map;
  }, [items, sortBy, filterStatus, searchTerm]);

  const filteredAndSorted = KATEGORI_ORDER.flatMap(cat => groupedItems[cat.key] ?? []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
        </div>
        <Skeleton className="h-11 w-full rounded-2xl" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const belowCount = items.filter((item) => item.status === 'below').length;
  const flaggedCount = items.filter((item) => item.is_flagged).length;
  const okCount = items.filter((item) => item.status === 'ok' && !item.is_flagged).length;

  const renderItemCard = (item: MonitoringItem) => {
    const { large, medium, small } = decomposeTriUnitRaw(
      item.current_qty,
      item.saldo_is_gram,
      item.satuan_tengah,
      item.faktor_tengah,
      item.satuan_kecil,
      item.faktor_tampilan
    );

    return (
      <div
        key={item.bahan_baku_id}
        onClick={() => onItemClick(item)}
        className="p-4 rounded-2xl border border-suka-brown/10 bg-white shadow-2xs hover:border-suka-orange transition-all cursor-pointer space-y-3 group"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-extrabold text-suka-brown text-sm sm:text-base group-hover:text-suka-orange transition-colors truncate">
              {item.item_name}
            </h3>
            <div className="flex items-center gap-2 text-[11px] text-suka-brown/60 mt-0.5 font-medium">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-suka-brown/40" />
                {getStorageLocation(item.kategori, item.item_name)}
              </span>
              <span>·</span>
              <span>Min: <strong>{item.threshold} {formatUnit(item.satuan)}</strong></span>
            </div>
          </div>

          <div>
            {item.status === 'below' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 text-[10px] font-black uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                Kritis
              </span>
            ) : item.status === 'warning' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Menipis
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Aman
              </span>
            )}
          </div>
        </div>

        {/* 3 Unit Breakdown Grid */}
        <div className="grid grid-cols-3 gap-2 bg-suka-cream/20 p-2.5 rounded-xl border border-suka-brown/5 text-center">
          <div>
            <span className="text-[9px] text-suka-brown/50 font-bold uppercase tracking-wider block">Sat. Besar</span>
            <span className="text-xs font-black text-suka-brown">
              {formatNum(large)} <span className="text-[9px] font-normal text-suka-brown/60">{formatUnit(item.satuan)}</span>
            </span>
          </div>
          <div>
            <span className="text-[9px] text-suka-brown/50 font-bold uppercase tracking-wider block">Sat. Tengah</span>
            <span className="text-xs font-black text-suka-brown">
              {item.satuan_tengah ? (
                <>{formatNum(medium)} <span className="text-[9px] font-normal text-suka-brown/60">{formatUnit(item.satuan_tengah)}</span></>
              ) : '—'}
            </span>
          </div>
          <div>
            <span className="text-[9px] text-suka-brown/50 font-bold uppercase tracking-wider block">Sat. Kecil</span>
            <span className="text-xs font-black text-suka-brown">
              {item.satuan_kecil ? (
                <>{formatNum(small)} <span className="text-[9px] font-normal text-suka-brown/60">{formatUnit(item.satuan_kecil)}</span></>
              ) : '—'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Summary KPI Cards */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setFilterStatus(filterStatus === 'below' ? 'all' : 'below')}
          className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer active:scale-95 ${
            filterStatus === 'below'
              ? 'bg-red-500 text-white border-red-600 shadow-2xs'
              : 'bg-white border-suka-brown/10 text-suka-brown hover:bg-red-50/50'
          }`}
        >
          <div className="text-xl font-black">{belowCount}</div>
          <div className="text-[10px] font-bold uppercase tracking-wider mt-0.5">Kritis</div>
        </button>

        <button
          onClick={() => setFilterStatus(filterStatus === 'flagged' ? 'all' : 'flagged')}
          className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer active:scale-95 ${
            filterStatus === 'flagged'
              ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
              : 'bg-white border-suka-brown/10 text-suka-brown hover:bg-amber-50/50'
          }`}
        >
          <div className="text-xl font-black">{flaggedCount}</div>
          <div className="text-[10px] font-bold uppercase tracking-wider mt-0.5">Selisih</div>
        </button>

        <div className="p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50 text-center text-emerald-800">
          <div className="text-xl font-black text-emerald-700">{okCount}</div>
          <div className="text-[10px] font-bold uppercase tracking-wider mt-0.5">Aman</div>
        </div>
      </div>

      {/* Search & Sort Toolbar */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-suka-brown/40" />
          <input
            type="text"
            placeholder="Cari nama bahan baku..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-8 py-2.5 bg-white border border-suka-brown/10 rounded-2xl text-xs font-bold text-suka-brown placeholder:text-suka-brown/40 focus:outline-none focus:border-suka-orange shadow-xs"
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
        
        <div className="w-36 shrink-0">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="w-full px-3 py-2.5 bg-white border border-suka-brown/10 rounded-2xl text-xs font-bold text-suka-brown focus:outline-none focus:border-suka-orange shadow-xs cursor-pointer"
          >
            <option value="name">Sort: Nama</option>
            <option value="status">Sort: Status</option>
          </select>
        </div>
      </div>

      {/* Items list grouped by category */}
      <div className="space-y-4">
        {filteredAndSorted.length === 0 ? (
          <div className="text-center py-12 text-xs font-bold text-suka-brown/50 bg-white rounded-3xl border border-suka-brown/10">
            {searchTerm ? 'Bahan baku tidak ditemukan' : 'Tidak ada data bahan baku'}
          </div>
        ) : (
          KATEGORI_ORDER.map((cat) => {
            const catItems = groupedItems[cat.key] ?? [];
            if (catItems.length === 0) return null;
            return (
              <div key={cat.key} className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h4 className="font-extrabold text-xs text-suka-brown uppercase tracking-wider">
                    {cat.label}
                  </h4>
                  <span className="text-[10px] font-bold text-suka-brown/50">
                    {catItems.length} Item
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {catItems.map((item) => renderItemCard(item))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
