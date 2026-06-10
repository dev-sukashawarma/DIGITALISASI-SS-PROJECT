'use client';

import React, { useState, useMemo } from 'react';
import type { MonitoringItem } from '@/lib/types/monitoring';

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
}

type SortField = 'item_name' | 'status' | 'last_updated' | 'last_opname_date' | 'outlet_name';
type SortDir = 'asc' | 'desc';

export function SPVTable({
  items,
  tab,
  onRowClick,
  selectedOutletId,
  onThresholdChange,
  onRestockRequest,
  onTransferRequest,
  searchTerm: externalSearchTerm,
  filterStatus: externalFilterStatus,
  hideFilters = false,
}: SPVTableProps) {
  const [sortField, setSortField] = useState<SortField>('item_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [internalFilterStatus, setInternalFilterStatus] = useState<'all' | 'below' | 'warning' | 'ok'>('all');
  const [internalSearchTerm, setInternalSearchTerm] = useState('');
  
  const filterStatus = externalFilterStatus !== undefined ? externalFilterStatus : internalFilterStatus;
  const searchTerm = externalSearchTerm !== undefined ? externalSearchTerm : internalSearchTerm;
  
  // Track threshold editing state
  const [editingId, setEditingId] = useState<string | null>(null); // format: `${outlet_id}-${bahan_baku_id}`
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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const startEditing = (item: MonitoringItem, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click details modal
    setEditingId(`${item.outlet_id}-${item.bahan_baku_id}`);
    setEditingValue(item.threshold.toString());
  };

  const cancelEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const saveEditing = (item: MonitoringItem, e: React.MouseEvent) => {
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
      <div className="overflow-x-auto border border-suka-brown/10 rounded-xl shadow-sm bg-white">
        <table className="w-full text-left border-collapse text-suka-ink">
          <thead>
            <tr className="bg-suka-cream/20 text-suka-brown border-b border-suka-brown/10 text-xs font-bold uppercase tracking-wider">
              {tab === 'alerts' && (
                <th className="p-4">
                  <button onClick={() => handleSort('outlet_name')} className="hover:text-suka-orange font-bold">
                    Outlet {sortField === 'outlet_name' && (sortDir === 'asc' ? '↑' : '↓')}
                  </button>
                </th>
              )}
              <th className="p-4">
                <button onClick={() => handleSort('item_name')} className="hover:text-suka-orange font-bold">
                  Nama Bahan {sortField === 'item_name' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th className="p-4 text-right">Stok Aktual</th>
              <th className="p-4 text-right">Threshold</th>
              <th className="p-4">Opname Terakhir</th>
              <th className="p-4">
                <button onClick={() => handleSort('status')} className="hover:text-suka-orange font-bold">
                  Status {sortField === 'status' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th className="p-4 text-center">Tindakan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-suka-brown/10">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={tab === 'alerts' ? 7 : 6} className="text-center py-8 text-suka-brown/50 text-sm">
                  Tidak ada data bahan baku ditemukan
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const editKey = `${item.outlet_id}-${item.bahan_baku_id}`;
                const isEditing = editingId === editKey;

                return (
                  <tr
                    key={editKey}
                    onClick={() => onRowClick(item)}
                    className="hover:bg-suka-cream/10 cursor-pointer text-sm transition-colors"
                  >
                    {tab === 'alerts' && (
                      <td className="p-4 font-bold text-suka-brown">{item.outlet_name}</td>
                    )}
                    <td className="p-4">
                      <div className="font-bold text-sm text-suka-ink uppercase tracking-wide">{item.item_name}</div>
                      <div className="text-xs text-suka-brown/60 mt-0.5">
                        {item.item_name.includes('Ayam') ? 'Frozen Breast' :
                         item.item_name.includes('Bawang') ? 'Red Onion' :
                         item.item_name.includes('Cengkeh') ? 'Spice Powder' :
                         item.item_name.includes('Foil') ? 'Packaging Roll' : 'Bahan Baku'}
                      </div>
                    </td>
                    <td className={`p-4 font-bold text-sm text-right ${
                      item.status === 'below' ? 'text-red-600' :
                      item.status === 'warning' ? 'text-orange-600' : 'text-green-700'
                    }`}>
                      {item.current_qty}{' '}
                      <span className="text-xs font-normal text-suka-brown/50">
                        {item.satuan || 'kg'}
                      </span>
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
                          <button
                            onClick={(e) => startEditing(item, e)}
                            className="p-1 text-suka-brown/40 hover:text-suka-orange rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Ubah Threshold"
                          >
                            ✎
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-xs font-medium text-suka-brown/80">
                      {getRelativeTimeString(item.last_opname_date)}
                    </td>
                    <td className="p-4">
                      {item.status === 'below' && (
                        <span className="bg-red-50 text-red-700 border border-red-200/80 px-2.5 py-1 rounded-md font-bold text-[11px] uppercase tracking-wide">
                          Below Threshold
                        </span>
                      )}
                      {item.status === 'warning' && (
                        <span className="bg-orange-50 text-orange-700 border border-orange-200/80 px-2.5 py-1 rounded-md font-bold text-[11px] uppercase tracking-wide">
                          Warning Threshold
                        </span>
                      )}
                      {item.status === 'ok' && (
                        <span className="bg-green-50 text-green-700 border border-green-200/80 px-2.5 py-1 rounded-md font-bold text-[11px] uppercase tracking-wide">
                          OK
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-2">
                        {item.status !== 'ok' ? (
                          <>
                            <button
                              onClick={() => onRestockRequest?.(item)}
                              className="px-3 py-1.5 bg-[#701604] text-white text-xs font-bold rounded-lg hover:opacity-90 transition-all shadow-sm"
                            >
                              Minta Pusat
                            </button>
                            <button
                              onClick={() => onTransferRequest?.(item)}
                              className="px-3 py-1.5 border border-[#701604] text-[#701604] text-xs font-bold rounded-lg hover:bg-[#701604]/5 transition-colors"
                            >
                              Transfer
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => onRestockRequest?.(item)}
                              className="px-3 py-1.5 text-suka-brown/60 hover:text-suka-orange text-xs font-bold hover:underline transition-all"
                            >
                              Minta Pusat
                            </button>
                            <button
                              onClick={() => onTransferRequest?.(item)}
                              className="px-3 py-1.5 text-suka-brown/60 hover:text-suka-orange text-xs font-bold hover:underline transition-all"
                            >
                              Transfer
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-suka-brown/50 font-medium">
        Menampilkan {filteredItems.length} item bahan baku
      </div>
    </div>
  );
}
