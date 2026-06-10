'use client';

import React from 'react';
import type { StockStatus } from '@/lib/types/monitoring';

interface StatusBadgeProps {
  status: StockStatus;
  isFlagged?: boolean;
}

export function StatusBadge({ status, isFlagged }: StatusBadgeProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'below':
        return 'bg-red-100 text-red-800 border border-red-300';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border border-yellow-300';
      case 'ok':
        return 'bg-green-100 text-green-800 border border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-300';
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case 'below':
        return 'Below Threshold';
      case 'warning':
        return 'Warning';
      case 'ok':
        return 'OK';
      default:
        return status;
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor()}`}>
        {getStatusLabel()}
      </span>
      {isFlagged && <span className="text-red-600 font-bold">*</span>}
    </div>
  );
}
