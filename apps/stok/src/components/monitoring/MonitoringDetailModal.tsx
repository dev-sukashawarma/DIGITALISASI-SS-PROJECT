'use client';

import React from 'react';
import type { MonitoringItem } from '@/lib/types/monitoring';

interface MonitoringDetailModalProps {
  item: MonitoringItem;
  isOpen: boolean;
  onClose: () => void;
}

export function MonitoringDetailModal({ item, isOpen, onClose }: MonitoringDetailModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-lg w-full mx-4">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold">{item.item_name}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Outlet</p>
              <p className="font-medium">{item.outlet_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <p className="font-medium capitalize">{item.status}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Current Qty</p>
              <p className="font-medium">{item.current_qty}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Threshold</p>
              <p className="font-medium">{item.threshold}</p>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <p className="text-sm text-gray-600">Last Updated</p>
            <p className="font-medium">
              {new Date(item.last_updated).toLocaleString('id-ID')}
            </p>
          </div>

          {item.last_opname_date && (
            <div className="border-t border-gray-200 pt-4">
              <p className="text-sm text-gray-600">Last Opname</p>
              <p className="font-medium">
                {new Date(item.last_opname_date).toLocaleString('id-ID')}
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
