// Outlet yang dihitung & ditampilkan di Laporan Penjualan (/stok/laporan-penjualan).
// Dulu disaring lewat potongan NAMA → GUDANG SS ONLINE, outlet Persiapan, dan
// outlet tutup ikut terhitung, outlet tes hanya lolos karena namanya.
// Kini lewat outlets.type/status/slug (nama bisa diubah admin kapan saja).

import { namaDenganKeteranganTutup, outletSudahTutup, outletTampilDiPeriode } from '@/lib/stok/outletTutup'

export type OutletBaris = {
  id: string
  name: string
  type?: string | null
  status?: string | null
  is_active?: boolean | null
  slug?: string | null
  nonaktif_at?: string | null
}

export type InfoOutletLaporan = { name: string; cleanName: string; category: 'mitra' | 'internal' }
export type PilihanOutletLaporan = InfoOutletLaporan & { id: string; tutup: boolean }

const TIPE_DIHITUNG = new Set(['internal', 'mitra'])
const SLUG_DIKECUALIKAN = new Set(['ss-backup'])

/**
 * Outlet operasional yang penjualannya dihitung: internal/mitra, bukan
 * Persiapan (status 'pending'), bukan SS Backup. Outlet TUTUP tetap dihitung —
 * penjualannya sebelum tutup nyata (aturan outletTutup: hanya tampilan pemilih
 * yang disembunyikan, bukan data perhitungan).
 */
export function outletDihitungLaporan(o: OutletBaris): boolean {
  if (!o.type || !TIPE_DIHITUNG.has(o.type)) return false
  if (o.status === 'pending') return false
  if (o.slug && SLUG_DIKECUALIKAN.has(o.slug)) return false
  return true
}

const namaBersih = (name: string) => name.replace('SUKA SHAWARMA ', '').trim()

/**
 * - idDihitung / infoOutlet: dasar perhitungan "Semua Outlet" (termasuk outlet tutup).
 * - pilihan: isi pemilih outlet; outlet tutup tampil s/d akhir bulan tutupnya,
 *   patokannya awal periode (`periodeMulai`, YYYY-MM-DD).
 * - jumlahAktif: outlet di pemilih yang belum tutup.
 */
export function susunOutletLaporan(outlets: OutletBaris[], periodeMulai: string) {
  const dihitung = outlets.filter(outletDihitungLaporan)
  const idDihitung = new Set(dihitung.map((o) => o.id))
  const infoOutlet = new Map<string, InfoOutletLaporan>()
  for (const o of dihitung) {
    infoOutlet.set(o.id, {
      name: o.name,
      cleanName: namaBersih(o.name),
      category: o.type === 'mitra' ? 'mitra' : 'internal',
    })
  }
  const pilihan: PilihanOutletLaporan[] = dihitung
    .filter((o) => outletTampilDiPeriode(o, periodeMulai))
    .map((o) => {
      const info = infoOutlet.get(o.id)!
      return {
        id: o.id,
        name: o.name,
        cleanName: namaDenganKeteranganTutup(info.cleanName, o),
        category: info.category,
        tutup: outletSudahTutup(o),
      }
    })
  const jumlahAktif = pilihan.filter((o) => !o.tutup).length
  return { idDihitung, infoOutlet, pilihan, jumlahAktif }
}
