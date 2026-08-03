import { db, type LocalOrderRow } from '@/lib/db';
import type { OrderItem, OrderWithItems } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Util deteksi error jaringan (fetch gagal / offline) vs error bisnis dari server
// ─────────────────────────────────────────────────────────────────────────────
export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : (err as any)?.message ?? '';
  return /fetch|network|failed to|load failed|timeout|abort/i.test(String(msg));
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache pesanan (papan order / histori)
// ─────────────────────────────────────────────────────────────────────────────
const ORDER_CACHE_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000; // 3 hari

export async function cacheOrders(outletId: string, orders: OrderWithItems[]) {
  const now = Date.now();
  await db.orders_cache.bulkPut(
    orders.map((o) => ({
      id: o.id,
      outlet_id: outletId,
      status: o.status,
      created_at: o.created_at,
      data: o,
      synced_at: now,
    }))
  );
  // Bersihkan entri lama supaya IndexedDB tidak membengkak
  const cutoff = new Date(now - ORDER_CACHE_MAX_AGE_MS).toISOString();
  await db.orders_cache.where('created_at').below(cutoff).delete();
}

/**
 * Baca pesanan dari cache dengan filter yang sama seperti query papan order:
 * dibuat hari ini ATAU masih aktif (pending/preparing).
 */
export async function readCachedTodayOrders(outletId: string): Promise<OrderWithItems[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rows = await db.orders_cache.where('outlet_id').equals(outletId).toArray();
  return rows
    .filter((r) => new Date(r.created_at) >= today || r.status === 'pending' || r.status === 'preparing')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((r) => r.data);
}

export async function readCachedOrders(outletId: string): Promise<OrderWithItems[]> {
  const rows = await db.orders_cache.where('outlet_id').equals(outletId).toArray();
  return rows
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((r) => r.data);
}

