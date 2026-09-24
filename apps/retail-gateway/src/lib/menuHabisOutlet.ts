/**
 * Ketersediaan menu per outlet, dibaca PERSIS seperti POS kiosk
 * (apps/pos-kasir/app/page.tsx), supaya kasir dan aplikasi tak pernah
 * bertentangan ("habis di kasir, dijual di aplikasi").
 *
 * - `menu_items.available_outlets` terisi & tak memuat outlet -> item dibuang.
 * - `kiosk_settings` (TEXT berisi array JSON), baris outlet sendiri menang,
 *   bila tak ada jatuh ke baris PUSAT. Tak ada baris outlet_id NULL (PK).
 * - habis = manual unavailable ATAU (auto unavailable DAN tidak force available).
 */
export const PUSAT_OUTLET_ID = '550e8400-e29b-41d4-a716-446655440001'

export type BarisKiosk = { outlet_id: string; key: string; value: string | null }

function parseIds(raw: string | null): string[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function idsDariKiosk(baris: BarisKiosk[], outletId: string, key: string): string[] {
  const milikOutlet = baris.find((b) => b.key === key && b.outlet_id === outletId)
  if (milikOutlet) return parseIds(milikOutlet.value)
  const pusat = baris.find((b) => b.key === key && b.outlet_id === PUSAT_OUTLET_ID)
  return pusat ? parseIds(pusat.value) : []
}

export function terapkanKetersediaanOutlet<
  T extends { id: string; is_available: boolean; available_outlets?: unknown },
>(items: T[], outletId: string, kiosk: BarisKiosk[]): T[] {
  const manual = new Set(idsDariKiosk(kiosk, outletId, 'unavailable_menu_ids'))
  const auto = new Set(idsDariKiosk(kiosk, outletId, 'auto_unavailable_menu_ids'))
  const paksa = new Set(idsDariKiosk(kiosk, outletId, 'force_available_menu_ids'))

  return items
    .filter((i) => {
      const daftar = i.available_outlets
      return !(Array.isArray(daftar) && daftar.length > 0 && !daftar.includes(outletId))
    })
    .map((i) => {
      const habis = manual.has(i.id) || (auto.has(i.id) && !paksa.has(i.id))
      return habis && i.is_available ? { ...i, is_available: false } : i
    })
}
