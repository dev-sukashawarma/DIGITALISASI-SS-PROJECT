'use client';

import React, { useState, useMemo } from 'react';
import type { MonitoringItem } from '@/lib/types/monitoring';
import { Skeleton } from '@suka/design-system/src/components/SkeletonBase';
import { getBahanBakuSource } from '@suka/design-system/src/utils/bahanBaku';
import { decomposeTriUnitRaw } from '@/lib/format/compositeUnit';


/** Konsisten dengan kategori di admin-dashboard: item core, bumbu, minuman, kemasan, lainnya */
const getKategoriLabel = (kategori: string): string => {
  let catLower = (kategori || '').toLowerCase();
  
  // Normalisasi kategori lama ke kategori baru (5 group)
  if (catLower === 'protein' || catLower === 'sayur') catLower = 'item core';
  else if (catLower === 'saus') catLower = 'bumbu';
  else if (catLower === 'gas') catLower = 'lainnya';
  
  switch (catLower) {
    case 'item core': return '⭐ Item Core';
    case 'bumbu':     return '🌶️ Bumbu';
    case 'minuman':   return '🥤 Minuman';
    case 'kemasan':   return '📦 Kemasan';
    case 'lainnya':   return '📋 Lainnya';
    default:          return kategori || 'Bahan Baku';
  }
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

type SortField = 'item_name' | 'status' | 'last_updated' | 'last_opname_date' | 'outlet_name';
type SortDir = 'asc' | 'desc';

export function SPVTable({
  items,
  tab,
  onRowClick,
  selectedOutletId,
  onThresholdChange,
  // onRestockRequest/onTransferRequest: bagian dari SPVTableProps untuk konsumen
  // (SPVDashboard mengirim handler asli), tapi belum ada trigger UI di tabel ini.
  searchTerm: externalSearchTerm,
  filterStatus: externalFilterStatus,
  hideFilters = false,
  loading = false,
}: SPVTableProps) {
  const [sortField, setSortField] = useState<SortField>('item_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [internalFilterStatus, setInternalFilterStatus] = useState<'all' | 'below' | 'warning' | 'ok'>('all');
  const [internalSearchTerm, setInternalSearchTerm] = useState('');
  // Hook-hook di bawah WAJIB dieksekusi sebelum early-return `loading`
  // (Rules of Hooks). Sebelumnya editingId/editingValue + filteredItems
  // ada di bawah `if (loading) return`, sehingga jumlah hook berubah saat
  // loading flip true→false → React error #310 (crash di useMemo).
  const [editingId, setEditingId] = useState<string | null>(null); // format: `${outlet_id}-${bahan_baku_id}`
  const [editingValue, setEditingValue] = useState<string>('');

  const filterStatus = externalFilterStatus !== undefined ? externalFilterStatus : internalFilterStatus;
  const searchTerm = externalSearchTerm !== undefined ? externalSearchTerm : internalSearchTerm;

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
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      if (sortField === 'status') {
        const statusOrder = { below: 0, warning: 1, ok: 2 };
        aVal = statusOrder[a.status as keyof typeof statusOrder];
        bVal = statusOrder[b.status as keyof typeof statusOrder];
      }

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    // Make copy to avoid mutation errors
    return [...result];
  }, [items, tab, selectedOutletId, filterStatus, searchTerm, sortField, sortDir]);

  if (loading) {
    return (
      <div className="space-y-4">
        {!hideFilters && (
          <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-xl border border-suka-brown/15 shadow-sm">
            <Skeleton className="h-10 w-full sm:max-w-xs" />
            <Skeleton className="h-10 w-full sm:max-w-md" />
          </div>
        )}
        <div className="overflow-x-auto border border-suka-brown/10 rounded-xl shadow-sm bg-white">
          <table className="w-full text-left border-collapse text-suka-ink">
            <thead>
              <tr className="bg-suka-cream/20 text-suka-brown border-b border-suka-brown/10 text-xs font-bold uppercase tracking-wider">
                {/* tab === 'alerts' now uses grouped rows, so no Outlet column needed here */}
                <th className="p-4">Nama Bahan</th>
                <th className="p-4 text-right">Threshold</th>
                <th className="p-4 text-right">Sat. Besar</th>
                <th className="p-4 text-right">Sat. Tengah</th>
                <th className="p-4 text-right">Sat. Kecil</th>
                <th className="p-4 hidden md:table-cell">Opname Terakhir</th>
                <th className="py-4 pl-4 pr-6 hidden sm:table-cell">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-suka-brown/10">
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="text-sm">
                  <td className="p-4">
                    <Skeleton className="h-4 w-40" />
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end">
                      <Skeleton className="h-4 w-12" />
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end">
                      <Skeleton className="h-4 w-12" />
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end">
                      <Skeleton className="h-4 w-12" />
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end">
                      <Skeleton className="h-4 w-12" />
                    </div>
                  </td>
                  <td className="p-4 hidden md:table-cell">
                    <Skeleton className="h-4 w-28" />
                  </td>
                  <td className="py-4 pl-4 pr-6 hidden sm:table-cell">
                    <Skeleton className="h-6 w-16" />
                  </td>
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

  const startEditing = (item: MonitoringItem, e: React.MouseEvent) => {
    if (!onThresholdChange) return;
    e.stopPropagation(); // Prevent row click details modal
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

  return (
    <div className="space-y-4">
      {/* Search & Filter Header (Conditional) */}
      {!hideFilters && (
        <div className="flex gap-4 flex-wrap bg-white p-3 rounded-lg border border-suka-brown/10 shadow-sm items-center justify-between">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Cari nama bahan..."
              value={searchTerm}
              onChange={(e) => setInternalSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-suka-brown/20 rounded text-sm text-suka-ink focus:outline-none focus:ring-1 focus:ring-suka-orange"
            />
          </div>

          <div className="flex gap-3 text-suka-brown text-sm font-medium">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="status"
                value="all"
                checked={filterStatus === 'all'}
                onChange={(e) => setInternalFilterStatus(e.target.value as typeof filterStatus)}
                className="accent-suka-orange"
              />
              Semua
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-red-600">
              <input
                type="radio"
                name="status"
                value="below"
                checked={filterStatus === 'below'}
                onChange={(e) => setInternalFilterStatus(e.target.value as typeof filterStatus)}
                className="accent-suka-orange"
              />
              Kritis (Below)
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-yellow-600">
              <input
                type="radio"
                name="status"
                value="warning"
                checked={filterStatus === 'warning'}
                onChange={(e) => setInternalFilterStatus(e.target.value as typeof filterStatus)}
                className="accent-suka-orange"
              />
              Menipis (Warning)
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-green-700">
              <input
                type="radio"
                name="status"
                value="ok"
                checked={filterStatus === 'ok'}
                onChange={(e) => setInternalFilterStatus(e.target.value as typeof filterStatus)}
                className="accent-suka-orange"
              />
              Aman (OK)
            </label>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="hidden md:block overflow-x-auto border border-suka-brown/10 rounded-xl shadow-sm bg-white">
        <table className="w-full text-left border-collapse text-suka-ink">
          <thead>
            <tr className="bg-suka-cream/20 text-suka-brown border-b border-suka-brown/10 text-xs font-bold uppercase tracking-wider">
              {/* Outlet column removed because we group by outlet in alerts tab */}
              <th className="p-4">
                <button onClick={() => handleSort('item_name')} className="hover:text-suka-orange font-bold">
                  Nama Bahan {sortField === 'item_name' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th className="p-4 text-right">Threshold</th>
              <th className="p-4 text-right">Sat. Besar</th>
              <th className="p-4 text-right">Sat. Tengah</th>
              <th className="p-4 text-right">Sat. Kecil</th>
              <th className="p-4 hidden md:table-cell">Opname Terakhir</th>
              <th className="py-4 pl-4 pr-6 hidden sm:table-cell">
                <button onClick={() => handleSort('status')} className="hover:text-suka-orange font-bold whitespace-nowrap">
                  Status {sortField === 'status' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-suka-brown/10">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-suka-brown/50 text-sm">
                  Tidak ada data bahan baku ditemukan
                </td>
              </tr>
            ) : (
              (() => {
                if (tab === 'alerts') {
                  // Group by outlet
                  const grouped = filteredItems.reduce((acc, item) => {
                    if (!acc[item.outlet_name]) acc[item.outlet_name] = [];
                    acc[item.outlet_name].push(item);
                    return acc;
                  }, {} as Record<string, MonitoringItem[]>);

                  // Sort outlets alphabetically
                  const sortedOutlets = Object.keys(grouped).sort();

                  return sortedOutlets.map(outletName => (
                    <React.Fragment key={outletName}>
                      <tr className="bg-suka-brown/5 border-t border-suka-brown/10">
                        <td colSpan={6} className="p-4 font-black text-suka-brown text-sm uppercase">
                          🏢 {outletName}
                        </td>
                      </tr>
                      {grouped[outletName].map((item) => {
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

                        const statusColor = item.status === 'below' ? 'text-red-600' :
                                            item.status === 'warning' ? 'text-orange-600' : 'text-green-700';

                        return (
                          <tr
                            key={editKey}
                            onClick={() => onRowClick(item)}
                            className="hover:bg-suka-cream/10 cursor-pointer text-sm transition-colors"
                          >
                            <td className="p-4 pl-8">
                              <div className="font-bold text-sm text-suka-ink uppercase tracking-wide">{item.item_name}</div>
                              <div className="flex gap-2 items-center text-xs text-suka-brown/60 mt-0.5">
                                <span>{getKategoriLabel(item.kategori)}</span>
                                {(() => {
                                  const source = getBahanBakuSource(item.item_name);
                                  if (source === 'UNKNOWN') return null;
                                  let badgeClass = '';
                                  let badgeLabel = '';
                                  if (source === 'KITCHEN' || source === 'GUDANG_PUSAT') {
                                    badgeClass = 'bg-red-50 text-red-700 border-red-200';
                                    badgeLabel = 'Gedung Pusat';
                                  } else if (source === 'OUTLET') {
                                    badgeClass = 'bg-purple-50 text-purple-700 border-purple-200';
                                    badgeLabel = 'Outlet';
                                  }
                                  return (
                                    <span className={`inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase rounded border ${badgeClass}`}>
                                      {badgeLabel}
                                    </span>
                                  )
                                })()}
                              </div>
                            </td>
                            <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                              {isEditing ? (
                                <div className="flex items-center gap-1 justify-end">
                                  <input
                                    type="number"
                                    value={editingValue}
                                    onChange={(e) => setEditingValue(e.target.value)}
                                    className="w-16 border border-suka-brown/30 rounded p-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-suka-orange bg-white"
                                    autoFocus
                                  />
                                  <button
                                    onClick={(e) => saveEditing(item, e)}
                                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                                    title="Simpan"
                                  >
                                    ✓
                                  </button>
                                  <button
                                    onClick={cancelEditing}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                                    title="Batal"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 justify-end group">
                                  <span className="font-semibold">{item.threshold}</span>
                                  {onThresholdChange && (
                                    <button
                                      onClick={(e) => startEditing(item, e)}
                                      className="p-1 text-suka-brown/40 hover:text-suka-orange rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                      title="Ubah Threshold"
                                    >
                                      ✎
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className={`p-4 font-bold text-sm text-right ${statusColor}`}>
                              {large} <span className="text-[10px] font-normal opacity-70">{item.satuan || 'kg'}</span>
                            </td>
                            <td className={`p-4 font-bold text-sm text-right ${statusColor}`}>
                              {item.satuan_tengah ? (
                                <>{medium} <span className="text-[10px] font-normal opacity-70">{item.satuan_tengah}</span></>
                              ) : '-'}
                            </td>
                            <td className={`p-4 font-bold text-sm text-right ${statusColor}`}>
                              {item.satuan_kecil ? (
                                <>{small} <span className="text-[10px] font-normal opacity-70">{item.satuan_kecil}</span></>
                              ) : '-'}
                            </td>
                            <td className="p-4 text-xs font-medium text-suka-brown/80 hidden md:table-cell whitespace-nowrap">
                              {getRelativeTimeString(item.last_opname_date)}
                            </td>
                            <td className="py-4 pl-4 pr-6 hidden sm:table-cell">
                              {item.status === 'below' && (
                                <span className="bg-red-50 text-red-700 border border-red-200/80 px-2.5 py-1 rounded-md font-bold text-[11px] uppercase tracking-wide whitespace-nowrap">
                                  Below Threshold
                                </span>
                              )}
                              {item.status === 'warning' && (
                                <span className="bg-orange-50 text-orange-700 border border-orange-200/80 px-2.5 py-1 rounded-md font-bold text-[11px] uppercase tracking-wide whitespace-nowrap">
                                  Warning Threshold
                                </span>
                              )}
                              {item.status === 'ok' && (
                                <span className="bg-green-50 text-green-700 border border-green-200/80 px-2.5 py-1 rounded-md font-bold text-[11px] uppercase tracking-wide whitespace-nowrap">
                                  OK
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ));
                }

                // Default rendering for other tabs (e.g. overview)
                const groupedOverview = filteredItems.reduce((acc, item) => {
                  const label = getKategoriLabel(item.kategori);
                  if (!acc[label]) acc[label] = [];
                  acc[label].push(item);
                  return acc;
                }, {} as Record<string, MonitoringItem[]>);

                const KATEGORI_LABELS = ['⭐ Item Core', '🌶️ Bumbu', '🥤 Minuman', '📦 Kemasan', '📋 Lainnya'];
                const sortedLabels = KATEGORI_LABELS.filter(label => groupedOverview[label] && groupedOverview[label].length > 0);
                Object.keys(groupedOverview).forEach(label => {
                  if (!sortedLabels.includes(label)) sortedLabels.push(label);
                });

                return sortedLabels.map(label => (
                  <React.Fragment key={label}>
                    <tr className="bg-suka-brown/5 border-t border-suka-brown/10">
                      <td colSpan={6} className="p-4 font-black text-suka-brown text-sm uppercase">
                        {label}
                      </td>
                    </tr>
                    {groupedOverview[label].map((item) => {
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

                const statusColor = item.status === 'below' ? 'text-red-600' :
                                    item.status === 'warning' ? 'text-orange-600' : 'text-green-700';

                return (
                  <tr
                    key={editKey}
                    onClick={() => onRowClick(item)}
                    className="hover:bg-suka-cream/10 cursor-pointer text-sm transition-colors"
                  >
                    <td className="p-4">
                      <div className="font-bold text-sm text-suka-ink uppercase tracking-wide">{item.item_name}</div>
                      <div className="flex gap-2 items-center text-xs text-suka-brown/60 mt-0.5">
                        <span>{getKategoriLabel(item.kategori)}</span>
                        {(() => {
                          const source = getBahanBakuSource(item.item_name);
                          if (source === 'UNKNOWN') return null;
                          let badgeClass = '';
                          let badgeLabel = '';
                          if (source === 'KITCHEN' || source === 'GUDANG_PUSAT') {
                            badgeClass = 'bg-red-50 text-red-700 border-red-200';
                            badgeLabel = 'Gedung Pusat';
                          } else if (source === 'OUTLET') {
                            badgeClass = 'bg-purple-50 text-purple-700 border-purple-200';
                            badgeLabel = 'Outlet';
                          }
                          return (
                            <span className={`inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase rounded border ${badgeClass}`}>
                              {badgeLabel}
                            </span>
                          )
                        })()}
                      </div>
                    </td>
                    <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                      {isEditing ? (
                        <div className="flex items-center gap-1 justify-end">
                          <input
                            type="number"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            className="w-16 border border-suka-brown/30 rounded p-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-suka-orange bg-white"
                            autoFocus
                          />
                          <button
                            onClick={(e) => saveEditing(item, e)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                            title="Simpan"
                          >
                            ✓
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="Batal"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 justify-end group">
                          <span className="font-semibold">{item.threshold}</span>
                          {onThresholdChange && (
                            <button
                              onClick={(e) => startEditing(item, e)}
                              className="p-1 text-suka-brown/40 hover:text-suka-orange rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                              title="Ubah Threshold"
                            >
                              ✎
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className={`p-4 font-bold text-sm text-right ${statusColor}`}>
                      {large} <span className="text-[10px] font-normal opacity-70">{item.satuan || 'kg'}</span>
                    </td>
                    <td className={`p-4 font-bold text-sm text-right ${statusColor}`}>
                      {item.satuan_tengah ? (
                        <>{medium} <span className="text-[10px] font-normal opacity-70">{item.satuan_tengah}</span></>
                      ) : '-'}
                    </td>
                    <td className={`p-4 font-bold text-sm text-right ${statusColor}`}>
                      {item.satuan_kecil ? (
                        <>{small} <span className="text-[10px] font-normal opacity-70">{item.satuan_kecil}</span></>
                      ) : '-'}
                    </td>
                    <td className="p-4 text-xs font-medium text-suka-brown/80 hidden md:table-cell whitespace-nowrap">
                      {getRelativeTimeString(item.last_opname_date)}
                    </td>
                    <td className="py-4 pl-4 pr-6 hidden sm:table-cell">
                      {item.status === 'below' && (
                        <span className="bg-red-50 text-red-700 border border-red-200/80 px-2.5 py-1 rounded-md font-bold text-[11px] uppercase tracking-wide whitespace-nowrap">
                          Below Threshold
                        </span>
                      )}
                      {item.status === 'warning' && (
                        <span className="bg-orange-50 text-orange-700 border border-orange-200/80 px-2.5 py-1 rounded-md font-bold text-[11px] uppercase tracking-wide whitespace-nowrap">
                          Warning Threshold
                        </span>
                      )}
                      {item.status === 'ok' && (
                        <span className="bg-green-50 text-green-700 border border-green-200/80 px-2.5 py-1 rounded-md font-bold text-[11px] uppercase tracking-wide whitespace-nowrap">
                          OK
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              </React.Fragment>
            ));
            })()
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View (< md) */}
      <div className="md:hidden space-y-3 mt-4">
        {filteredItems.length === 0 ? (
          <div className="text-center py-8 text-suka-brown/50 text-sm bg-white rounded-xl border border-suka-brown/10">
            Tidak ada data bahan baku ditemukan
          </div>
        ) : (
          (() => {
            const renderCard = (item: MonitoringItem) => {
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
              const statusColor = item.status === 'below' ? 'text-red-600' : item.status === 'warning' ? 'text-orange-600' : 'text-green-700';

              return (
                <div key={editKey} className="p-4 rounded-xl border flex flex-col min-h-[135px] transition-all duration-200 border-[#d9c2b2]/45 bg-white shadow-[0px_4px_12px_rgba(144,77,0,0.03)] hover:border-[#f29744]/45" onClick={() => onRowClick(item)}>
                  <div className="flex justify-between items-start gap-3">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-[8px] font-bold uppercase tracking-wider text-[#701604]/60 bg-[#faf2e9] px-1.5 py-0.5 rounded border border-[#d9c2b2]/30">
                          {getKategoriLabel(item.kategori)}
                        </span>
                        {(() => {
                          const source = getBahanBakuSource(item.item_name);
                          if (source === 'UNKNOWN') return null;
                          let badgeClass = '';
                          let badgeLabel = '';
                          if (source === 'KITCHEN' || source === 'GUDANG_PUSAT') {
                            badgeClass = 'bg-red-50 text-red-700 border-red-200';
                            badgeLabel = 'Gedung Pusat';
                          } else if (source === 'OUTLET') {
                            badgeClass = 'bg-purple-50 text-purple-700 border-purple-200';
                            badgeLabel = 'Outlet';
                          }
                          return (
                            <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${badgeClass}`}>
                              {badgeLabel}
                            </span>
                          )
                        })()}
                        {item.status !== 'ok' && (
                          <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${item.status === 'below' ? 'bg-red-50 text-red-700 border border-red-200/80' : 'bg-orange-50 text-orange-700 border border-orange-200/80'}`}>
                            {item.status === 'below' ? 'Kritis' : 'Menipis'}
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-[#1e1b15] text-xs uppercase tracking-wide mt-1.5 leading-tight truncate">
                        {item.item_name}
                      </h3>
                    </div>
                  </div>
                  
                  <div className="mt-3 flex items-center justify-between bg-suka-cream/10 p-2.5 rounded-lg border border-suka-brown/5">
                    <div>
                      <p className="text-[9px] text-[#544437]/60 font-semibold mb-0.5 uppercase tracking-wider">Sat. Besar</p>
                      <p className={`font-black text-sm ${statusColor}`}>{large} <span className="text-[10px] font-normal opacity-70">{item.satuan || 'kg'}</span></p>
                    </div>
                    {item.satuan_tengah && (
                      <div className="text-center">
                        <p className="text-[9px] text-[#544437]/60 font-semibold mb-0.5 uppercase tracking-wider">Sat. Tengah</p>
                        <p className={`font-black text-sm ${statusColor}`}>{medium} <span className="text-[10px] font-normal opacity-70">{item.satuan_tengah}</span></p>
                      </div>
                    )}
                    {item.satuan_kecil && (
                      <div className="text-right">
                        <p className="text-[9px] text-[#544437]/60 font-semibold mb-0.5 uppercase tracking-wider">Sat. Kecil</p>
                        <p className={`font-black text-sm ${statusColor}`}>{small} <span className="text-[10px] font-normal opacity-70">{item.satuan_kecil}</span></p>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between pt-3 border-t border-suka-brown/10">
                    <div className="text-[10px] font-medium text-suka-brown/60">
                      Upd: {getRelativeTimeString(item.last_opname_date)}
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            className="w-16 border border-suka-brown/30 rounded p-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-suka-orange bg-white"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEditing(item, e);
                              if (e.key === 'Escape') cancelEditing();
                            }}
                          />
                          <button onClick={(e) => saveEditing(item, e)} className="p-1 text-green-600 bg-green-50 rounded">✓</button>
                          <button onClick={cancelEditing} className="p-1 text-red-600 bg-red-50 rounded">✕</button>
                        </div>
                      ) : (
                        <div 
                          className={`flex items-center gap-1.5 ${onThresholdChange ? 'cursor-pointer' : ''}`} 
                          onClick={(e) => onThresholdChange && startEditing(item, e)}
                        >
                          <span className="text-[10px] text-suka-brown/60 uppercase tracking-wider font-semibold">Thresh:</span>
                          <span className="font-bold text-suka-ink text-xs">{item.threshold}</span>
                          {onThresholdChange && (
                            <span className="text-suka-brown/40 text-xs hover:text-suka-orange transition-colors">✎</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            };

            if (tab === 'alerts') {
              const grouped = filteredItems.reduce((acc, item) => {
                if (!acc[item.outlet_name]) acc[item.outlet_name] = [];
                acc[item.outlet_name].push(item);
                return acc;
              }, {} as Record<string, MonitoringItem[]>);
              return Object.keys(grouped).sort().map(outletName => (
                <div key={outletName} className="space-y-3 mb-6">
                  <h4 className="font-black text-suka-brown text-sm uppercase px-2 flex items-center gap-2">
                    <span>🏢</span> {outletName}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {grouped[outletName].map(item => renderCard(item))}
                  </div>
                </div>
              ));
            }

            const groupedOverview = filteredItems.reduce((acc, item) => {
              const label = getKategoriLabel(item.kategori);
              if (!acc[label]) acc[label] = [];
              acc[label].push(item);
              return acc;
            }, {} as Record<string, MonitoringItem[]>);
            const KATEGORI_LABELS = ['⭐ Item Core', '🌶️ Bumbu', '🥤 Minuman', '📦 Kemasan', '📋 Lainnya'];
            const sortedLabels = KATEGORI_LABELS.filter(label => groupedOverview[label] && groupedOverview[label].length > 0);
            Object.keys(groupedOverview).forEach(label => {
              if (!sortedLabels.includes(label)) sortedLabels.push(label);
            });

            return (
              <>
                {sortedLabels.map(label => (
                  <div key={label} className="space-y-3 mb-6">
                    <h4 className="font-black text-suka-brown text-sm uppercase px-2 flex items-center gap-2">
                      {label}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {groupedOverview[label].map(item => renderCard(item))}
                    </div>
                  </div>
                ))}
              </>
            );
          })()
        )}
      </div>

      <div className="text-xs text-suka-brown/50 font-medium">
        Menampilkan {filteredItems.length} item bahan baku
      </div>
    </div>
  );
}