/** Terapkan perubahan status ke cache supaya bertahan setelah reload offline. */
export async function patchCachedOrder(orderId: string, patch: Record<string, any>) {
  const row = await db.orders_cache.get(orderId);
  if (!row) return;
  await db.orders_cache.put({
    ...row,
    status: patch.status ?? row.status,
    data: { ...row.data, ...patch },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
/**
 * Perkiraan nomor antrian untuk order yang dibuat saat offline.
 *
 * Server tetap satu-satunya yang membagi nomor final (trigger
 * assign_order_number). Fungsi ini hanya menebak angka yang WAJAR untuk
 * dicetak di struk, berdasarkan nomor server tertinggi yang diketahui
 * device hari ini ditambah jumlah order offline yang sudah antre.
 *
 * Dengan satu device per outlet dan offline hitungan menit, tebakan ini
 * hampir selalu tepat. Kalau meleset (ada order online masuk selagi
 * offline), papan kasir memperbarui nomornya begitu tersinkron.
 *
 * Nomor 9000-an dari build lama sengaja diabaikan supaya cache basi tidak
 * menyeret nomor hari ini ke range itu lagi.
 */
const LEGACY_LOCAL_NUMBER_FLOOR = 9000;

export function estimateOrderNumber(knownNumbers: number[], pendingLocalCount: number): number {
  const valid = knownNumbers.filter(
    (n) => Number.isFinite(n) && n > 0 && n < LEGACY_LOCAL_NUMBER_FLOOR
  );
  const highest = valid.length > 0 ? Math.max(...valid) : 0;
  return highest + pendingLocalCount + 1;
}

export interface LocalOrderItemInput {
  menu_item_id: string;
  name: string;
  note?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

/** Snapshot transaksi apa adanya — harga TIDAK dihitung ulang di server. */
export interface OfflineIngestPayload {
  client_order_id: string;
  outlet_id: string;
  created_at: string;
  source: 'pos' | 'manual';
  channel: string | null;
  payment_method: string;
  customer_name: string | null;
  total_amount: number;
  discount_amount: number | null;
  promo_subsidy: number;
  amount_received: number | null;
  change_amount: number | null;
  payment_proof_url: string | null;
  items: Array<{
    menu_item_id: string | null;
    menu_item_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    package_choices?: Record<string, string> | null;
  }>;
}

export interface CreateLocalOrderInput {
  outletId: string;
  items: LocalOrderItemInput[];
  payment_method: string;
  customer_name: string | null;
  total_amount: number;
  discount_amount: number | null;
  source: 'pos' | 'manual';
  channel: string | null;
  promo_subsidy?: number;
  payment_proof_url?: string;
  /** Nomor perkiraan dari estimateOrderNumber — hanya untuk tampilan & struk. */
  estimatedOrderNumber: number;
  /** Kunci idempotensi; dipakai ulang di setiap percobaan kirim. */
  clientOrderId: string;
  /** Snapshot lengkap yang dikirim ke /api/orders/offline-ingest saat online. */
  ingestPayload: OfflineIngestPayload;
}

/**
 * Simpan pesanan yang dibuat saat offline ke IndexedDB:
 * 1. `local_orders` → tampil langsung di papan order kasir
 * 2. `sync_queue_orders` → dikirim ulang ke server saat online
 */
export async function createLocalOrder(
  input: CreateLocalOrderInput
): Promise<{ localId: string; orderNumber: number }> {
  const localId = input.clientOrderId;
  const orderNumber = input.estimatedOrderNumber;
  const nowISO = new Date().toISOString();

  const orderItems: OrderItem[] = input.items.map((it) => ({
    id: crypto.randomUUID(),
    order_id: localId,
    menu_item_id: it.menu_item_id,
    // Konvensi |NOTE| sama seperti server supaya papan order merender identik
    menu_item_name: it.note?.trim() ? `${it.name}|NOTE|${it.note.trim()}` : it.name,
    quantity: it.quantity,
    unit_price: it.unit_price,
    subtotal: it.subtotal,
  }));

  const order: OrderWithItems = {
    id: localId,
    outlet_id: input.outletId,
    order_number: orderNumber,
    customer_name: input.customer_name,
    customer_phone: null,
    status: 'preparing',
    kitchen_receipt_printed: true,
    payment_method: input.payment_method as any,
    total_amount: input.total_amount,
    notes: null,
    source: input.source,
    channel: input.channel,
    promo_subsidy: input.promo_subsidy ?? 0,
    payment_proof_url: input.payment_proof_url ?? null,
    external_order_id: null,
    created_at: nowISO,
    updated_at: nowISO,
    order_items: orderItems,
  };

  await db.transaction('rw', db.local_orders, db.sync_queue_orders, async () => {
    await db.local_orders.add({
      id: localId,
      outlet_id: input.outletId,
      order_number: orderNumber,
      is_estimated_number: true,
      status: 'preparing',
      created_at: nowISO,
      data: order,
    });
    await db.sync_queue_orders.add({
      id: crypto.randomUUID(),
      local_order_id: localId,
      payload: {
        url: '/api/orders/offline-ingest',
        method: 'POST',
        body: JSON.stringify(input.ingestPayload),
      },
      status: 'pending',
      attempts: 0,
      created_at: Date.now(),
    });
  });

  return { localId, orderNumber };
}

/** Update status pesanan lokal (belum tersinkron) — cukup ubah datanya di IndexedDB. */
export async function patchLocalOrder(localId: string, patch: Record<string, any>) {
  const row = await db.local_orders.get(localId);
  if (!row) return;
  await db.local_orders.put({
    ...row,
    status: patch.status ?? row.status,
    data: { ...row.data, ...patch, updated_at: new Date().toISOString() },
  });
}

/** Antrekan perubahan status untuk pesanan server yang dilakukan saat offline. */
export async function queueStatusMutation(orderId: string, patch: Record<string, any>, isLocal = false) {
  await db.sync_queue_mutations.add({
    id: crypto.randomUUID(),
    order_id: orderId,
    is_local: isLocal ? 1 : 0,
    patch,
    status: 'pending',
    created_at: Date.now(),
  });
}

export function localOrderRowsToOrders(rows: LocalOrderRow[]): OrderWithItems[] {
  return rows
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((r) => ({ ...r.data, _sync_error: r.sync_error }));
}

/** Hapus order offline yang nyangkut (status error permanen). */
export async function deleteLocalOrder(localId: string) {
  await db.transaction('rw', db.local_orders, db.sync_queue_orders, db.sync_queue_mutations, async () => {
    await db.local_orders.delete(localId);
    
    // Hapus dari antrean sinkronisasi order
    const queueOrders = await db.sync_queue_orders.where('local_order_id').equals(localId).toArray();
    for (const q of queueOrders) {
      await db.sync_queue_orders.delete(q.id);
    }
    
    // Hapus dari antrean mutasi (karena induknya dihapus)
    const queueMutations = await db.sync_queue_mutations.where('order_id').equals(localId).toArray();
    for (const m of queueMutations) {
      await db.sync_queue_mutations.delete(m.id);
    }
  });
}

/** Coba ulang order offline yang nyangkut (reset status queue jadi pending). */
export async function retryLocalOrderSync(localId: string) {
  await db.transaction('rw', db.local_orders, db.sync_queue_orders, async () => {
    // 1. Reset error di local_orders
    const local = await db.local_orders.get(localId);
    if (local) {
      await db.local_orders.update(localId, { sync_error: undefined });
    }
    
    // 2. Reset status di sync_queue_orders agar OfflineSyncManager menariknya lagi
    const queueOrders = await db.sync_queue_orders.where('local_order_id').equals(localId).toArray();
    for (const q of queueOrders) {
      await db.sync_queue_orders.update(q.id, { 
        status: 'pending', 
        error_message: undefined 
      });
    }
  });
}
