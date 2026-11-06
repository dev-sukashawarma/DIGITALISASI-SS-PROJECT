import { CATEGORY_META } from '@/lib/expenseCategories'
import type { PettyCashTransaction } from '@/components/owner/PettyCashReportView'

/** Laporan Petty Cash: logika murni (dikelompokkan per hari WIB, ringkasan, per outlet). */

export type TipeSaringan = 'all' | 'in' | 'out'

const TANGGAL_WIB = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const JAM_WIB = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
const LABEL_HARI = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function keDate(iso: string): Date | null {
  // Tanggal polos (YYYY-MM-DD) dibaca sebagai tengah hari WIB agar tak bergeser hari.
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00+07:00` : iso)
  return isNaN(d.getTime()) ? null : d
}

/** Tanggal kalender WIB (YYYY-MM-DD). */
export function tanggalWib(iso: string): string {
  const d = keDate(iso)
  return d ? TANGGAL_WIB.format(d) : iso.slice(0, 10)
}

export function jamWib(iso: string): string {
  const d = keDate(iso)
  return d ? JAM_WIB.format(d).replace('.', ':') : ''
}

export function labelKategori(kategori: string): string {
  const meta = (CATEGORY_META as Record<string, { label: string }>)[kategori]
  if (meta) return meta.label
  const bersih = kategori.replace(/_/g, ' ').trim()
  return bersih ? bersih.charAt(0).toUpperCase() + bersih.slice(1) : 'Tanpa kategori'
}

export interface Ringkasan {
  masuk: number
  keluar: number
  selisih: number
  jumlahMasuk: number
  jumlahKeluar: number
  tanpaNota: number
}

export function ringkas(rows: PettyCashTransaction[]): Ringkasan {
  const r: Ringkasan = { masuk: 0, keluar: 0, selisih: 0, jumlahMasuk: 0, jumlahKeluar: 0, tanpaNota: 0 }
  for (const t of rows) {
    if (t.type === 'in') {
      r.masuk += t.amount
      r.jumlahMasuk++
    } else {
      r.keluar += t.amount
      r.jumlahKeluar++
      if (!t.receipt_url) r.tanpaNota++
    }
  }
  r.selisih = r.masuk - r.keluar
  return r
}

export interface GrupHari {
  tanggal: string
  label: string
  baris: PettyCashTransaction[]
  ringkasan: Ringkasan
}

export function kelompokkanPerHari(rows: PettyCashTransaction[], now = new Date()): GrupHari[] {
  const hariIni = TANGGAL_WIB.format(now)
  const kemarin = TANGGAL_WIB.format(new Date(now.getTime() - 86_400_000))
  const peta = new Map<string, PettyCashTransaction[]>()
  for (const t of rows) {
    const k = tanggalWib(t.transaction_date)
    const daftar = peta.get(k)
    if (daftar) daftar.push(t)
    else peta.set(k, [t])
  }
  return [...peta.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([tanggal, baris]) => {
      const urut = [...baris].sort((a, b) => b.transaction_date.localeCompare(a.transaction_date))
      const d = keDate(tanggal)
      const label =
        tanggal === hariIni ? 'Hari ini' : tanggal === kemarin ? 'Kemarin' : d ? LABEL_HARI.format(d) : tanggal
      return { tanggal, label, baris: urut, ringkasan: ringkas(urut) }
    })
}

export interface BarisOutlet {
  outletId: string
  nama: string
  keluar: number
  masuk: number
  jumlahKeluar: number
}

/** Outlet diurutkan dari pengeluaran terbesar. */
export function perOutlet(rows: PettyCashTransaction[]): BarisOutlet[] {
  const peta = new Map<string, BarisOutlet>()
  for (const t of rows) {
    const o = peta.get(t.outlet_id) ?? { outletId: t.outlet_id, nama: t.outlet_name, keluar: 0, masuk: 0, jumlahKeluar: 0 }
    if (t.type === 'in') o.masuk += t.amount
    else {
      o.keluar += t.amount
      o.jumlahKeluar++
    }
    peta.set(t.outlet_id, o)
  }
  return [...peta.values()].sort((a, b) => b.keluar - a.keluar || a.nama.localeCompare(b.nama))
}

export interface OpsiKategori {
  kategori: string
  label: string
  jumlah: number
}

/** Kategori yang muncul di data, terbanyak dulu. */
export function daftarKategori(rows: PettyCashTransaction[]): OpsiKategori[] {
  const peta = new Map<string, number>()
  for (const t of rows) peta.set(t.category, (peta.get(t.category) ?? 0) + 1)
  return [...peta.entries()]
    .map(([kategori, jumlah]) => ({ kategori, label: labelKategori(kategori), jumlah }))
    .sort((a, b) => b.jumlah - a.jumlah || a.label.localeCompare(b.label))
}

export interface Saringan {
  outletId: string
  tipe: TipeSaringan
  kategori: string | null
  cari: string
  hanyaTanpaNota: boolean
}

export function saring(rows: PettyCashTransaction[], s: Saringan): PettyCashTransaction[] {
  const q = s.cari.trim().toLowerCase()
  return rows.filter((t) => {
    if (s.outletId !== 'all' && t.outlet_id !== s.outletId) return false
    if (s.tipe !== 'all' && t.type !== s.tipe) return false
    if (s.kategori && t.category !== s.kategori) return false
    if (s.hanyaTanpaNota && (t.type !== 'out' || t.receipt_url)) return false
    if (q) {
      const teks = `${t.description} ${t.category} ${labelKategori(t.category)} ${t.staff_name} ${t.outlet_name}`.toLowerCase()
      if (!teks.includes(q)) return false
    }
    return true
  })
}

/* ── Saldo petty cash terkini per outlet ─────────────────────── */

/** Ambang "menipis", sama dengan peringatan di dashboard leader. */
export const BATAS_SALDO_MENIPIS = 150_000

export interface SaldoOutlet {
  outletId: string
  nama: string
  /** null = gagal dibaca. */
  saldo: number | null
  shiftAktif: boolean
  dihitungPada: string | null
}

export type StatusSaldo = 'habis' | 'menipis' | 'aman' | 'galat'

export function statusSaldo(s: SaldoOutlet): StatusSaldo {
  if (s.saldo == null) return 'galat'
  if (s.saldo <= 0) return 'habis'
  if (s.saldo < BATAS_SALDO_MENIPIS) return 'menipis'
  return 'aman'
}

const URUT_STATUS: Record<StatusSaldo, number> = { galat: 0, habis: 1, menipis: 2, aman: 3 }

export type UrutanSaldo = 'perhatian' | 'nama' | 'nominal_besar' | 'nominal_kecil'

/**
 * perhatian: galat, habis, menipis dulu lalu saldo terkecil.
 * nominal: saldo gagal dibaca selalu di akhir. Nama A–Z sebagai pemecah seri.
 */
export function urutkanSaldo(rows: SaldoOutlet[], urutan: UrutanSaldo = 'perhatian'): SaldoOutlet[] {
  const nama = (a: SaldoOutlet, b: SaldoOutlet) => a.nama.localeCompare(b.nama, 'id')
  const galatAkhir = (a: SaldoOutlet, b: SaldoOutlet) => Number(a.saldo == null) - Number(b.saldo == null)
  const banding: Record<UrutanSaldo, (a: SaldoOutlet, b: SaldoOutlet) => number> = {
    perhatian: (a, b) =>
      URUT_STATUS[statusSaldo(a)] - URUT_STATUS[statusSaldo(b)] || (a.saldo ?? 0) - (b.saldo ?? 0) || nama(a, b),
    nama,
    nominal_besar: (a, b) => galatAkhir(a, b) || (b.saldo ?? 0) - (a.saldo ?? 0) || nama(a, b),
    nominal_kecil: (a, b) => galatAkhir(a, b) || (a.saldo ?? 0) - (b.saldo ?? 0) || nama(a, b),
  }
  return [...rows].sort(banding[urutan])
}
