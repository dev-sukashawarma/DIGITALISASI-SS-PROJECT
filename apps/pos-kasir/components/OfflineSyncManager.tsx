'use client';

import { useEffect, useRef } from 'react';
import { db } from '@/lib/db';
import { patchCachedOrder } from '@/lib/offline';
import { createClient } from '@/lib/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { classifySyncFailure, backoffDelayMs } from '@/lib/syncClassify';

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
      const now = Date.now();
      const pendingOrders = (await db.sync_queue_orders
        .where('status').equals('pending')
        .sortBy('created_at'))
        .filter((e) => !e.next_attempt_at || e.next_attempt_at <= now);

      if (pendingOrders.length === 0) return false;

      console.log(`[SyncManager] Sinkronisasi ${pendingOrders.length} pesanan offline...`);
      let hasSuccess = false;

      for (const entry of pendingOrders) {
        const attempts = (entry.attempts ?? 0) + 1;
        try {
          const { url, ...options } = entry.payload;
          const res = await fetch(url, {
            ...options,
            headers: { ...options.headers, 'Content-Type': 'application/json' },
          });

          if (res.ok) {
            const data = await res.json().catch(() => ({} as any));
            hasSuccess = true;

            if (entry.local_order_id) {
              const serverId: string | undefined = data.order_id;
              const localMutations = await db.sync_queue_mutations
                .where('order_id').equals(entry.local_order_id).toArray();
              for (const m of localMutations) {
                if (serverId) {
                  await db.sync_queue_mutations.update(m.id, { order_id: serverId, is_local: 0 });
                } else {
                  await db.sync_queue_mutations.delete(m.id);
                }
              }
              await db.local_orders.delete(entry.local_order_id);
            }

            await db.sync_queue_orders.delete(entry.id);
            console.log(`[SyncManager] Pesanan offline ${entry.id} berhasil dikirim (order #${data.order_number}).`);
            continue;
          }

          const data = await res.json().catch(() => ({} as any));
          const message = data.error || data.message || `HTTP ${res.status}`;

          if (classifySyncFailure(res.status) === 'retry') {
            // Bisa pulih sendiri: mundur sejenak, jangan matikan antrean.
            await db.sync_queue_orders.update(entry.id, {
              attempts,
              next_attempt_at: Date.now() + backoffDelayMs(attempts),
              error_message: `Menunggu percobaan ulang (${message})`,
            });
            console.warn(`[SyncManager] ${res.status} untuk ${entry.id}, dicoba lagi nanti.`);
            continue;
          }

          // Penolakan yang tidak akan berubah dengan sendirinya. JANGAN dihapus
          // -- uangnya sudah diterima kasir. Serahkan ke daftar Perlu Perhatian.
          console.error(`[SyncManager] Ditolak permanen ${entry.id}:`, message);
          await db.sync_queue_orders.update(entry.id, {
            status: 'error',
            attempts,
            error_message: message,
          });
          if (entry.local_order_id) {
            await db.local_orders.update(entry.local_order_id, {
              sync_error: message,
              needs_attention: 1,
            });
          }
        } catch (error) {
          // Jaringan masih bermasalah: biarkan pending, coba lagi siklus berikutnya.
          console.warn(`[SyncManager] Network error saat sinkron ${entry.id}, lanjut...`, error);
          await db.sync_queue_orders.update(entry.id, {
            attempts,
            next_attempt_at: Date.now() + backoffDelayMs(attempts),
          });
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
        // Tidak ada pembersihan otomatis. Order offline yang gagal sinkron
        // TIDAK boleh dihapus diam-diam -- uangnya sudah diterima kasir.
        // Order bermasalah muncul di panel "Perlu Perhatian" (KasirOrderClient)
        // dan hanya hilang lewat tindakan sadar kasir.
        
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
