import { z } from 'zod'

const sel = z.union([z.string(), z.number(), z.null()])

const SkemaTabel = z.object({
  jenis: z.literal('tabel'),
  judul: z.string().optional(),
  kolom: z.array(z.string()).min(1).max(12),
  baris: z.array(z.array(sel)).max(500),
  catatan: z.string().optional(),
})
const SkemaKartu = z.object({
  jenis: z.literal('kartu'),
  judul: z.string().optional(),
  item: z
    .array(
      z.object({
        label: z.string(),
        nilai: z.union([z.string(), z.number()]),
        nada: z.enum(['netral', 'baik', 'peringatan', 'bahaya']).optional(),
        keterangan: z.string().optional(),
      }),
    )
    .max(8),
})
const SkemaGrafik = z.object({
  jenis: z.literal('grafik_batang'),
  judul: z.string().optional(),
  satuan: z.string().optional(),
  data: z.array(z.object({ label: z.string(), nilai: z.number() })).max(40),
})
export const SkemaBlokUi = z.discriminatedUnion('jenis', [SkemaTabel, SkemaKartu, SkemaGrafik])

export type BlokUi = z.infer<typeof SkemaBlokUi>
export type BlokTabel = z.infer<typeof SkemaTabel>
export type BlokKartu = z.infer<typeof SkemaKartu>
export type BlokGrafik = z.infer<typeof SkemaGrafik>

export type Bagian =
  | { jenis: 'teks'; isi: string }
  | { jenis: 'ui'; blok: BlokUi }
  | { jenis: 'ui_rusak'; mentah: string }

const PAGAR_BUKA = /^```suka-ui\s*$/
const PAGAR_TUTUP = /^```\s*$/

export function uraiPesan(teks: string): Bagian[] {
  const baris = teks.split('\n')
  const hasil: Bagian[] = []
  let buf: string[] = []
  const lepas = () => {
    const isi = buf.join('\n')
    if (isi.trim()) hasil.push({ jenis: 'teks', isi })
    buf = []
  }
  for (let i = 0; i < baris.length; i++) {
    if (PAGAR_BUKA.test(baris[i])) {
      let tutup = -1
      for (let j = i + 1; j < baris.length; j++) {
        if (PAGAR_TUTUP.test(baris[j])) {
          tutup = j
          break
        }
      }
      if (tutup !== -1) {
        lepas()
        const mentah = baris.slice(i + 1, tutup).join('\n')
        let bagian: Bagian
        try {
          const p = SkemaBlokUi.safeParse(JSON.parse(mentah))
          bagian = p.success ? { jenis: 'ui', blok: p.data } : { jenis: 'ui_rusak', mentah }
        } catch {
          bagian = { jenis: 'ui_rusak', mentah }
        }
        hasil.push(bagian)
        i = tutup
        continue
      }
    }
    buf.push(baris[i])
  }
  lepas()
  return hasil
}

// ---------- Markdown ----------

export type BlokMd =
  | { t: 'p'; baris: string[] }
  | { t: 'h'; level: 1 | 2 | 3; isi: string }
  | { t: 'ul'; items: string[] }
  | { t: 'ol'; items: string[] }
  | { t: 'tabel'; kolom: string[]; baris: string[][] }

const RE_SEP = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/
const RE_H = /^(#{1,3})\s+(.*)$/
const RE_UL = /^\s*[-*]\s+(.*)$/
const RE_OL = /^\s*\d+[.)]\s+(.*)$/

function potongSel(l: string): string[] {
  let s = l.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)
  return s.split('|').map((c) => c.trim())
}

const awalTabel = (baris: string[], i: number) =>
  baris[i].includes('|') && i + 1 < baris.length && baris[i + 1].includes('-') && RE_SEP.test(baris[i + 1])

export function uraiMarkdown(teks: string): BlokMd[] {
  const baris = teks.split('\n')
  const hasil: BlokMd[] = []
  let i = 0
  while (i < baris.length) {
    const l = baris[i]
    if (!l.trim()) {
      i++
      continue
    }
    if (awalTabel(baris, i)) {
      const kolom = potongSel(l)
      const rows: string[][] = []
      i += 2
      while (i < baris.length && baris[i].trim() && baris[i].includes('|')) {
        const s = potongSel(baris[i])
        rows.push(kolom.map((_, k) => s[k] ?? ''))
        i++
      }
      hasil.push({ t: 'tabel', kolom, baris: rows })
      continue
    }
    const h = RE_H.exec(l)
    if (h) {
      hasil.push({ t: 'h', level: h[1].length as 1 | 2 | 3, isi: h[2].trim() })
      i++
      continue
    }
    if (RE_UL.test(l) || RE_OL.test(l)) {
      const ul = RE_UL.test(l)
      const re = ul ? RE_UL : RE_OL
      const items: string[] = []
      while (i < baris.length && re.test(baris[i])) {
        items.push(re.exec(baris[i])![1].trim())
        i++
      }
      hasil.push({ t: ul ? 'ul' : 'ol', items })
      continue
    }
    const p: string[] = []
    while (
      i < baris.length &&
      baris[i].trim() &&
      !RE_H.test(baris[i]) &&
      !RE_UL.test(baris[i]) &&
      !RE_OL.test(baris[i]) &&
      !awalTabel(baris, i)
    ) {
      p.push(baris[i])
      i++
    }
    hasil.push({ t: 'p', baris: p })
  }
  return hasil
}

export type Inline = { t: 'teks' | 'b' | 'i' | 'code'; isi: string }

// Pembuka & penutup harus di baris yang sama ([^\n]).
const RE_INLINE = /`([^`\n]+)`|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/g

export function uraiInline(s: string): Inline[] {
  const hasil: Inline[] = []
  let akhir = 0
  for (const m of s.matchAll(RE_INLINE)) {
    const mulai = m.index ?? 0
    if (mulai > akhir) hasil.push({ t: 'teks', isi: s.slice(akhir, mulai) })
    if (m[1] !== undefined) hasil.push({ t: 'code', isi: m[1] })
    else if (m[2] !== undefined) hasil.push({ t: 'b', isi: m[2] })
    else hasil.push({ t: 'i', isi: m[3] })
    akhir = mulai + m[0].length
  }
  if (akhir < s.length) hasil.push({ t: 'teks', isi: s.slice(akhir) })
  return hasil
}

/** Panjang teks sel (karakter) di atas ini boleh dibungkus; di bawahnya tetap satu baris. */
export const AMBANG_SEL_PANJANG = 40
/** Daftar dipisah koma dengan lebih dari ini item ditampilkan sebagai chip. */
export const AMBANG_CHIP = 4

/**
 * Bila sel berisi daftar dipisah koma dengan > AMBANG_CHIP item, kembalikan item-itemnya
 * (untuk dirender sebagai chip). Selain itu null. Koma pemisah ribuan angka tidak dihitung.
 */
export function daftarChip(v: string | number | null | undefined): string[] | null {
  if (typeof v !== 'string') return null
  const bagian = v
    .split(/\s*[,;]\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
  return bagian.length > AMBANG_CHIP ? bagian : null
}
