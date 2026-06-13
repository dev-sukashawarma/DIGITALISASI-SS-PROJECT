"use client";

import { useOfflineQueue } from "@suka/offline-queue";
import type { QueueItem } from "@suka/offline-queue";
import { createClient } from "@/lib/supabase";
import { submitAttendance } from "./submit";
import type { AttendancePayload } from "./types";

// Item antrian: payload + selfie dataURL (diupload saat sync).
type QueuedAbsen = { payload: AttendancePayload; selfieDataUrl: string | null };

const FUNCTION_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/submit-attendance`;

export function useAttendanceQueue() {
  // NOTE: useOfflineQueue returns { queue, add, flush, isPending, isOnline }.
  // The queued-items array is exposed as `queue` (not `items`).
  const { queue, add, flush, isOnline } = useOfflineQueue<QueuedAbsen>("ss-absensi-queue");
  const supabase = createClient();

  async function uploadSelfie(outletId: string, id: string, dataUrl: string): Promise<string> {
    const path = `${outletId}/${id}.jpg`;
    const blob = await (await fetch(dataUrl)).blob();
    await supabase.storage.from("selfies").upload(path, blob, { upsert: true, contentType: "image/jpeg" });
    return path;
  }

  async function syncOne(item: QueuedAbsen, outletId: string, token: string) {
    let selfiePath = item.payload.selfie_path;
    if (!selfiePath && item.selfieDataUrl) {
      selfiePath = await uploadSelfie(outletId, item.payload.id, item.selfieDataUrl);
    }
    return submitAttendance(
      { ...item.payload, selfie_path: selfiePath, from_queue: true },
      { functionUrl: FUNCTION_URL, accessToken: token },
    );
  }

  /** Tambah absen ke antrian (dipakai saat offline). */
  function enqueue(payload: AttendancePayload, selfieDataUrl: string | null) {
    return add({ payload, selfieDataUrl });
  }

  /** Flush semua antrian saat online. */
  async function flushQueue(outletId: string) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await flush(async (items: QueueItem<QueuedAbsen>[]) => {
      for (const it of items) {
        const res = await syncOne(it.data, outletId, token);
        if (!res.ok) throw new Error(res.reason);
      }
    });
  }

  return { enqueue, flush: flushQueue, isOnline, pending: queue.length };
}
