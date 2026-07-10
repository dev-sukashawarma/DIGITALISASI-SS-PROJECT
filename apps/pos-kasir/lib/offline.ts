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
// Pesanan lokal (dibuat saat offline)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Nomor antrian lokal per outlet per hari, mulai dari 9001 — sengaja di range
 * tinggi supaya tidak bentrok/tertukar dengan nomor antrian resmi dari server.
 */
export async function nextLocalOrderNumber(outletId: string): Promise<number> {
  const dateKey = new Date().toISOString().slice(0, 10);
  const key = `local_order_counter:${outletId}:${dateKey}`;
  return db.transaction('rw', db.app_state, async () => {
    const row = await db.app_state.get(key);
    const next = (row?.value ?? 9000) + 1;
    await db.app_state.put({ key, value: next, synced_at: Date.now() });
    return next;
  });
}

export interface LocalOrderItemInput {
  menu_item_id: string;
  name: string;
  note?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
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
  apiUrl: string; // endpoint yang akan dipanggil ulang saat online
  apiPayload: any; // body yang dikirim ke endpoint tersebut
}

/**
 * Simpan pesanan yang dibuat saat offline ke IndexedDB:
 * 1. `local_orders` → tampil langsung di papan order kasir
 * 2. `sync_queue_orders` → dikirim ulang ke server saat online
 */
export async function createLocalOrder(input: CreateLocalOrderInput): Promise<{ localId: string; orderNumber: number }> {
  const localId = crypto.randomUUID();
  const orderNumber = await nextLocalOrderNumber(input.outletId);
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
    payment_method: input.payment_method as any,
    total_amount: input.total_amount,
    notes: null,
    source: input.source,
    channel: input.channel,
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
      status: 'preparing',
      created_at: nowISO,
      data: order,
    });
    await db.sync_queue_orders.add({
      id: crypto.randomUUID(),
      local_order_id: localId,
      payload: {
        url: input.apiUrl,
        method: 'POST',
        body: JSON.stringify(input.apiPayload),
      },
      status: 'pending',
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
    .map((r) => r.data);
}
