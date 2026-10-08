// Penghitung murni alat finance Bot CEO (tanpa I/O). Spec 2026-10-08 Finance 1 §2–§3.
import { CATEGORY_META } from '@/lib/expenseCategories'
import { TEST_OUTLET_ID } from '@/lib/outletFilters'
import type { ExpenseRow } from '@/lib/expenseRow'
import type { OutletNama, PoBaris, SetoranBaris, ShiftBaris } from './tipe'

const HARI_MS = 86_400_000
const rp = (n: number) => Math.round(n)

/** Tanggal WIB (YYYY-MM-DD) dari waktu UTC; WIB = UTC+7 tanpa DST. */
export const tglWib = (iso: string) => new Date(Date.parse(iso) + 7 * 3_600_000).toISOString().slice(0, 10)
const tambahHari = (tgl: string, n: number) => new Date(Date.parse(`${tgl}T00:00:00Z`) + n * HARI_MS).toISOString().slice(0, 10)
const selisihHari = (dari: string, sampai: string) => Math.round((Date.parse(`${sampai}T00:00:00Z`) - Date.parse(`${dari}T00:00:00Z`)) / HARI_MS)

const DITERIMA = new Set(['sebagian_diterima', 'diterima_lengkap'])
const BUKAN_KOMITMEN = new Set(['draft', 'dibatalkan', ...DITERIMA])

/** Utang = barang sudah diterima & belum lunas (nilai terima). Komitmen = PO belum diterima (nilai pesan). */
export function hitungUtang(daftar: PoBaris[], hariIni: string, dalamHari?: number) {
  const belumLunas = daftar.filter((p) => p.statusBayar !== 'paid')
  const semuaUtang = belumLunas.filter((p) => DITERIMA.has(p.status))
  const batas = dalamHari === undefined ? null : tambahHari(hariIni, dalamHari)
  const utang = batas === null ? semuaUtang : semuaUtang.filter((p) => p.jatuhTempo !== null && p.jatuhTempo <= batas)
  const komitmen = belumLunas.filter((p) => !BUKAN_KOMITMEN.has(p.status))

  const po = utang
    .map((p) => ({
      nomor_po: p.nomorPo,
      supplier: p.supplier,
      nilai: rp(p.nilaiTerima),
      tanggal_po: p.tanggalPo,
      jatuh_tempo: p.jatuhTempo,
      hari_lewat: p.jatuhTempo ? selisihHari(p.jatuhTempo, hariIni) : null,
      status_bayar: p.statusBayar,
    }))
    .sort((a, b) => (a.jatuh_tempo ?? '9999').localeCompare(b.jatuh_tempo ?? '9999') || a.nomor_po.localeCompare(b.nomor_po))

  const perSupplier = new Map<string, { supplier: string; total: number; jumlah_po: number; jatuh_tempo_terdekat: string | null }>()
  for (const p of po) {
    const s = perSupplier.get(p.supplier) ?? { supplier: p.supplier, total: 0, jumlah_po: 0, jatuh_tempo_terdekat: null }
    s.total += p.nilai
    s.jumlah_po += 1
    if (p.jatuh_tempo && (!s.jatuh_tempo_terdekat || p.jatuh_tempo < s.jatuh_tempo_terdekat)) s.jatuh_tempo_terdekat = p.jatuh_tempo
    perSupplier.set(p.supplier, s)
  }
  const lewat = po.filter((p) => p.hari_lewat !== null && p.hari_lewat > 0)
  const jumlahkan = (xs: { nilai: number }[]) => xs.reduce((t, x) => t + x.nilai, 0)

  return {
    total_utang: jumlahkan(po),
    total_utang_semua: rp(semuaUtang.reduce((t, p) => t + p.nilaiTerima, 0)),
    jumlah_po: po.length,
    lewat_jatuh_tempo: { total: jumlahkan(lewat), jumlah_po: lewat.length },
    per_supplier: [...perSupplier.values()].sort((a, b) => b.total - a.total),
    po,
    komitmen: { total: rp(komitmen.reduce((t, p) => t + p.nilaiPesan, 0)), jumlah_po: komitmen.length },
  }
}

