export const MAKS_DERAJAT = 6
export const MAKS_GESER = 3
/** Jarak horizontal kursor (px) dari tengah avatar yang menghasilkan condong penuh. */
export const JANGKAUAN = 400

export function hitungCondong(dx: number): { derajat: number; px: number } {
  const t = Math.max(-1, Math.min(1, dx / JANGKAUAN))
  return { derajat: t * MAKS_DERAJAT, px: t * MAKS_GESER }
}
