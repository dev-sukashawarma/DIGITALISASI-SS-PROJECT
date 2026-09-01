export type SidakDraftSnapshot = {
  key: string
  checks: Record<string, 'ok' | 'issue'>
  note: string
  updatedAt: number
}

const DB_NAME = 'suka-manager-sidak-drafts'
const DB_VERSION = 1
const STORE_NAME = 'drafts'
const LOCAL_PREFIX = 'suka-manager-sidak-draft:'

function draftKey(staffId: string, submissionId: string, sourceUpdatedAt: string) {
  return `${LOCAL_PREFIX}${staffId}:${submissionId}:${sourceUpdatedAt}`
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return Promise.resolve(null)
  return new Promise((resolve) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'key' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })
}

export async function loadSidakDraft(staffId: string, submissionId: string, sourceUpdatedAt: string): Promise<SidakDraftSnapshot | null> {
  if (typeof window === 'undefined') return null
  const key = draftKey(staffId, submissionId, sourceUpdatedAt)
  const database = await openDatabase()
  if (database) {
    const stored = await new Promise<SidakDraftSnapshot | null>((resolve) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key)
      request.onsuccess = () => resolve((request.result as SidakDraftSnapshot | undefined) ?? null)
      request.onerror = () => resolve(null)
    })
    database.close()
    if (stored) return stored
  }
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) as SidakDraftSnapshot : null
  } catch {
    return null
  }
}

export async function saveSidakDraft(
  staffId: string,
  submissionId: string,
  sourceUpdatedAt: string,
  snapshot: Omit<SidakDraftSnapshot, 'key' | 'updatedAt'>,
) {
  if (typeof window === 'undefined') return
  const record: SidakDraftSnapshot = { ...snapshot, key: draftKey(staffId, submissionId, sourceUpdatedAt), updatedAt: Date.now() }
  try {
    // Fallback paling cepat untuk refresh atau tab yang langsung ditutup.
    window.localStorage.setItem(record.key, JSON.stringify(record))
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

export async function removeSidakDraft(staffId: string, submissionId: string, sourceUpdatedAt: string) {
  if (typeof window === 'undefined') return
  const key = draftKey(staffId, submissionId, sourceUpdatedAt)
  try { window.localStorage.removeItem(key) } catch {}
  const database = await openDatabase()
  if (!database) return
  await new Promise<void>((resolve) => {
    const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(key)
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
  })
  database.close()
}
