'use client';

import React, { useState, useMemo } from 'react';
import { StatusBadge } from './StatusBadge';
import type { MonitoringItem } from '@/lib/types/monitoring';

interface CrewListProps {
  items: MonitoringItem[];
  onItemClick: (item: MonitoringItem) => void;
}

type SortBy = 'status' | 'name';

export function CrewList({ items, onItemClick }: CrewListProps) {
  const [sortBy, setSortBy] = useState<SortBy>('status');
  const [filterStatus, setFilterStatus] = useState<'all' | 'below' | 'flagged'>('all');

  const filteredAndSorted = useMemo(() => {
    let result = items;

    // Filter
    if (filterStatus === 'below') {
      result = result.filter((item) => item.status === 'below');
    } else if (filterStatus === 'flagged') {
      result = result.filter((item) => item.is_flagged);
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
  }, [items, sortBy, filterStatus]);

  const belowCount = items.filter((item) => item.status === 'below').length;
  const flaggedCount = items.filter((item) => item.is_flagged).length;
  const okCount = items.filter((item) => item.status === 'ok' && !item.is_flagged).length;

  return (
    <div className="space-y-4">
      {/* Summary counts */}
      <div className="grid grid-cols-3 gap-4">
        <button
          onClick={() => setFilterStatus(filterStatus === 'below' ? 'all' : 'below')}
          className={`p-4 rounded-lg border-2 text-center transition-colors ${
            filterStatus === 'below'
              ? 'bg-red-50 border-red-300'
              : 'bg-gray-50 border-gray-200 hover:border-red-200'
          }`}
        >
          <div className="text-2xl font-bold text-red-700">{belowCount}</div>
          <div className="text-sm text-gray-600">Below Threshold</div>
        </button>

        <button
          onClick={() => setFilterStatus(filterStatus === 'flagged' ? 'all' : 'flagged')}
          className={`p-4 rounded-lg border-2 text-center transition-colors ${
            filterStatus === 'flagged'
              ? 'bg-orange-50 border-orange-300'
              : 'bg-gray-50 border-gray-200 hover:border-orange-200'
          }`}
        >
          <div className="text-2xl font-bold text-orange-700">{flaggedCount}</div>
          <div className="text-sm text-gray-600">Flagged Discrepancies</div>
        </button>

        <div className="p-4 rounded-lg border-2 border-green-200 bg-green-50 text-center">
          <div className="text-2xl font-bold text-green-700">{okCount}</div>
          <div className="text-sm text-gray-600">OK</div>
        </div>
      </div>

      {/* Sort dropdown */}
      <div className="flex gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="sort"
            value="status"
            checked={sortBy === 'status'}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
          />
          Sort by Status
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="sort"
            value="name"
            checked={sortBy === 'name'}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
          />
          Sort by Name
        </label>
      </div>

      {/* Items list */}
      <div className="space-y-2">
        {filteredAndSorted.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {filterStatus === 'all' ? 'No items found' : `No ${filterStatus} items`}
          </div>
        ) : (
          filteredAndSorted.map((item) => (
            <div
              key={item.bahan_baku_id}
              onClick={() => onItemClick(item)}
              className="flex justify-between items-center p-4 border border-gray-200 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors min-h-[56px]"
            >
              <div className="flex-1">
                <div className="font-medium text-gray-900">{item.item_name}</div>
                <div className="text-sm text-gray-600">
                  {item.current_qty} / {item.threshold} {item.threshold === 0 ? '(no threshold)' : ''}
                </div>
              </div>
              <StatusBadge status={item.status} isFlagged={item.is_flagged} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
