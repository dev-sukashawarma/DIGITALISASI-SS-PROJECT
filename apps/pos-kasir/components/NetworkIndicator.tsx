'use client';

import { useNetworkStatus } from '@/lib/useNetworkStatus';
import { Wifi, WifiOff } from 'lucide-react';

export default function NetworkIndicator() {
  const isOnline = useNetworkStatus();

  if (isOnline) {
    return null; // Don't show anything when online, or we can show a brief "Online" toast
  }

  return (
    <div className="bg-red-500 text-white text-sm font-medium py-1 px-4 flex items-center justify-center space-x-2 animate-pulse print:hidden">
      <WifiOff className="w-4 h-4" />
      <span>Offline Mode - Data disinkronkan saat online</span>
    </div>
  );
}
