import { isTestOutlet } from '@suka/hr-rumus'
import type { OutletAbsensi } from './tipe'

const TIPE_ABSENSI = new Set(['internal', 'mitra', 'office', 'gudang'])

/** Lokasi yang dihitung bot HRD: punya staf operasional; Kantor Pusat ikut (spec D8). */
export function outletTerhitungAbsensi(
  outlets: { id: string; name: string; slug: string | null; type: string; is_active: boolean }[],
): OutletAbsensi[] {
  return outlets
    .filter((o) => o.is_active && TIPE_ABSENSI.has(o.type) && o.slug !== 'ss-backup' && !isTestOutlet(o))
    .map((o) => ({ id: o.id, name: o.name, type: o.type }))
    .sort((a, b) => a.name.localeCompare(b.name, 'id'))
}

/** Teks outlet dari pengguna → daftar outlet. Kosong = semua. */
export function pilihOutlet(
  outlets: OutletAbsensi[],
  teks?: string,
): { ok: true; outlets: OutletAbsensi[] } | { ok: false; pesan: string } {
  const t = teks?.trim().toLowerCase()
  if (!t) return { ok: true, outlets }
  const persis = outlets.filter((o) => o.name.toLowerCase() === t)
  if (persis.length === 1) return { ok: true, outlets: persis }
  const cocok = outlets.filter((o) => o.name.toLowerCase().includes(t))
  if (cocok.length === 1) return { ok: true, outlets: cocok }
  if (cocok.length === 0) return { ok: false, pesan: `Outlet "${teks}" tidak dikenal. Pilihan: ${outlets.map((o) => o.name).join(', ')}` }
  return { ok: false, pesan: `"${teks}" cocok dengan beberapa outlet: ${cocok.map((o) => o.name).join(', ')}. Sebutkan lebih spesifik.` }
}
