/**
 * Ceklist harian area manager — port web dari modul native
 * `feature/manager/domain/CeklistHarian.kt` + `data/CeklistHarianRepository.kt`.
 *
 * Kontraknya ada di migrasi `20300238000000_ceklist_harian_area_manager` (dan
 * lanjutannya s/d `20300242000000`): nama kategori, sub-item rasa, dan nilai di
 * sini HARUS sama persis dengan CHECK di tabel `ceklist_harian_item`, karena
 * `submit_ceklist_harian` menolak seluruh kiriman bila satu saja tidak dikenal.
 *
 * Seluruh jalurnya memakai sesi pengguna (JWT), bukan service key — yang menjaga
 * kewenangan adalah database: RLS `ceklist_harian_read`, RPC
 * `submit_ceklist_harian` (hanya area_manager, tanggal ditentukan server), dan
 * `tinjau_ceklist_harian` (hanya regional manager/admin/owner).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { jakartaDayKey } from '@suka/auth'

// ---------------------------------------------------------------------------
// Domain
// ---------------------------------------------------------------------------

export type Nilai = 'baik' | 'perhatian' | 'buruk'

export const NILAI: { nilai: Nilai; label: string; emoji: string }[] = [
  { nilai: 'baik', label: 'Baik', emoji: '✅' },
  { nilai: 'perhatian', label: 'Perhatian', emoji: '⚠️' },
  { nilai: 'buruk', label: 'Buruk', emoji: '❌' },
]
const URUTAN_NILAI: Record<Nilai, number> = { baik: 0, perhatian: 1, buruk: 2 }
export const labelNilai = (n: Nilai) => NILAI.find((x) => x.nilai === n)!.label

/** Nilai terburuk dari sekumpulan penilaian — dipakai kategori Rasa. */
export function terburuk(daftar: (Nilai | null | undefined)[]): Nilai | null {
  let hasil: Nilai | null = null
  for (const n of daftar) if (n && (hasil == null || URUTAN_NILAI[n] > URUTAN_NILAI[hasil])) hasil = n
  return hasil
}

export type Butir = {
  kategori: string
  subItem: string
  label: string
  kalimat: Record<Nilai, string>
  kunci: string
}

export type Kategori = {
  kunci: string
  label: string
  petunjukFoto: string
  butir: Butir[]
  punyaSubItem: boolean
}

const k = (baik: string, perhatian: string, buruk: string): Record<Nilai, string> => ({ baik, perhatian, buruk })
const butir = (kategori: string, subItem: string, label: string, kalimat: Record<Nilai, string>): Butir => ({
  kategori, subItem, label, kalimat, kunci: subItem ? `${kategori}.${subItem}` : kategori,
})
const tunggal = (kunci: string, label: string, petunjukFoto: string, kalimat: Record<Nilai, string>): Kategori => ({
  kunci, label, petunjukFoto, butir: [butir(kunci, '', label, kalimat)], punyaSubItem: false,
})

export const KATEGORI_CEKLIST: Kategori[] = [
  tunggal('kebersihan', 'Kebersihan', 'Foto area outlet & dapur', k('Sudah baik', 'Kurang bersih', 'Kotor, perlu dibersihkan segera')),
  tunggal('stok', 'Stok', 'Foto freezer / rak stok', k('Aman', 'Kurang aman', 'Kritis, segera order')),
  tunggal('seragam_crew', 'Seragam & Crew', 'Foto crew yang bertugas', k('Lengkap', 'Kurang lengkap', 'Tidak sesuai standar')),
  {
    kunci: 'rasa',
    label: 'Rasa',
    petunjukFoto: 'Foto produk yang dicicipi',
    punyaSubItem: true,
    butir: [
      butir('rasa', 'sapi', 'Sapi', k('Tingkat kematangan dan ketebalan sudah sesuai', 'Kematangan/ketebalan kurang sesuai', 'Tidak sesuai SOP')),
      butir('rasa', 'ayam', 'Ayam', k('Sesuai SOP', 'Kurang sesuai SOP', 'Tidak sesuai SOP')),
      butir('rasa', 'kentang', 'Kentang', k('Sesuai SOP', 'Kurang sesuai SOP', 'Tidak sesuai SOP')),
      butir('rasa', 'tum', 'Tum', k('Sudah sesuai SOP', 'Kurang sesuai SOP', 'Tidak sesuai SOP')),
      butir('rasa', 'sayur', 'Sayur', k('Fresh', 'Kurang fresh', 'Layu, tidak layak pakai')),
    ],
  },
  tunggal('peralatan', 'Peralatan', 'Foto peralatan & isi freezer', k(
    'Sudah lengkap dan bahan baku di dalam freezer tersusun dengan rapih',
    'Kurang lengkap / kurang rapih',
    'Ada peralatan rusak',
  )),
]

