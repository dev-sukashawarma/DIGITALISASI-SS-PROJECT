'use client';

import React, { useState, useMemo } from 'react';
import type { MonitoringItem } from '@/lib/types/monitoring';
import { Skeleton, getBahanBakuSource } from '@suka/design-system';
import { decomposeTriUnitRaw } from '@/lib/format/compositeUnit';
import { ChevronUp, ChevronDown, ArrowUpDown, Eye, Edit3, Check, X } from 'lucide-react';

/** Label kategori untuk SPV Dashboard */
const getKategoriLabel = (kategori: string): string => {
  const upper = (kategori || '').toUpperCase();
  
  switch (upper) {
    case 'FOOD & BEVERAGE': return '🥩 Food & Beverage';
    case 'BUMBU':           return '🌶️ Bumbu';
    case 'PACKAGING':       return '📦 Packaging';
    case 'OPERASIONAL':     return '📋 Operasional';
    default: return kategori || 'Bahan Baku';
  }
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

interface SPVTableProps {
  items: MonitoringItem[];
  tab: 'overview' | 'alerts' | 'compliance';
  onRowClick: (item: MonitoringItem) => void;
  selectedOutletId?: string;
  onThresholdChange?: (outletId: string, bahanBakuId: string, value: number) => void;
  onRestockRequest?: (item: MonitoringItem) => void;
  onTransferRequest?: (item: MonitoringItem) => void;
  searchTerm?: string;
  filterStatus?: 'all' | 'below' | 'warning' | 'ok';
  hideFilters?: boolean;
  loading?: boolean;
}

type SortField = 'item_name' | 'status' | 'current_qty' | 'last_opname_date';
type SortDir = 'asc' | 'desc';

export function SPVTable({
  items,
  tab,
  onRowClick,
  selectedOutletId,
  onThresholdChange,
  searchTerm = '',
  filterStatus = 'all',
  loading = false,
}: SPVTableProps) {
  const [sortField, setSortField] = useState<SortField>('item_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');

  const filteredItems = useMemo(() => {
    let result = items;

    // Filter by outlet if selected in Overview tab
    if (tab === 'overview' && selectedOutletId) {
      result = result.filter((item) => item.outlet_id === selectedOutletId);
    } else if (tab === 'alerts') {
      result = result.filter((item) => item.status !== 'ok' || item.is_flagged);
    } else if (tab === 'compliance') {
      result = result.filter((item) => item.is_flagged);
    }

    // Filter by status (below, warning, ok)
    if (filterStatus !== 'all') {
      result = result.filter((item) => item.status === filterStatus);
    }

    // Filter out GUDANG_PUSAT items if the outlet is not a Gudang
    result = result.filter((item) => {
      const source = getBahanBakuSource(item.item_name);
      const isGudang = (item.outlet_name || '').toUpperCase().includes('GUDANG');
      if (source === 'GUDANG_PUSAT' && !isGudang) {
        return false;
      }
      return true;
    });

    // Filter by search term
    if (searchTerm) {
      result = result.filter((item) =>
        item.item_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'item_name') {
        comparison = a.item_name.localeCompare(b.item_name);
      } else if (sortField === 'status') {
        const order = { below: 0, warning: 1, ok: 2 };
        comparison = order[a.status] - order[b.status];
      } else if (sortField === 'current_qty') {
        comparison = a.current_qty - b.current_qty;
      } else if (sortField === 'last_opname_date') {
        comparison = new Date(a.last_opname_date || 0).getTime() - new Date(b.last_opname_date || 0).getTime();
      }
      return sortDir === 'asc' ? comparison : -comparison;
    });

    return [...result];
  }, [items, tab, selectedOutletId, filterStatus, searchTerm, sortField, sortDir]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="overflow-hidden border border-suka-brown/10 rounded-2xl shadow-xs bg-white">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-suka-cream/40 text-suka-brown/70 border-b border-suka-brown/10 text-[10px] font-black uppercase tracking-wider">
                <th className="py-4 px-5">Nama Bahan</th>
                <th className="py-4 px-3 text-right">Threshold</th>
                <th className="py-4 px-3 text-right">Sat. Besar</th>
                <th className="py-4 px-3 text-right">Sat. Tengah</th>
                <th className="py-4 px-3 text-right">Sat. Kecil</th>
                <th className="py-4 px-3 text-center">Status</th>
                <th className="py-4 px-3 text-right">Opname</th>
                <th className="py-4 pr-5 pl-2 text-center w-16">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-suka-brown/5">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <tr key={i} className="py-4">
                  <td className="py-4 px-5"><Skeleton className="h-4 w-40" /></td>
                  <td className="py-4 px-3 text-right"><Skeleton className="h-4 w-12 ml-auto" /></td>
                  <td className="py-4 px-3 text-right"><Skeleton className="h-4 w-14 ml-auto" /></td>
                  <td className="py-4 px-3 text-right"><Skeleton className="h-4 w-14 ml-auto" /></td>
                  <td className="py-4 px-3 text-right"><Skeleton className="h-4 w-14 ml-auto" /></td>
                  <td className="py-4 px-3 text-center"><Skeleton className="h-5 w-16 mx-auto rounded-full" /></td>
                  <td className="py-4 px-3 text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                  <td className="py-4 pr-5 pl-2 text-center"><Skeleton className="h-7 w-7 mx-auto rounded-lg" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100" />;
    }
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3 h-3 text-suka-orange" />
    ) : (
      <ChevronDown className="w-3 h-3 text-suka-orange" />
    );
  };

  const startEditing = (item: MonitoringItem, e: React.MouseEvent) => {
    if (!onThresholdChange) return;
    e.stopPropagation();
    setEditingId(`${item.outlet_id}-${item.bahan_baku_id}`);
    setEditingValue(item.threshold.toString());
  };

  const cancelEditing = (e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    setEditingId(null);
  };

  const saveEditing = (item: MonitoringItem, e: React.SyntheticEvent) => {
    e.stopPropagation();
    const val = Number(editingValue);
    if (!isNaN(val) && val >= 0) {
      onThresholdChange?.(item.outlet_id, item.bahan_baku_id, val);
    }
    setEditingId(null);
  };

  const getRelativeTimeString = (dateStr: string | null) => {
    if (!dateStr) return 'Belum Opname';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) {
      return `${diffMins <= 0 ? 1 : diffMins} mnt lalu`;
    } else if (diffHours < 24) {
      return `${diffHours} jam lalu`;
    } else if (diffDays === 1) {
      return 'Kemarin';
    } else {
      return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    }
  };

  const renderItemRow = (item: MonitoringItem) => {
    const editKey = `${item.outlet_id}-${item.bahan_baku_id}`;
    const isEditing = editingId === editKey;
    const { large, medium, small } = decomposeTriUnitRaw(
      item.current_qty,
      item.saldo_is_gram,
      item.satuan_tengah,
      item.faktor_tengah,
      item.satuan_kecil,
      item.faktor_tampilan
    );

    const source = getBahanBakuSource(item.item_name);

    const statusTextColor = 
      item.status === 'below' 
        ? 'text-red-600' 
        : item.status === 'warning' 
        ? 'text-amber-600' 
        : 'text-suka-brown';

    return (
      <tr
        key={editKey}
        onClick={() => onRowClick(item)}
        className="hover:bg-suka-cream/20 cursor-pointer transition-colors group"
      >
        {/* Nama Bahan Baku */}
        <td className="py-3.5 px-5">
          <div className="font-extrabold text-sm text-suka-brown group-hover:text-suka-orange transition-colors">
            {item.item_name}
          </div>
          <div className="flex items-center gap-2 text-xs text-suka-brown/60 mt-0.5">
            <span className="text-[11px] font-medium">{getKategoriLabel(item.kategori)}</span>
            {source !== 'UNKNOWN' && (
              <>
                <span>·</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                  source === 'KITCHEN' || source === 'GUDANG_PUSAT'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                }`}>
                  {source === 'KITCHEN' || source === 'GUDANG_PUSAT' ? 'Pusat' : 'Outlet'}
                </span>
              </>
            )}
          </div>
        </td>

        {/* Batas Minimum (Threshold) */}
        <td className="py-3.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
          {isEditing ? (
            <div className="flex items-center gap-1 justify-end">
              <input
                type="number"
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                className="w-14 border border-suka-orange rounded-lg p-1 text-xs text-right font-bold focus:outline-none bg-white shadow-2xs"
                autoFocus
              />
              <button
                onClick={(e) => saveEditing(item, e)}
                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                title="Simpan"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={cancelEditing}
                className="p-1 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                title="Batal"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 justify-end">
              <span className="font-bold text-suka-brown/80 text-xs">
                {item.threshold} <span className="text-[10px] font-normal text-suka-brown/50">{formatUnit(item.satuan)}</span>
              </span>
              {onThresholdChange && (
                <button
                  onClick={(e) => startEditing(item, e)}
                  className="p-0.5 text-suka-brown/30 hover:text-suka-orange rounded opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                  title="Ubah Nilai Threshold"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </td>

        {/* Satuan Besar */}
        <td className={`py-3.5 px-3 text-right font-bold text-xs ${statusTextColor}`}>
          {formatNum(large)} <span className="text-[10px] font-normal opacity-70">{formatUnit(item.satuan)}</span>
        </td>

        {/* Satuan Tengah */}
        <td className={`py-3.5 px-3 text-right font-bold text-xs ${statusTextColor}`}>
          {item.satuan_tengah ? (
            <>{formatNum(medium)} <span className="text-[10px] font-normal opacity-70">{formatUnit(item.satuan_tengah)}</span></>
          ) : (
            <span className="text-suka-brown/30 font-normal">—</span>
          )}
        </td>

        {/* Satuan Kecil */}
        <td className={`py-3.5 px-3 text-right font-bold text-xs ${statusTextColor}`}>
          {item.satuan_kecil ? (
            <>{formatNum(small)} <span className="text-[10px] font-normal opacity-70">{formatUnit(item.satuan_kecil)}</span></>
          ) : (
            <span className="text-suka-brown/30 font-normal">—</span>
          )}
        </td>

        {/* Status Badge */}
        <td className="py-3.5 px-3 text-center">
          {item.status === 'below' && (
            <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 border border-red-200/80 px-2 py-0.5 rounded-full font-black text-[9px] uppercase tracking-wider shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
              Kritis
            </span>
          )}
          {item.status === 'warning' && (
            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200/80 px-2 py-0.5 rounded-full font-black text-[9px] uppercase tracking-wider shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Menipis
            </span>
          )}
          {item.status === 'ok' && (
            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-2 py-0.5 rounded-full font-black text-[9px] uppercase tracking-wider shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Aman
            </span>
          )}
        </td>

        {/* Opname Terakhir */}
        <td className="py-3.5 px-3 text-right text-[11px] font-medium text-suka-brown/60 whitespace-nowrap">
          {getRelativeTimeString(item.last_opname_date)}
        </td>

        {/* Aksi Button */}
        <td className="py-3.5 pr-5 pl-2 text-center">
          <button
            type="button"
            onClick={() => onRowClick(item)}
            title="Lihat Detail Riwayat Stok"
            className="p-1.5 rounded-xl bg-white border border-suka-brown/15 text-suka-brown hover:bg-suka-cream hover:text-suka-orange transition-all shadow-2xs cursor-pointer active:scale-95"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-4">
      {/* Desktop Table View (>= md) */}
      <div className="hidden md:block overflow-hidden border border-suka-brown/10 rounded-2xl shadow-xs bg-white">
        <table className="w-full text-left border-collapse min-w-[840px]">
          <thead>
            <tr className="bg-suka-cream/40 text-suka-brown/70 border-b border-suka-brown/10 text-[10px] font-black uppercase tracking-widest">
              <th className="py-3.5 px-5 cursor-pointer group" onClick={() => handleSort('item_name')}>
                <div className="flex items-center gap-1.5">
                  <span>Nama Bahan Baku</span>
                  {renderSortIcon('item_name')}
                </div>
              </th>
              <th className="py-3.5 px-3 text-right">
                <span>Threshold</span>
              </th>
              <th className="py-3.5 px-3 text-right cursor-pointer group" onClick={() => handleSort('current_qty')}>
                <div className="flex items-center justify-end gap-1.5">
                  <span>Sat. Besar</span>
                  {renderSortIcon('current_qty')}
                </div>
              </th>
              <th className="py-3.5 px-3 text-right">
                <span>Sat. Tengah</span>
              </th>
              <th className="py-3.5 px-3 text-right">
                <span>Sat. Kecil</span>
              </th>
              <th className="py-3.5 px-3 text-center cursor-pointer group" onClick={() => handleSort('status')}>
                <div className="flex items-center justify-center gap-1.5">
                  <span>Status</span>
                  {renderSortIcon('status')}
                </div>
              </th>
              <th className="py-3.5 px-3 text-right cursor-pointer group" onClick={() => handleSort('last_opname_date')}>
                <div className="flex items-center justify-end gap-1.5">
                  <span>Opname</span>
                  {renderSortIcon('last_opname_date')}
                </div>
              </th>
              <th className="py-3.5 pr-5 pl-2 text-center w-16">
                <span>Aksi</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-suka-brown/5 text-xs">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-suka-brown/50">
                  Tidak ada data bahan baku yang sesuai filter
                </td>
              </tr>
            ) : tab === 'alerts' ? (
              /* Alerts grouped by Outlet */
              (() => {
                const grouped = filteredItems.reduce((acc, item) => {
                  if (!acc[item.outlet_name]) acc[item.outlet_name] = [];
                  acc[item.outlet_name].push(item);
                  return acc;
                }, {} as Record<string, MonitoringItem[]>);

                return Object.keys(grouped).sort().map((outletName) => (
                  <React.Fragment key={outletName}>
                    <tr className="bg-suka-cream/30 border-y border-suka-brown/10">
                      <td colSpan={8} className="py-2.5 px-5 font-black text-suka-brown text-xs uppercase tracking-wide">
                        🏢 {outletName} ({grouped[outletName].length} Item Peringatan)
                      </td>
                    </tr>
                    {grouped[outletName].map((item) => renderItemRow(item))}
                  </React.Fragment>
                ));
              })()
            ) : (
              /* Overview grouped by Category */
              (() => {
                const grouped = filteredItems.reduce((acc, item) => {
                  const label = getKategoriLabel(item.kategori);
                  if (!acc[label]) acc[label] = [];
                  acc[label].push(item);
                  return acc;
                }, {} as Record<string, MonitoringItem[]>);

                const KATEGORI_LABELS = ['🥩 Food & Beverage', '🌶️ Bumbu', '📦 Packaging', '📋 Operasional'];
                const sortedLabels = KATEGORI_LABELS.filter((l) => grouped[l] && grouped[l].length > 0);
                Object.keys(grouped).forEach((l) => {
                  if (!sortedLabels.includes(l)) sortedLabels.push(l);
                });

                return sortedLabels.map((label) => (
                  <React.Fragment key={label}>
                    <tr className="bg-[#faf2e9] border-y border-suka-brown/15">
                      <td colSpan={8} className="py-2.5 px-5 font-black text-suka-brown text-xs uppercase tracking-wide">
                        {label} ({grouped[label].length} Item)
                      </td>
                    </tr>
                    {grouped[label].map((item) => renderItemRow(item))}
                  </React.Fragment>
                ));
              })()
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View (< md) */}
      <div className="md:hidden space-y-3">
        {filteredItems.length === 0 ? (
          <div className="text-center py-10 text-suka-brown/50 text-xs bg-white rounded-2xl border border-suka-brown/10">
            Tidak ada data bahan baku ditemukan
          </div>
        ) : (
          filteredItems.map((item) => {
            const editKey = `${item.outlet_id}-${item.bahan_baku_id}`;
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
                key={editKey}
                onClick={() => onRowClick(item)}
                className="p-4 rounded-2xl border border-suka-brown/10 bg-white shadow-2xs hover:border-suka-orange transition-all cursor-pointer space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-suka-brown/60 bg-suka-cream/80 px-2 py-0.5 rounded-md">
                      {getKategoriLabel(item.kategori)}
                    </span>
                    <h3 className="font-extrabold text-suka-brown text-sm mt-1">
                      {item.item_name}
                    </h3>
                  </div>

                  {item.status === 'below' ? (
                    <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 text-[9px] font-black uppercase">
                      Kritis
                    </span>
                  ) : item.status === 'warning' ? (
                    <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-black uppercase">
                      Menipis
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-black uppercase">
                      Aman
                    </span>
                  )}
                </div>

                {/* 3 Units Breakdown */}
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

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-[10px] text-suka-brown/50">
                    Batas Min: <strong className="text-suka-brown font-bold">{item.threshold} {formatUnit(item.satuan)}</strong>
                  </span>
                  <span className="text-[10px] text-suka-brown/50">
                    Opname: {getRelativeTimeString(item.last_opname_date)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="text-xs text-suka-brown/50 font-medium px-1">
        Total: <strong className="text-suka-brown font-bold">{filteredItems.length}</strong> bahan baku
      </div>
    </div>
  );
}
