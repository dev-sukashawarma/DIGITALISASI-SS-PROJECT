'use client';

import { useNetworkStatus } from '@/lib/useNetworkStatus';
import { Wifi, WifiOff } from 'lucide-react';

export default function NetworkIndicator() {
  const isOnline = useNetworkStatus();

  if (isOnline) {
    return null; // Don't show anything when online, or we can show a brief "Online" toast
  }

  return (
    <div className="fixed bottom-4 left-4 z-[9999] bg-orange-100 text-orange-600 text-xs font-semibold py-1.5 px-3 rounded-full shadow-md flex items-center justify-center space-x-2 print:hidden border border-orange-200 opacity-80 hover:opacity-100 transition-opacity">
      <WifiOff className="w-3.5 h-3.5" />
      <span>Offline</span>
    </div>
  );
}
