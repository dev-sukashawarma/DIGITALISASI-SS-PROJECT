/* Helper bersama ekspor PDF & Excel Rangkuman Penjualan (berjalan di browser). */

import type { PosExportReport } from '@/lib/posReport/ekspor'

/** Warna merek — primary = latar sidebar dashboard. */
export const WARNA = {
  primary: '#4A1713',
  primaryLembut: '#6E2A22',
  oranye: '#F29744',
  krem: '#FDF9F3',
  kremTua: '#F3E6D8',
  garis: '#EADFD3',
  teks: '#37292A',
  teksPudar: '#8A6F66',
  gross: '#E8890C',
  cogs: '#E11D48',
  potongan: '#2563EB',
  gp: '#059669',
  merah: '#BE123C',
  kuning: '#B45309',
  hijau: '#047857',
  mitra: '#7C3AED',
} as const

export interface KonteksEkspor {
  cabang: string
  channel: string
}

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

/** '2026-09-01' → '1 Sep 2026' */
export function tanggalPendek(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${d} ${BULAN[m - 1]} ${y}`
}

/** '2026-09-01' → 'Sel, 01 Sep' */
export function tanggalDenganHari(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const hari = HARI[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${hari}, ${String(d).padStart(2, '0')} ${BULAN[m - 1]}`
}

export function jumlahHari(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`)
  const b = Date.parse(`${to}T00:00:00Z`)
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 86_400_000) + 1 : 0
}

export function labelPeriode(data: PosExportReport): string {
  const { from, to } = data.periode
  const hari = jumlahHari(from, to)
  const rentang = from === to ? tanggalPendek(from) : `${tanggalPendek(from)} - ${tanggalPendek(to)}`
  return `${rentang} (${hari} hari)`
}

export function labelCabang(data: PosExportReport, ctx: KonteksEkspor): string {
  return ctx.cabang === 'Semua Cabang' ? `Semua Cabang (${data.total.outletCount} outlet)` : ctx.cabang
}

export function waktuCetak(): string {
  const s = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date())
  return `${s.replace(/\./g, ':')} WIB`
}

const ANGKA = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })
export const angka = (n: number) => ANGKA.format(Math.round(n || 0))
export const rupiah = (n: number) => `${n < 0 ? '-' : ''}Rp ${ANGKA.format(Math.abs(Math.round(n || 0)))}`
export const persen = (n: number, digit = 1) => `${(Number.isFinite(n) ? n * 100 : 0).toFixed(digit).replace('.', ',')}%`
export const rasio = (a: number, b: number) => (b ? a / b : 0)

/** Ambang warna margin (Gross Profit ÷ Gross Revenue). */
export function warnaMargin(margin: number): string {
  if (margin >= 0.3) return WARNA.hijau
  if (margin >= 0.15) return WARNA.kuning
  return WARNA.merah
}

export function hexKeRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

/** Campur warna dengan putih — 0 = putih, 1 = warna asli. */
export function tint(hex: string, kekuatan: number): [number, number, number] {
  const [r, g, b] = hexKeRgb(hex)
  const c = (v: number) => Math.round(255 - (255 - v) * kekuatan)
  return [c(r), c(g), c(b)]
}

export function namaBerkas(data: PosExportReport, ctx: KonteksEkspor, ekstensi: 'pdf' | 'xlsx'): string {
  const cabang = ctx.cabang === 'Semua Cabang'
    ? 'Semua_Cabang'
    : ctx.cabang.includes(',') ? `${ctx.cabang.split(',').length}_Cabang` : ctx.cabang
  const aman = cabang.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '')
  const { from, to } = data.periode
  return `Laporan_Penjualan_${aman}_${from === to ? from : `${from}_sd_${to}`}.${ekstensi}`
}

export function unduhBlob(blob: Blob, nama: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nama
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
