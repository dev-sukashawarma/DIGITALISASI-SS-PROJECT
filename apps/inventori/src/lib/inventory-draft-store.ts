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
// v2 memisahkan foto ke object store sendiri. Lihat catatan di saveInventoryDraft.
const DB_VERSION = 2
const STORE_NAME = 'drafts'
const PHOTO_STORE_NAME = 'draft-photos'
const LOCAL_PREFIX = 'suka-inventori-draft:'

type StoredPhoto = { key: string; photo: File }

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

function photoKey(key: string, itemId: string) {
  return `${key}::${itemId}`
}

function photoRange(key: string) {
  return IDBKeyRange.bound(`${key}::`, `${key}::￿`)
}

// Foto yang terakhir benar-benar ditulis ke IndexedDB, per snapshot key.
// Autosave berjalan tiap kali user mengetik; tanpa pembanding ini, seluruh 87
// foto (~10 MB) ditulis ulang setiap 350 ms walau yang berubah cuma satu huruf.
const lastWrittenPhotos = new Map<string, Map<string, File>>()

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return Promise.resolve(null)
  return new Promise((resolve) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: 'key' })
      if (!database.objectStoreNames.contains(PHOTO_STORE_NAME)) database.createObjectStore(PHOTO_STORE_NAME, { keyPath: 'key' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })
}

function withoutPhotos(drafts: Record<string, StoredDraft>) {
  return Object.fromEntries(Object.entries(drafts).map(([id, draft]) => [id, { ...draft, photo: null }]))
}

function localFallback(snapshot: InventoryDraftSnapshot) {
  return {
    ...snapshot,
    // File tidak dapat diserialisasi di localStorage; IndexedDB menyimpan File aslinya.
    drafts: withoutPhotos(snapshot.drafts),
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
      const transaction = database.transaction([STORE_NAME, PHOTO_STORE_NAME], 'readonly')
      const metaRequest = transaction.objectStore(STORE_NAME).get(key)
      const photoRequest = transaction.objectStore(PHOTO_STORE_NAME).getAll(photoRange(key))
      transaction.oncomplete = () => {
        const meta = metaRequest.result as InventoryDraftSnapshot | undefined
        if (!meta) return resolve(null)
        const photos = new Map<string, File>()
        for (const row of (photoRequest.result ?? []) as StoredPhoto[]) {
          const itemId = row.key.slice(key.length + 2)
          if (row.photo instanceof File) photos.set(itemId, row.photo)
        }
        // Draft dari skema v1 menyimpan File langsung di dalam record meta.
        // Pertahankan foto itu supaya pengisian yang sedang berjalan tidak
        // kehilangan fotonya saat database naik versi.
        const drafts = Object.fromEntries(Object.entries(meta.drafts ?? {}).map(([id, draft]) => {
          const legacy = draft.photo instanceof File ? draft.photo : null
          return [id, { ...draft, photo: photos.get(id) ?? legacy }]
        })) as Record<string, StoredDraft>
        // Seed pembanding supaya penyimpanan pertama setelah reload tidak
        // menulis ulang foto yang isinya sudah sama. Foto warisan v1 sengaja
        // TIDAK di-seed agar ikut dipindahkan ke store baru saat save berikutnya.
        lastWrittenPhotos.set(key, new Map(photos))
        resolve({ ...meta, drafts })
      }
      transaction.onerror = () => resolve(null)
      transaction.onabort = () => resolve(null)
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
  const key = snapshotKey(staffId, tanggal, outletId)
  const record: InventoryDraftSnapshot = { ...snapshot, key, updatedAt: Date.now() }

  // Tulis metadata secara sinkron sebagai fallback paling cepat saat refresh.
  try {
    window.localStorage.setItem(key, JSON.stringify(localFallback(record)))
  } catch {}

  const database = await openDatabase()
  if (!database) return

  const written = lastWrittenPhotos.get(key) ?? new Map<string, File>()
  const nextPhotos = new Map<string, File>()
  const puts: StoredPhoto[] = []
  for (const [itemId, draft] of Object.entries(snapshot.drafts)) {
    if (!(draft.photo instanceof File)) continue
    nextPhotos.set(itemId, draft.photo)
    // Perbandingan identitas objek: File baru selalu instance baru, dan File
    // yang tidak disentuh tetap referensi yang sama antar render.
    if (written.get(itemId) !== draft.photo) puts.push({ key: photoKey(key, itemId), photo: draft.photo })
  }
  const deletes = [...written.keys()].filter((itemId) => !nextPhotos.has(itemId))

  await new Promise<void>((resolve) => {
    const transaction = database.transaction([STORE_NAME, PHOTO_STORE_NAME], 'readwrite')
    // Metadata disimpan tanpa File; fotonya hidup di store terpisah supaya
    // mengetik satu huruf tidak menulis ulang seluruh koleksi foto.
    transaction.objectStore(STORE_NAME).put({ ...record, drafts: withoutPhotos(record.drafts) })
    const photoStore = transaction.objectStore(PHOTO_STORE_NAME)
    for (const row of puts) photoStore.put(row)
    for (const itemId of deletes) photoStore.delete(photoKey(key, itemId))
    transaction.oncomplete = () => {
      lastWrittenPhotos.set(key, nextPhotos)
      resolve()
    }
    transaction.onerror = () => resolve()
    transaction.onabort = () => resolve()
  })
  database.close()
}

export async function removeInventoryDraft(staffId: string, tanggal: string, outletId: string) {
  if (typeof window === 'undefined') return
  const key = snapshotKey(staffId, tanggal, outletId)
  try {
    window.localStorage.removeItem(key)
  } catch {}
  lastWrittenPhotos.delete(key)
  const database = await openDatabase()
  if (!database) return
  await new Promise<void>((resolve) => {
    const transaction = database.transaction([STORE_NAME, PHOTO_STORE_NAME], 'readwrite')
    transaction.objectStore(STORE_NAME).delete(key)
    transaction.objectStore(PHOTO_STORE_NAME).delete(photoRange(key))
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => resolve()
    transaction.onabort = () => resolve()
  })
  database.close()
}
