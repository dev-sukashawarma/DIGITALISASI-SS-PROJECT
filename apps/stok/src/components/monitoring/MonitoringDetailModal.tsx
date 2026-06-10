'use client';

import React, { useEffect, useState } from 'react';
import { StatusBadge } from './StatusBadge';
import { fetchItemDetail } from '@/lib/queries/monitoring';
import type { MonitoringItem, DetailItem } from '@/lib/types/monitoring';

interface MonitoringDetailModalProps {
  item: MonitoringItem;
  onClose: () => void;
  isOpen: boolean;
}

export function MonitoringDetailModal({ item, onClose, isOpen }: MonitoringDetailModalProps) {
  const [detail, setDetail] = useState<DetailItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    setError(null);

    fetchItemDetail(item.outlet_id, item.bahan_baku_id)
      .then(setDetail)
      .catch((err) => setError(err?.message || 'Failed to load details'))
      .finally(() => setIsLoading(false));
  }, [isOpen, item.outlet_id, item.bahan_baku_id]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-suka-brown to-suka-orange p-6 text-white flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold">{item.item_name}</h2>
            <p className="text-sm opacity-90 mt-1">{item.outlet_name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-2xl leading-none opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {isLoading ? (
            <div className="text-center py-8 text-gray-600">Loading details...</div>
          ) : error ? (
            <div className="bg-red-50 text-red-700 p-4 rounded border border-red-200">
              Error: {error}
            </div>
          ) : detail ? (
            <>
              {/* Current Status */}
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600">Current Qty</p>
                  <p className="text-3xl font-bold text-suka-brown">{detail.current_qty}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Threshold</p>
                  <p className="text-3xl font-bold text-gray-700">{detail.threshold}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <div className="mt-2">
                    <StatusBadge status={detail.status} isFlagged={detail.is_flagged} />
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Last Opname</p>
                  <p className="text-lg font-medium text-gray-700">
                    {detail.last_opname_date
                      ? new Date(detail.last_opname_date).toLocaleDateString('id-ID')
                      : 'Never'}
                  </p>
                </div>
              </div>

              {/* Discrepancy Details */}
              {detail.discrepancy_details && (
                <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
                  <h3 className="font-semibold text-orange-900 mb-3">Flagged Discrepancy</h3>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Type:</dt>
                      <dd className="font-medium capitalize">{detail.discrepancy_details.type.replace('_', ' ')}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-600">System Qty:</dt>
                      <dd className="font-medium">{detail.discrepancy_details.qty_system}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Physical Qty:</dt>
                      <dd className="font-medium">{detail.discrepancy_details.qty_fisik}</dd>
                    </div>
                    {detail.discrepancy_details.catatan && (
                      <div className="mt-3 pt-3 border-t border-orange-200">
                        <dt className="text-gray-600 mb-1">Notes:</dt>
                        <dd className="font-medium text-gray-700">{detail.discrepancy_details.catatan}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}

              {/* Recent Ledger */}
              {detail.recent_ledger && detail.recent_ledger.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Recent Movements</h3>
                  <div className="space-y-2">
                    {detail.recent_ledger.map((ledger, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-start p-3 border border-gray-200 rounded"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 capitalize">{ledger.type.replace('_', ' ')}</p>
                          {ledger.notes && (
                            <p className="text-sm text-gray-600 mt-1">{ledger.notes}</p>
                          )}
                          <p className="text-xs text-gray-500 mt-2">
                            {new Date(ledger.created_at).toLocaleString('id-ID')}
                          </p>
                        </div>
                        <p className="font-bold text-gray-900 whitespace-nowrap ml-4">
                          {ledger.qty > 0 ? '+' : ''}{ledger.qty}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Last Updated */}
              <div className="border-t border-gray-200 pt-4 text-sm text-gray-600">
                <p>Last updated: {new Date(detail.last_updated).toLocaleString('id-ID')}</p>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 p-6 border-t flex gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
