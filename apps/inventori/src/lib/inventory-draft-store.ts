export type StoredDraft = {
  observedQty: string
  isPresent: boolean
  condition: 'baik' | 'perlu_perbaikan' | 'rusak' | 'tidak_ada'
  notes: string
  purchaseDate: string
  price: string
  depreciationRate: string
  brand: string
  photo: File | null
  uploadedPhotoPath?: string
  uploadedPhotoUrl?: string | null
  existingPhotoPath?: string
  existingPhotoUrl?: string | null
}

export type InventoryDraftSnapshot = {
  key: string
  drafts: Record<string, StoredDraft>
  scores: Record<string, string>
  notes: string
  updatedAt: number
}

const DB_NAME = 'suka-inventori-drafts'
const DB_VERSION = 1
const STORE_NAME = 'drafts'
const LOCAL_PREFIX = 'suka-inventori-draft:'

function storageKey(staffId: string, tanggal: string, outletId: string) {
  // Draft inventaris bukan data harian. Parameter tanggal dipertahankan pada
  // API internal agar tidak memutus pemanggil lama, tetapi key harus tetap
  // sama lintas hari untuk user + outlet yang sama.
  void tanggal
  return `${LOCAL_PREFIX}${staffId}:${outletId}`
}

function snapshotKey(staffId: string, tanggal: string, outletId: string) {
  return storageKey(staffId, tanggal, outletId)
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return Promise.resolve(null)
  return new Promise((resolve) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'key' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })
}

function localFallback(snapshot: InventoryDraftSnapshot) {
  return {
    ...snapshot,
    // File tidak dapat diserialisasi di localStorage; IndexedDB menyimpan File aslinya.
    drafts: Object.fromEntries(Object.entries(snapshot.drafts).map(([id, draft]) => [id, { ...draft, photo: null }])),
  }
}

export async function loadInventoryDraft(
  staffId: string,
  tanggal: string,
  outletId: string,
): Promise<InventoryDraftSnapshot | null> {
  if (typeof window === 'undefined') return null
  const key = snapshotKey(staffId, tanggal, outletId)
  const database = await openDatabase()
  if (database) {
    const result = await new Promise<InventoryDraftSnapshot | null>((resolve) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key)
      request.onsuccess = () => resolve((request.result as InventoryDraftSnapshot | undefined) ?? null)
      request.onerror = () => resolve(null)
    })
    database.close()
    if (result) return result
  }
  try {
    const raw = window.localStorage.getItem(storageKey(staffId, tanggal, outletId))
    return raw ? JSON.parse(raw) as InventoryDraftSnapshot : null
  } catch {
    return null
  }
}

export async function saveInventoryDraft(
  staffId: string,
  tanggal: string,
  outletId: string,
  snapshot: Omit<InventoryDraftSnapshot, 'key' | 'updatedAt'>,
) {
  if (typeof window === 'undefined') return
  const record: InventoryDraftSnapshot = {
    ...snapshot,
    key: snapshotKey(staffId, tanggal, outletId),
    updatedAt: Date.now(),
  }

  // Tulis metadata secara sinkron sebagai fallback paling cepat saat refresh.
  try {
    window.localStorage.setItem(storageKey(staffId, tanggal, outletId), JSON.stringify(localFallback(record)))
  } catch {}

  const database = await openDatabase()
  if (!database) return
  await new Promise<void>((resolve) => {
    const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(record)
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
  })
  database.close()
}

export async function removeInventoryDraft(staffId: string, tanggal: string, outletId: string) {
  if (typeof window === 'undefined') return
  const key = snapshotKey(staffId, tanggal, outletId)
  try {
    window.localStorage.removeItem(key)
  } catch {}
  const database = await openDatabase()
  if (!database) return
  await new Promise<void>((resolve) => {
    const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(key)
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
  })
  database.close()
}