export const SEMUA_BUTIR: Butir[] = KATEGORI_CEKLIST.flatMap((kat) => kat.butir)

/**
 * Bagian isian bebas: baris teks tanpa nilai, masing-masing opsional dan boleh
 * berfoto 0..3. Kuncinya sekaligus nilai `ceklist_harian_foto.kategori`.
 * `bolehGaleri`: tangkapan layar ulasan Google Maps tidak bisa dipotret kamera.
 */
export type KunciBebas = 'online_review' | 'temuan' | 'perbaikan'
export const BAGIAN_BEBAS: { kunci: KunciBebas; label: string; contoh: string; teksTambah: string; bolehGaleri: boolean }[] = [
  { kunci: 'online_review', label: 'Online Review', contoh: 'Contoh: Google Maps : belum ada ulasan terbaru', teksTambah: 'Tambah review', bolehGaleri: true },
  { kunci: 'temuan', label: 'Temuan', contoh: 'Contoh: 1 unit baling-baling kipas patah', teksTambah: 'Tambah temuan', bolehGaleri: false },
  { kunci: 'perbaikan', label: 'Perbaikan', contoh: 'Contoh: perbaikan/pengadaan 1 unit kipas', teksTambah: 'Tambah perbaikan', bolehGaleri: false },
]

/** Batas foto per kategori dan per bagian bebas — sama dengan batas 3 di RPC. */
export const FOTO_MAKS = 3

export type Isian = { nilai: Nilai | null; keterangan: string }
export type Foto = { path: string }
export type MapIsian = Record<string, Isian>
export type MapFoto = Record<string, Foto[]>

/**
 * Memilih nilai sekaligus mengisi keterangannya dengan kalimat baku — KECUALI
 * pengguna sudah menulis keterangan sendiri. Kalimat baku tingkat lain dianggap
 * bukan tulisan sendiri, jadi berpindah dari "Aman" ke "Kurang aman" ikut
 * mengganti teksnya.
 */
export function pilihNilai(b: Butir, lama: Isian | undefined, nilai: Nilai): Isian {
  const ket = lama?.keterangan ?? ''
  const ketikanSendiri = ket.trim() !== '' && !Object.values(b.kalimat).includes(ket.trim())
  return { nilai, keterangan: ketikanSendiri ? ket : b.kalimat[nilai] }
}

/** Keterangan yang ditampilkan: tulisan AM, atau label nilainya. */
export function keteranganTampil(isian?: Isian): string {
  const t = isian?.keterangan?.trim() ?? ''
  if (t) return t
  return isian?.nilai ? labelNilai(isian.nilai).toLowerCase() : ''
}

/** Nilai ringkas satu kategori — butir terburuk di dalamnya. */
export function nilaiKategori(kat: Kategori, isian: MapIsian): Nilai | null {
  const n = kat.butir.map((b) => isian[b.kunci]?.nilai ?? null)
  return n.some((x) => x == null) ? null : terburuk(n)
}

export const kategoriLengkap = (kat: Kategori, isian: MapIsian, foto: MapFoto) =>
  kat.butir.every((b) => isian[b.kunci]?.nilai != null) && (foto[kat.kunci]?.length ?? 0) > 0

export const jumlahKategoriLengkap = (isian: MapIsian, foto: MapFoto) =>
  KATEGORI_CEKLIST.filter((kat) => kategoriLengkap(kat, isian, foto)).length

/** Alasan ceklist belum bisa dikirim, atau null bila sudah boleh. */
export function halanganCeklist(isian: MapIsian, foto: MapFoto): string | null {
  for (const kat of KATEGORI_CEKLIST) {
    const belum = kat.butir.filter((b) => isian[b.kunci]?.nilai == null)
    if (belum.length) {
      return kat.punyaSubItem
        ? `${kat.label}: ${belum.map((b) => b.label).join(', ')} belum dinilai.`
        : `${kat.label} belum dinilai.`
    }
    if (!(foto[kat.kunci]?.length)) return `Foto ${kat.label} belum ada.`
  }
  return null
}

