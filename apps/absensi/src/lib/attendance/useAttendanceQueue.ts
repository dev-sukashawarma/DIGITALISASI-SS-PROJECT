"use client";

import { useOfflineQueue } from "@suka/offline-queue";
import type { QueueItem } from "@suka/offline-queue";
import { createClient } from "@/lib/supabase";
import { submitAttendance } from "./submit";
import type { AttendancePayload } from "./types";

// Item antrian: payload + selfie dataURL (diupload saat sync).
type QueuedAbsen = { payload: AttendancePayload; selfieDataUrl: string | null; outlet_id?: string; };

const FUNCTION_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/submit-attendance`;

export function useAttendanceQueue() {
  // NOTE: useOfflineQueue returns { queue, add, flush, isPending, isOnline }.
  // The queued-items array is exposed as `queue` (not `items`).
  const { queue, add, flush, isOnline } = useOfflineQueue<QueuedAbsen>("ss-absensi-queue");
  const supabase = createClient();

  async function syncOne(item: QueuedAbsen, token: string) {
    return submitAttendance(
      { ...item.payload, selfie_base64: item.selfieDataUrl || undefined, from_queue: true, outlet_id: item.outlet_id || '' },
      { functionUrl: FUNCTION_URL, anonKey: token },
    );
  }

  /** Tambah absen ke antrian (dipakai saat offline). */
  function enqueue(payload: AttendancePayload, selfieDataUrl: string | null, outlet_id?: string) {
    return add({ payload, selfieDataUrl, outlet_id });
  }

  /** Flush semua antrian saat online. */
  async function flushQueue(_outletId: string) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await flush(async (items: QueueItem<QueuedAbsen>[]) => {
      for (const it of items) {
        const res = await syncOne(it.data, token);
        if (!res.ok) throw new Error(res.reason);
      }
    });
  }

  return { enqueue, flush: flushQueue, isOnline, pending: queue.length };
}
