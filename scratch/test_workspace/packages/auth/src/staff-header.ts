import type { OutletStaffProfile } from './types'

/** Nama header tempat middleware menaruh staff tepercaya untuk RSC/client. */
export const STAFF_HEADER = 'x-suka-staff'

/** Serialize staff menjadi nilai header yang aman (URI-encoded, tanpa newline). */
export function serializeStaffHeader(staff: OutletStaffProfile): string {
  return encodeURIComponent(JSON.stringify(staff))
}

/** Parse nilai header menjadi staff; null bila kosong/rusak. */
export function parseStaffHeader(
  value: string | null | undefined
): OutletStaffProfile | null {
  if (!value) return null
  try {
    return JSON.parse(decodeURIComponent(value)) as OutletStaffProfile
  } catch {
    return null
  }
}
