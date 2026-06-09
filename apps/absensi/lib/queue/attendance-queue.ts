/**
 * Antrian absensi offline (M1) berbasis IndexedDB.
 *
 * Saat device offline, absen disimpan di sini lalu di-replay ke Edge Function
 * submit-attendance saat online. `id` (UUID dari client) jadi keyPath →
 * enqueue idempoten: double-tap / replay tidak menggandakan entri.
 * Lihat spec M1 §4.3.
 */

export type AttendanceType = "in" | "out";

export type QueuedAttendance = {
  /** UUID digenerate client; idempotency key. */
  id: string;
  outletStaffId: string;
  type: AttendanceType;
  gpsLat: number;
  gpsLng: number;
  matchDistance: number;
  /** Path selfie di Storage (sudah/akan diupload sebelum sync). */
  selfiePath: string;
  /** Waktu device saat absen (ISO). Basis status telat untuk absen offline. */
  tsClient: string;
};

const DB_NAME = "ss-absensi";
const DB_VERSION = 1;
const STORE = "attendance_queue";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Bungkus satu request IndexedDB jadi Promise. */
function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, mode);
    const result = await fn(tx.objectStore(STORE));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return result;
  } finally {
    db.close();
  }
}

/** Tambah/timpa absen di antrian (idempoten via id). */
export async function enqueueAttendance(item: QueuedAttendance): Promise<void> {
  await withStore("readwrite", async (store) => {
    await promisify(store.put(item));
  });
}

/** Semua absen yang menunggu sync. */
export async function listQueued(): Promise<QueuedAttendance[]> {
  return withStore("readonly", (store) =>
    promisify(store.getAll() as IDBRequest<QueuedAttendance[]>),
  );
}

/** Jumlah absen menunggu sync. */
export async function countQueued(): Promise<number> {
  return withStore("readonly", (store) => promisify(store.count()));
}

/** Hapus satu absen setelah berhasil di-sync. No-op bila id tak ada. */
export async function removeQueued(id: string): Promise<void> {
  await withStore("readwrite", async (store) => {
    await promisify(store.delete(id));
  });
}

/** Kosongkan antrian (dipakai test / reset). */
export async function clearQueue(): Promise<void> {
  await withStore("readwrite", async (store) => {
    await promisify(store.clear());
  });
}
