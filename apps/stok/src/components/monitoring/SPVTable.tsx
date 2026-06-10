'use client';

import React, { useState, useMemo } from 'react';
import { StatusBadge } from './StatusBadge';
import type { MonitoringItem } from '@/lib/types/monitoring';

interface SPVTableProps {
  items: MonitoringItem[];
  tab: 'overview' | 'alerts' | 'compliance';
  onRowClick: (item: MonitoringItem) => void;
}

type SortField = 'outlet_name' | 'item_name' | 'status' | 'last_updated';
type SortDir = 'asc' | 'desc';

export function SPVTable({ items, tab, onRowClick }: SPVTableProps) {
  const [sortField, setSortField] = useState<SortField>('outlet_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filterStatus, setFilterStatus] = useState<'all' | 'below' | 'warning' | 'ok'>('all');
  const [filterOutlet, setFilterOutlet] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredItems = useMemo(() => {
    let result = items;

    // Filter by tab
    if (tab === 'alerts') {
      result = result.filter((item) => item.status !== 'ok' || item.is_flagged);
    } else if (tab === 'compliance') {
      result = result.filter((item) => item.is_flagged);
    }

    // Filter by status
    if (filterStatus !== 'all') {
      result = result.filter((item) => item.status === filterStatus);
    }

    // Filter by outlet
    if (filterOutlet) {
      result = result.filter((item) => item.outlet_id === filterOutlet);
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

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [items, tab, filterStatus, filterOutlet, searchTerm, sortField, sortDir]);

  const uniqueOutlets = useMemo(
    () => Array.from(new Set(items.map((item) => item.outlet_id))),
    [items]
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4 flex-wrap bg-gray-50 p-4 rounded-lg">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search item..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
          />
        </div>

        <select
          value={filterOutlet}
          onChange={(e) => setFilterOutlet(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded text-sm"
        >
          <option value="">All Outlets</option>
          {uniqueOutlets.map((outletId) => {
            const outletName = items.find((item) => item.outlet_id === outletId)?.outlet_name;
            return (
              <option key={outletId} value={outletId}>
                {outletName}
              </option>
            );
          })}
        </select>

        <div className="flex gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="status"
              value="all"
              checked={filterStatus === 'all'}
              onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
            />
            All
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="status"
              value="below"
              checked={filterStatus === 'below'}
              onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
            />
            Below
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="status"
              value="warning"
              checked={filterStatus === 'warning'}
              onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
            />
            Warning
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="status"
              value="ok"
              checked={filterStatus === 'ok'}
              onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
            />
            OK
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="monitoring-table w-full">
          <thead className="monitoring-sticky-header">
            <tr>
              <th>
                <button
                  onClick={() => handleSort('outlet_name')}
                  className="hover:text-blue-600"
                >
                  Outlet {sortField === 'outlet_name' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th>
                <button
                  onClick={() => handleSort('item_name')}
                  className="hover:text-blue-600"
                >
                  Item {sortField === 'item_name' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th className="text-right">Qty Now</th>
              <th className="text-right">Threshold</th>
              <th>
                <button
                  onClick={() => handleSort('status')}
                  className="hover:text-blue-600"
                >
                  Status {sortField === 'status' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th className="hidden md:table-cell">
                <button
                  onClick={() => handleSort('last_updated')}
                  className="hover:text-blue-600"
                >
                  Updated {sortField === 'last_updated' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-500">
                  No items found
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr
                  key={`${item.outlet_id}-${item.bahan_baku_id}`}
                  onClick={() => onRowClick(item)}
                  className="hover:bg-blue-50 cursor-pointer"
                >
                  <td className="monitoring-outlet-col font-medium">{item.outlet_name}</td>
                  <td>{item.item_name}</td>
                  <td className="text-right">{item.current_qty}</td>
                  <td className="text-right">{item.threshold}</td>
                  <td>
                    <StatusBadge status={item.status} isFlagged={item.is_flagged} />
                  </td>
                  <td className="hidden md:table-cell text-sm text-gray-600">
                    {new Date(item.last_updated).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="text-sm text-gray-500">
        Showing {filteredItems.length} of {items.length} items
      </div>
    </div>
  );
}
