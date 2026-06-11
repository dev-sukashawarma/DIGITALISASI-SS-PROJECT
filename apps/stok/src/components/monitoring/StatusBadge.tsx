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
        return 'bg-[#ba1a1a]/10 text-[#ba1a1a] border border-[#ba1a1a]/20';
      case 'warning':
        return 'bg-[#fd7e62]/10 text-[#a43c26] border border-[#fd7e62]/20';
      case 'ok':
        return 'bg-[#006e24]/10 text-[#006e24] border border-[#006e24]/20';
      default:
        return 'bg-gray-100 text-gray-700 border border-gray-200';
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
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor()}`}>
        {getStatusLabel()}
      </span>
      {isFlagged && <span className="text-[#ba1a1a] font-bold">*</span>}
    </div>
  );
}
