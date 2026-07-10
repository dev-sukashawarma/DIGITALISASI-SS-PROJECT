'use client';

import { useNetworkStatus } from '@/lib/useNetworkStatus';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { WifiOff, RefreshCw } from 'lucide-react';

export default function NetworkIndicator() {
  const isOnline = useNetworkStatus();

  // Jumlah pekerjaan offline yang menunggu sinkron (order baru + perubahan status)
  const pendingCount = useLiveQuery(async () => {
    const [orders, mutations] = await Promise.all([
      db.sync_queue_orders.where('status').equals('pending').count(),
      db.sync_queue_mutations.where('status').equals('pending').count(),
    ]);
    return orders + mutations;
  }, [], 0);

  if (isOnline && pendingCount === 0) {
    return null;
  }

  if (!isOnline) {
    return (
      <div className="fixed bottom-4 left-4 z-[9999] bg-orange-100 text-orange-700 text-xs font-semibold py-1.5 px-3 rounded-full shadow-md flex items-center justify-center space-x-2 print:hidden border border-orange-200 opacity-90 hover:opacity-100 transition-opacity">
        <WifiOff className="w-3.5 h-3.5" />
        <span>
          Mode Offline — transaksi tersimpan di perangkat
          {pendingCount > 0 ? ` (${pendingCount} menunggu sinkron)` : ''}
        </span>
      </div>
    );
  }

  // Online tapi masih ada antrean → sedang menyinkronkan
  return (
    <div className="fixed bottom-4 left-4 z-[9999] bg-blue-100 text-blue-700 text-xs font-semibold py-1.5 px-3 rounded-full shadow-md flex items-center justify-center space-x-2 print:hidden border border-blue-200 opacity-90 hover:opacity-100 transition-opacity">
      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
      <span>Menyinkronkan {pendingCount} transaksi offline...</span>
    </div>
  );
}