/** Ringkasan halaman Pengeluaran. `outletIds` = saring ke outlet tertentu (pusat ikut terbuang). */
export function ringkasPengeluaran(rows: ExpenseRow[], outletIds?: Set<string>) {
  const dipakai = outletIds ? rows.filter((r) => r.scope === 'outlet' && r.outlet_id !== null && outletIds.has(r.outlet_id)) : rows
  const perKategori = new Map<string, number>()
  const perOutlet = new Map<string, number>()
  let outletTotal = 0
  let pusatTotal = 0
  for (const r of dipakai) {
    const n = Number(r.amount) || 0
    perKategori.set(r.category, (perKategori.get(r.category) ?? 0) + n)
    if (r.scope === 'pusat') pusatTotal += n
    else {
      outletTotal += n
      const nama = r.outlet_name ?? 'Outlet tidak dikenal'
      perOutlet.set(nama, (perOutlet.get(nama) ?? 0) + n)
    }
  }
  return {
    total: rp(outletTotal + pusatTotal),
    outlet_total: rp(outletTotal),
    pusat_total: rp(pusatTotal),
    per_kategori: [...perKategori]
      .map(([kategori, total]) => ({ kategori, label: (CATEGORY_META as Record<string, { label: string }>)[kategori]?.label ?? kategori, total: rp(total) }))
      .sort((a, b) => b.total - a.total),
    per_outlet: [...perOutlet].map(([outlet, total]) => ({ outlet, total: rp(total) })).sort((a, b) => b.total - a.total),
  }
}

const namaOutlet = (outlets: OutletNama[]) => {
  const peta = new Map(outlets.map((o) => [o.id, o.name]))
  return (id: string | null) => (id ? peta.get(id) ?? 'Outlet tidak dikenal' : 'Tanpa outlet')
}

/** Tanggal jual setoran: sales_date, atau sehari sebelum dicatat (WIB) — aturan app Finance. */
export const tanggalJualSetoran = (s: SetoranBaris) => s.tanggalJual ?? tambahHari(tglWib(s.occurredAt), -1)

/** Setoran TERCATAT per tanggal jual. Kosong ≠ belum setor (pencatatan mulai 2026-10-08). */
export function ringkasSetoran(rows: SetoranBaris[], outlets: OutletNama[], dari: string, sampai: string) {
  const nama = namaOutlet(outlets)
  const setoran = rows
    .filter((s) => s.outletId !== TEST_OUTLET_ID)
    .map((s) => ({ outlet: nama(s.outletId), tanggal_jual: tanggalJualSetoran(s), nominal: rp(s.nominal), jenis: s.jenis ?? 'Setoran' }))
    .filter((s) => s.tanggal_jual >= dari && s.tanggal_jual <= sampai)
    .sort((a, b) => a.tanggal_jual.localeCompare(b.tanggal_jual) || a.outlet.localeCompare(b.outlet))
  const perOutlet = new Map<string, { outlet: string; total: number; jumlah: number }>()
  for (const s of setoran) {
    const o = perOutlet.get(s.outlet) ?? { outlet: s.outlet, total: 0, jumlah: 0 }
    o.total += s.nominal
    o.jumlah += 1
    perOutlet.set(s.outlet, o)
  }
  return {
    total: setoran.reduce((t, s) => t + s.nominal, 0),
    jumlah: setoran.length,
    per_outlet: [...perOutlet.values()].sort((a, b) => b.total - a.total),
    setoran,
  }
}

/** Selisih uang fisik vs seharusnya saat tutup shift POS. Shift yang masih berjalan hari ini dilewati. */
export function ringkasSelisihKasir(shifts: ShiftBaris[], outlets: OutletNama[], hariIni: string) {
  const dikenal = new Set(outlets.map((o) => o.id))
  const nama = namaOutlet(outlets)
  const valid = shifts.filter((s) => s.outletId !== TEST_OUTLET_ID && dikenal.has(s.outletId))
  const tutup = valid.filter((s) => s.status === 'closed')

  const perOutlet = new Map<string, { outlet: string; shift_tutup: number; seharusnya: number; fisik: number; selisih: number }>()
  for (const s of tutup) {
    const o = nama(s.outletId)
    const x = perOutlet.get(o) ?? { outlet: o, shift_tutup: 0, seharusnya: 0, fisik: 0, selisih: 0 }
    x.shift_tutup += 1
    x.seharusnya += rp(s.seharusnya)
    x.fisik += rp(s.fisik)
    x.selisih += rp(s.selisih)
    perOutlet.set(o, x)
  }
  const perOutletArr = [...perOutlet.values()].sort((a, b) => Math.abs(b.selisih) - Math.abs(a.selisih) || a.outlet.localeCompare(b.outlet))

  return {
    total_selisih: perOutletArr.reduce((t, o) => t + o.selisih, 0),
    per_outlet: perOutletArr,
    shift_selisih: tutup
      .filter((s) => rp(s.selisih) !== 0)
      .map((s) => ({ tanggal: tglWib(s.mulai), outlet: nama(s.outletId), kasir: s.kasir ?? '-', seharusnya: rp(s.seharusnya), fisik: rp(s.fisik), selisih: rp(s.selisih) }))
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.outlet.localeCompare(b.outlet)),
    shift_belum_tutup: valid
      .filter((s) => s.status !== 'closed' && tglWib(s.mulai) < hariIni)
      .map((s) => ({ tanggal: tglWib(s.mulai), outlet: nama(s.outletId), kasir: s.kasir ?? '-' }))
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.outlet.localeCompare(b.outlet)),
  }
}
