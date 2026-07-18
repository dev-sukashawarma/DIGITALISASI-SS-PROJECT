'use client';

import { useEffect, useRef } from 'react';
import { db } from '@/lib/db';
import { patchCachedOrder } from '@/lib/offline';
import { createClient } from '@/lib/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Menyinkronkan semua pekerjaan offline dari IndexedDB ke server saat online:
 * 1. `sync_queue_orders`  — pesanan yang dibuat offline (POST ulang ke API).
 *    Setelah sukses: hapus pesanan lokal dari papan + remap mutasi status
 *    yang menunggu dari id lokal → id server.
 * 2. `sync_queue_mutations` — perubahan status (Mulai Masak / Selesai / Batal)
 *    yang dilakukan offline, di-replay via Supabase.
 */
export default function OfflineSyncManager() {
  const queryClient = useQueryClient();
  const isSyncingRef = useRef(false);

  useEffect(() => {
    const syncOrderCreations = async (): Promise<boolean> => {
      const pendingOrders = await db.sync_queue_orders
        .where('status').equals('pending')
        .sortBy('created_at');

      if (pendingOrders.length === 0) return false;

      console.log(`[SyncManager] Sinkronisasi ${pendingOrders.length} pesanan offline...`);
      let hasSuccess = false;

      for (const entry of pendingOrders) {
        try {
          const { url, ...options } = entry.payload;
          const res = await fetch(url, {
            ...options,
            headers: {
              ...options.headers,
              'Content-Type': 'application/json',
            },
          });

          if (res.ok) {
            const data = await res.json().catch(() => ({} as any));
            hasSuccess = true;

            if (entry.local_order_id) {
              const serverId: string | undefined = data.order_id;
              // Remap mutasi status yang dicatat saat order masih lokal
              const localMutations = await db.sync_queue_mutations
                .where('order_id').equals(entry.local_order_id).toArray();
              for (const m of localMutations) {
                if (serverId) {
                  await db.sync_queue_mutations.update(m.id, { order_id: serverId, is_local: 0 });
                } else {
                  // Tidak bisa remap tanpa id server — buang agar tidak macet
                  await db.sync_queue_mutations.delete(m.id);
                }
              }
              await db.local_orders.delete(entry.local_order_id);
            }

            await db.sync_queue_orders.delete(entry.id);
            console.log(`[SyncManager] Pesanan offline ${entry.id} berhasil dikirim.`);
          } else if (res.status >= 500 || res.status === 429 || res.status === 401) {
            // Server error sementara atau token expired (401) -> biarkan pending agar di-retry nanti
            console.warn(`[SyncManager] Server error / auth expired ${res.status} untuk pesanan ${entry.id}, akan di-retry.`);
            await db.sync_queue_orders.update(entry.id, {
              error_message: `Menunggu retry (Server Error ${res.status})`,
            });
          } else {
            const data = await res.json().catch(() => ({} as any));
            console.error(`[SyncManager] Gagal sinkron pesanan ${entry.id}:`, data);
            await db.sync_queue_orders.update(entry.id, {
              status: 'error',
              error_message: data.error || data.message || `Client Error ${res.status}`,
            });
            if (entry.local_order_id) {
              const local = await db.local_orders.get(entry.local_order_id);
              if (local) {
                await db.local_orders.update(entry.local_order_id, {
                  sync_error: data.error || data.message || `Client Error ${res.status}`,
                });
              }
            }
          }
        } catch (error) {
          // Jaringan masih bermasalah / fetch error -> biarkan pending, lanjut ke entry berikutnya
          console.warn(`[SyncManager] Network error saat sinkron pesanan ${entry.id}, lanjut...`, error);
          continue;
        }
      }

      return hasSuccess;
    };

    const syncStatusMutations = async (): Promise<boolean> => {
      // Hanya mutasi yang order-nya sudah punya id server (is_local = 0)
      const pendingMutations = (await db.sync_queue_mutations
        .where('status').equals('pending')
        .sortBy('created_at'))
        .filter((m) => m.is_local === 0);

      if (pendingMutations.length === 0) return false;

      console.log(`[SyncManager] Sinkronisasi ${pendingMutations.length} perubahan status offline...`);
      const supabase = createClient();
      let hasSuccess = false;

      for (const m of pendingMutations) {
        try {
          const { error } = await supabase
            .from('orders')
            .update(m.patch)
            .eq('id', m.order_id);

          if (error) {
            // Error dari server (bukan jaringan) → tandai error supaya tidak looping
            const netErr = /fetch|network|failed/i.test(error.message || '');
            if (netErr) continue;
            console.error(`[SyncManager] Gagal replay status ${m.order_id}:`, error);
            await db.sync_queue_mutations.update(m.id, { status: 'error', error_message: error.message });
            continue;
          }

          await patchCachedOrder(m.order_id, m.patch).catch(() => {});
          await db.sync_queue_mutations.delete(m.id);
          hasSuccess = true;
        } catch (err) {
          console.warn('[SyncManager] Network error saat replay status, lanjut...', err);
          continue;
        }
      }

      return hasSuccess;
    };

    const runSync = async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;

      try {
        const createdAny = await syncOrderCreations();
        const mutatedAny = await syncStatusMutations();

        if (createdAny || mutatedAny) {
          queryClient.invalidateQueries({ queryKey: ['orders'] });
          queryClient.invalidateQueries({ queryKey: ['histori'] });
          queryClient.invalidateQueries({ queryKey: ['target_progress'] });
        }
      } catch (err) {
        console.error('[SyncManager] Error dalam antrean sinkronisasi:', err);
      } finally {
        isSyncingRef.current = false;
      }
    };

    // Sinkronisasi saat mount, saat kembali online, dan polling tiap 30 detik
    runSync();
    window.addEventListener('online', runSync);
    const interval = setInterval(runSync, 30000);

    return () => {
      window.removeEventListener('online', runSync);
      clearInterval(interval);
    };
  }, [queryClient]);

  return null;
}