/** Ada butir yang tidak baik — dipakai untuk mengingatkan AM mencatat temuan. */
export const adaMasalah = (isian: MapIsian) => SEMUA_BUTIR.some((b) => (isian[b.kunci]?.nilai ?? 'baik') !== 'baik')

export type Laporan = {
  id: string
  outletId: string
  submittedBy: string
  namaAm: string
  tanggal: string
  isian: MapIsian
  foto: MapFoto
  onlineReview: string[]
  temuan: string[]
  perbaikan: string[]
  catatan: string | null
  namaPeninjau: string | null
  ditinjauPada: string | null
  tanggapanRm: string | null
  dibuatPada: string
  /** Token versi — diteruskan PERSIS seperti diterima dari PostgREST ke `tinjau`. */
  diperbaruiPada: string
}

export const sudahDitinjau = (l: Laporan) => Boolean(l.ditinjauPada)
export const nilaiKeseluruhan = (l: Laporan) => terburuk(Object.values(l.isian).map((i) => i.nilai))
export const perluPerhatian = (l: Laporan) => l.temuan.length > 0 || (nilaiKeseluruhan(l) ?? 'baik') !== 'baik'
export const teksBagian = (l: Laporan, kunci: KunciBebas) =>
  kunci === 'online_review' ? l.onlineReview : kunci === 'temuan' ? l.temuan : l.perbaikan

export type FilterCeklist = 'semua' | 'perhatian' | 'belum_dicek' | 'belum_ditinjau'
export const FILTER_CEKLIST: { kunci: FilterCeklist; label: string }[] = [
  { kunci: 'semua', label: 'Semua' },
  { kunci: 'perhatian', label: 'Perlu tindakan' },
  { kunci: 'belum_dicek', label: 'Belum dicek' },
  { kunci: 'belum_ditinjau', label: 'Belum disetujui' },
]

/** Hanya area manager yang MENGISI — `submit_ceklist_harian` menolak role lain. */
export const mengisiCeklist = (role?: string | null) => role === 'area_manager'
/** Cermin `tinjau_ceklist_harian`. */
export const meninjauCeklist = (role?: string | null) => role === 'regional_manager' || role === 'admin' || role === 'owner' || role === 'developer'
/** Cermin `boleh_membaca_ceklist_harian()`. */
export const ROLE_CEKLIST = ['area_manager', 'regional_manager', 'admin', 'owner', 'developer']

/** "09.15" waktu Jakarta dari cap waktu server. */
export function jamJakarta(iso?: string | null): string {
  if (!iso) return ''
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return ''
  return t.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }).replace(':', '.')
}

export const hariIni = () => jakartaDayKey()

