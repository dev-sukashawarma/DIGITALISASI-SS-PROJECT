'use client';

import React from 'react';
import type { StockStatus } from '@/lib/types/monitoring';

interface StatusBadgeProps {
  status: StockStatus;
  isFlagged?: boolean;
  className?: string;
}

export function StatusBadge({
  status,
  isFlagged = false,
  className = '',
}: StatusBadgeProps) {
  const baseClass = 'inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium';

  const statusStyles = {
    below: 'bg-red-100 text-red-700',
    warning: 'bg-yellow-100 text-yellow-700',
    ok: 'bg-green-100 text-green-700',
  };

  const statusEmoji = {
    below: '🔴',
    warning: '🟡',
    ok: '✅',
  };

  return (
    <span className={`${baseClass} ${statusStyles[status]} ${className}`}>
      {statusEmoji[status]}
      {isFlagged && <span className="text-base">📌</span>}
      <span className="capitalize">{status}</span>
    </span>
  );
}
