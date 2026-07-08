'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/db';
import { useQueryClient } from '@tanstack/react-query';

export default function OfflineSyncManager() {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const syncPendingOrders = async () => {
      if (!navigator.onLine || isSyncing) return;

      try {
        setIsSyncing(true);
        const pendingOrders = await db.sync_queue_orders
          .where('status')
          .equals('pending')
          .toArray();

        if (pendingOrders.length === 0) {
          setIsSyncing(false);
          return;
        }

        console.log(`[SyncManager] Memulai sinkronisasi ${pendingOrders.length} pesanan offline...`);

        let hasSuccess = false;

        for (const order of pendingOrders) {
          try {
            const { url, ...options } = order.payload;
            const res = await fetch(url, {
              ...options,
              headers: {
                ...options.headers,
                'Content-Type': 'application/json'
              },
            });

            if (res.ok) {
              await db.sync_queue_orders.update(order.id, { status: 'synced' });
              hasSuccess = true;
              console.log(`[SyncManager] Pesanan offline ${order.id} berhasil dikirim.`);
            } else {
              const data = await res.json().catch(() => ({}));
              console.error(`[SyncManager] Gagal sinkron pesanan ${order.id}:`, data);
              await db.sync_queue_orders.update(order.id, { 
                status: 'error', 
                error_message: data.error || 'Server error' 
              });
            }
          } catch (error: any) {
            console.error(`[SyncManager] Network error saat sinkron pesanan ${order.id}:`, error);
            // Tetap pending jika gagal jaringan agar di-retry nanti
          }
        }

        if (hasSuccess) {
          queryClient.invalidateQueries({ queryKey: ['orders'] });
        }
      } catch (err) {
        console.error('[SyncManager] Error dalam antrean sinkronisasi:', err);
      } finally {
        setIsSyncing(false);
      }
    };

    // Sinkronisasi saat komponen dimount dan online
    syncPendingOrders();

    // Dengarkan event online untuk memulai sync otomatis
    window.addEventListener('online', syncPendingOrders);
    
    // Polling setiap 30 detik untuk mencoba ulang yang gagal atau pending lama
    const interval = setInterval(() => {
      syncPendingOrders();
    }, 30000);

    return () => {
      window.removeEventListener('online', syncPendingOrders);
      clearInterval(interval);
    };
  }, [isSyncing, queryClient]);

  return null;
}