/** Geser tanggal `YYYY-MM-DD` sebanyak `hari` (tanpa terpengaruh zona waktu browser). */
export function geserTanggal(tanggal: string, hari: number): string {
  const d = new Date(`${tanggal}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + hari)
  return d.toISOString().slice(0, 10)
}

export function formatTanggal(tanggal: string): string {
  return new Date(`${tanggal}T00:00:00.000Z`).toLocaleDateString('id-ID', {
    timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

export const BUCKET_CEKLIST = 'ceklist-harian-foto'
export const PESAN_VERSI_BERUBAH = 'baru saja diperbarui'

const KOLOM_LAPORAN =
  'id,outlet_id,submitted_by,nama_am,tanggal,temuan,perbaikan,online_review,catatan,' +
  'nama_peninjau,ditinjau_pada,tanggapan_rm,created_at,updated_at,' +
  'ceklist_harian_item(kategori,sub_item,nilai,keterangan),' +
  'ceklist_harian_foto(kategori,path,urutan)'

export type OutletPilihan = { id: string; nama: string }
export type DataHari = { outlets: OutletPilihan[]; laporan: Record<string, Laporan> }

/**
 * Outlet toko yang dicek. Hanya tipe `outlet` dan `mitra`: kantor pusat, gudang,
 * marketplace, dan outlet uji tidak punya rasa, crew, atau stok jualan.
 * Area manager dibatasi ke binaannya (`staff_outlets`); role lain seluruh cabang.
 */
async function muatOutlet(db: SupabaseClient, staffId: string, role: string): Promise<OutletPilihan[]> {
  let q = db.from('outlets').select('id,name').eq('is_active', true).in('type', ['outlet', 'mitra']).order('name')
  if (role === 'area_manager') {
    const { data, error } = await db.from('staff_outlets').select('outlet_id').eq('staff_id', staffId)
    if (error) throw error
    const ids = (data ?? []).map((r: { outlet_id: string }) => r.outlet_id)
    // Gagal/kosong bukan alasan membuka seluruh cabang.
    if (!ids.length) return []
    q = q.in('id', ids)
  }
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map((o: { id: string; name: string | null }) => ({ id: o.id, nama: o.name ?? '' }))
}

type BarisLaporan = {
  id: string; outlet_id: string; submitted_by: string; nama_am: string | null; tanggal: string
  temuan: string[] | null; perbaikan: string[] | null; online_review: string[] | null; catatan: string | null
  nama_peninjau: string | null; ditinjau_pada: string | null; tanggapan_rm: string | null
  created_at: string; updated_at: string
  ceklist_harian_item: { kategori: string; sub_item: string | null; nilai: Nilai; keterangan: string | null }[] | null
  ceklist_harian_foto: { kategori: string; path: string; urutan: number | null }[] | null
}

const bersihkan = (t: string[] | null) => (t ?? []).map((s) => (s ?? '').trim()).filter(Boolean)

function petakan(b: BarisLaporan): Laporan {
  const isian: MapIsian = {}
  for (const it of b.ceklist_harian_item ?? []) {
    const kunci = it.sub_item ? `${it.kategori}.${it.sub_item}` : it.kategori
    isian[kunci] = { nilai: it.nilai, keterangan: it.keterangan ?? '' }
  }
  const foto: MapFoto = {}
  for (const f of [...(b.ceklist_harian_foto ?? [])].sort((x, y) => (x.urutan ?? 0) - (y.urutan ?? 0))) {
    ;(foto[f.kategori] ??= []).push({ path: f.path })
  }
  return {
    id: b.id, outletId: b.outlet_id, submittedBy: b.submitted_by, namaAm: b.nama_am ?? '', tanggal: b.tanggal,
    isian, foto,
    onlineReview: bersihkan(b.online_review), temuan: bersihkan(b.temuan), perbaikan: bersihkan(b.perbaikan),
    catatan: b.catatan, namaPeninjau: b.nama_peninjau, ditinjauPada: b.ditinjau_pada, tanggapanRm: b.tanggapan_rm,
    dibuatPada: b.created_at, diperbaruiPada: b.updated_at,
  }
}

/** Outlet dan laporan pada `tanggal` — dua kueri paralel, satu round-trip laporan (item & foto di-embed). */
export async function muatHari(db: SupabaseClient, staffId: string, role: string, tanggal: string): Promise<DataHari> {
  const [outlets, lap] = await Promise.all([
    muatOutlet(db, staffId, role),
    db.from('ceklist_harian').select(KOLOM_LAPORAN).eq('tanggal', tanggal),
  ])
  if (lap.error) throw lap.error
  const ids = new Set(outlets.map((o) => o.id))
  const laporan: Record<string, Laporan> = {}
  // Laporan outlet di luar daftar (mis. baru dinonaktifkan) dibuang supaya hitungan cocok.
  for (const baris of (lap.data ?? []) as unknown as BarisLaporan[]) {
    if (ids.has(baris.outlet_id)) laporan[baris.outlet_id] = petakan(baris)
  }
  return { outlets, laporan }
}

/** Jumlah laporan hari ini yang belum ditinjau — lencana menu RM. */
export async function jumlahBelumDitinjau(db: SupabaseClient): Promise<number> {
  const { count } = await db.from('ceklist_harian').select('id', { count: 'exact', head: true })
    .eq('tanggal', hariIni()).is('ditinjau_pada', null)
  return count ?? 0
}

/**
 * Mengecilkan gambar ke sisi terpanjang 1280px lalu memampatkannya ke WebP —
 * batas bucket 2 MB, dan hanya jpeg/webp yang diterima.
 */
export async function keWebp(file: Blob, sisiMaks = 1280, kualitas = 0.8): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  try {
    const skala = Math.min(1, sisiMaks / Math.max(bmp.width, bmp.height))
    const w = Math.max(1, Math.round(bmp.width * skala))
    const h = Math.max(1, Math.round(bmp.height * skala))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', kualitas))
    // Safari lama tidak bisa encode WebP dan diam-diam memberi PNG — pakai JPEG.
    if (blob && blob.type === 'image/webp') return blob
    const jpeg = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', kualitas))
    if (!jpeg) throw new Error('Gambar tidak bisa diproses')
    return jpeg
  } finally {
    bmp.close()
  }
}

/**
 * Mengunggah satu foto dan mengembalikan path-nya. Path WAJIB diawali id
 * pengguna: policy `ceklist_harian_photo_upload` menuntut folder pertama =
 * `auth.uid()`, dan `submit_ceklist_harian` menolak path lain.
 */
export async function unggahFoto(db: SupabaseClient, staffId: string, outletId: string, kategori: string, gambar: Blob): Promise<string> {
  const ext = gambar.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${staffId}/${hariIni()}/${outletId}/${kategori}-${crypto.randomUUID()}.${ext}`
  // Tanpa upsert: nama UUID baru tiap potret, dan bucket ini tidak punya policy UPDATE.
  const { error } = await db.storage.from(BUCKET_CEKLIST).upload(path, gambar, { contentType: gambar.type, upsert: false })
  if (error) throw error
  return path
}

/** URL bertanda tangan 1 jam untuk banyak path sekaligus — satu request, bukan satu per foto. */
export async function urlFotoBanyak(db: SupabaseClient, paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {}
  const { data, error } = await db.storage.from(BUCKET_CEKLIST).createSignedUrls(paths, 3600)
  if (error) throw error
  const hasil: Record<string, string> = {}
  for (const d of data ?? []) if (d.path && d.signedUrl) hasil[d.path] = d.signedUrl
  return hasil
}

export async function kirimCeklist(db: SupabaseClient, a: {
  outletId: string; isian: MapIsian; foto: MapFoto
  onlineReview: string[]; temuan: string[]; perbaikan: string[]; catatan: string
}) {
  const teks = (d: string[]) => d.map((t) => t.trim()).filter(Boolean)
  const { error } = await db.rpc('submit_ceklist_harian', {
    p_outlet_id: a.outletId,
    p_items: SEMUA_BUTIR.map((b) => ({
      kategori: b.kategori,
      sub_item: b.subItem,
      nilai: a.isian[b.kunci]?.nilai ?? null,
      keterangan: a.isian[b.kunci]?.keterangan.trim() || null,
    })),
    p_foto: Object.entries(a.foto).flatMap(([kategori, isi]) => isi.map((f) => ({ kategori, path: f.path }))),
    p_temuan: teks(a.temuan),
    p_perbaikan: teks(a.perbaikan),
    p_online_review: teks(a.onlineReview),
    p_catatan: a.catatan.trim() || null,
  })
  if (error) throw error
}

/**
 * RM menyetujui laporan. `diperbaruiPada`/`ditinjauPada` adalah versi yang SEDANG
 * TAMPIL; server menolak bila AM sudah mengirim ulang atau peninjau lain sudah
 * menanggapi sejak itu (migrasi 20300242).
 */
export async function tinjauCeklist(db: SupabaseClient, l: Laporan, tanggapan: string) {
  const { error } = await db.rpc('tinjau_ceklist_harian', {
    p_ceklist_id: l.id,
    p_tanggapan: tanggapan.trim() || null,
    p_diperbarui_pada: l.diperbaruiPada || null,
    p_ditinjau_pada: l.ditinjauPada || null,
  })
  if (error) throw error
}

/** Pesan RAISE EXCEPTION dari RPC sudah berbahasa Indonesia; dipetakan bila dikenali. */
export function pesanKirimGagal(e: unknown): string {
  const isi = (e as { message?: string })?.message ?? ''
  if (isi.includes('sudah diisi oleh')) return `${isi}.`
  if (isi.includes('Outlet di luar scope')) return 'Outlet ini di luar cakupan binaan Anda.'
  if (isi.includes('Hanya area manager')) return 'Hanya area manager yang bisa mengisi ceklist harian.'
  if (isi.includes('Foto ceklist') || isi.includes('Path foto')) return 'Ada foto yang belum lengkap atau tidak sah. Unggah ulang.'
  if (isi.includes('Penilaian ceklist')) return 'Masih ada penilaian yang belum diisi.'
  if (/fetch|network/i.test(isi)) return 'Koneksi terputus. Periksa internet lalu coba lagi.'
  return 'Gagal mengirim ceklist. Coba lagi.'
}
