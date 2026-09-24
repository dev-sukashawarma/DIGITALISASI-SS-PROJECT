/** Format tampilan murni untuk tabel master bahan baku. */
import { getDistribusiFactor } from '@/lib/format/compositeUnit'

export type TingkatTampil = {
  satuan: string
  satuan_tengah: string | null
  faktor_tengah: number | null
  satuan_kecil: string | null
  faktor_tampilan: number | null
}

const positif = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0
const angka = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 4 })

/** "1 Kg = 1.000 Gram", "1 Dus = 48 Roll = 36.480 cm", atau cukup "Pcs". */
export function ringkasSatuan(b: TingkatTampil): string {
  const kecil = b.satuan_kecil?.trim()
  if (!kecil || !positif(b.faktor_tampilan)) return b.satuan
  if (kecil.toLowerCase() === b.satuan.trim().toLowerCase() && b.faktor_tampilan === 1) return b.satuan
  const tengah = b.satuan_tengah?.trim()
  const bagianTengah = tengah && positif(b.faktor_tengah) ? ` = ${angka(b.faktor_tengah)} ${tengah}` : ''
  return `1 ${b.satuan}${bagianTengah} = ${angka(b.faktor_tampilan)} ${kecil}`
}

/** Huruf pertama kapital; sisanya apa adanya ("roll" → "Roll"). */
export function kapital(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

/** Kategori diketik bebas di data (mis. "minuman" vs "FOOD & BEVERAGE"); seragamkan saat tampil. */
export function labelKategori(k: string | null | undefined): string {
  const t = (k ?? '').trim()
  return t ? t.toUpperCase() : '—'
}

export type SatuanKirim = {
  /** Label satuan kirim ke outlet (kapital). */
  label: string
  /** Isi satu satuan kirim dalam satuan kecil, mis. "760 cm"; null bila sama dengan satuan besar. */
  isi: string | null
  /** false bila label tak cocok tingkat satuan mana pun — konversinya diam-diam jadi 1×. */
  dikenal: boolean
  /** true bila satuan_distribusi kosong dan ikut satuan besar (perilaku app stok/distribusi). */
  bawaan: boolean
}

/** Satuan kirim Gudang → outlet: `satuan_distribusi`, jatuh ke satuan besar bila kosong. */
export function ringkasSatuanKirim(b: TingkatTampil & { satuan_distribusi: string | null }): SatuanKirim {
  const dist = b.satuan_distribusi?.trim()
  if (!dist) return { label: kapital(b.satuan), isi: null, dikenal: true, bawaan: true }
  const label = kapital(dist)
  if (dist.toLowerCase() === b.satuan.trim().toLowerCase()) return { label, isi: null, dikenal: true, bawaan: false }
  const faktor = getDistribusiFactor({ ...b, satuan_distribusi: dist })
  // getDistribusiFactor mengembalikan 1 bila label tak dikenali; untuk label ≠ satuan besar itu tanda tak cocok.
  if (!positif(faktor) || faktor === 1) return { label, isi: null, dikenal: false, bawaan: false }
  const kecil = b.satuan_kecil?.trim()
  const isi = kecil && positif(b.faktor_tampilan) ? `${angka(b.faktor_tampilan / faktor)} ${kecil}` : null
  return { label, isi, dikenal: true, bawaan: false }
}

/** Tingkat satuan yang diisi crew di form opname (besar → tengah → kecil); null bila tidak diopname. */
export function ringkasSatuanOpname(b: TingkatTampil & { is_opname: boolean }): string | null {
  if (!b.is_opname) return null
  const tingkat: string[] = []
  for (const s of [b.satuan, b.satuan_tengah, b.satuan_kecil]) {
    const t = s?.trim()
    if (t && !tingkat.some((x) => x.toLowerCase() === t.toLowerCase())) tingkat.push(t)
  }
  return tingkat.join(' · ')
}

export type KunciKelompok = 'FNB' | 'BUMBU' | 'PACKAGING' | 'OPERASIONAL' | 'ASET'

/**
 * Lima kategori besar untuk mengelompokkan tabel master bahan. Empat pertama mengikuti
 * docs/MASTER-SATUAN-PO-DAN-DISTRIBUSI.md & apps/stok (Kategori); ASET + PERLENGKAPAN
 * digabung jadi satu kelompok barang non-bahan baku.
 */
export const KELOMPOK_KATEGORI: { kunci: KunciKelompok; label: string; resmi: string[] }[] = [
  { kunci: 'FNB', label: 'Food & Beverage', resmi: ['FOOD & BEVERAGE'] },
  { kunci: 'BUMBU', label: 'Bumbu', resmi: ['BUMBU'] },
  { kunci: 'PACKAGING', label: 'Packaging', resmi: ['PACKAGING'] },
  { kunci: 'OPERASIONAL', label: 'Operasional', resmi: ['OPERASIONAL'] },
  { kunci: 'ASET', label: 'Aset & Perlengkapan', resmi: ['ASET', 'PERLENGKAPAN'] },
]

/** Label lama (sebelum restrukturisasi kategori, apps/stok/docs/Restrukturisasi_Kategori_Bahan_Baku.md). */
const LABEL_LAMA: Record<string, KunciKelompok> = {
  'ITEM CORE': 'FNB',
  MINUMAN: 'FNB',
  KEMASAN: 'PACKAGING',
  'LAIN-LAIN': 'OPERASIONAL',
  LAINNYA: 'OPERASIONAL',
}

/** Kelompok tampilan untuk nilai `bahan_baku.kategori` apa pun; tak dikenal jatuh ke Operasional. */
export function kelompokKategori(k: string | null | undefined): KunciKelompok {
  const t = (k ?? '').trim().toUpperCase()
  const resmi = KELOMPOK_KATEGORI.find((g) => g.resmi.includes(t))
  return resmi?.kunci ?? LABEL_LAMA[t] ?? 'OPERASIONAL'
}

/** true bila kategori tertulis persis salah satu nama resmi (abaikan huruf/spasi). */
export function kategoriResmi(k: string | null | undefined): boolean {
  const t = (k ?? '').trim().toUpperCase()
  return KELOMPOK_KATEGORI.some((g) => g.resmi.includes(t))
}
