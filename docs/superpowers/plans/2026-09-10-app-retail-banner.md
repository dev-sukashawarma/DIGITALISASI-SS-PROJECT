# App Retail Tahap 2 — Banner: Rencana Implementasi

> **Untuk pekerja agentik:** SUB-SKILL WAJIB: pakai `superpowers:subagent-driven-development` (disarankan) atau `superpowers:executing-plans` untuk mengerjakan rencana ini task demi task. Langkah memakai checkbox (`- [ ]`) untuk penanda.

**Goal:** Memberi sumber data pada carousel & popup promo di aplikasi pelanggan lewat tabel `app_banners`, endpoint `GET /api/v1/banners`, dan halaman admin — sekaligus mencabut janji voucher `SUKABARU` yang tidak ada.

**Architecture:** Satu tabel Postgres dibaca gateway dengan service client dan disajikan sebagai JSON; Android mengonsumsi JSON itu dan berhenti memakai daftar hardcoded. Dashboard admin menulis tabel lewat Server Action dengan sesi pengguna (RLS role `admin`). Aplikasi Android tak pernah menyentuh Supabase.

**Tech Stack:** Postgres/Supabase · Next.js 16 App Router (gateway & admin) · vitest · Kotlin + Jetpack Compose + Ktor · JUnit4 + Robolectric

**Spec:** `docs/superpowers/specs/2026-09-10-app-retail-banner-design.md`

## Global Constraints

- **Nol baris berubah** di `apps/pos-kasir/`, `pos-admin/`, `mobile/native-pos/`, `mobile/native-superapp/`. Diperiksa dengan `git diff --name-only origin/main...HEAD`.
- **Migration TIDAK di-apply oleh pekerja.** File ditulis, lint dijalankan, lalu berhenti. Penerapan ke DB produksi milik owner.
- **Timestamp migration bertanggal hari ini (`20260910…`).** `scripts/migration-timestamp-lint.mjs` menolak apa pun lebih dari 2 hari ke depan. **Jangan ada timestamp 2030.**
- **Role RLS `admin` persis.** `owner` dan `admin_hr` role berbeda dan tidak lolos policy tulis.
- Nilai enum persis: `slot` ∈ {`carousel`, `popup`} · `aksi` ∈ {`tidak_ada`, `menu`, `menu_item`}.
- Nama bucket storage: **`app-banners`** — wajib diverifikasi ke proyek Supabase hidup sebelum ditulis ke kode (Task 4 Langkah 1).
- Semua teks yang dilihat pengguna dan semua komentar kode dalam **Bahasa Indonesia**, mengikuti berkas di sekitarnya.
- Aplikasi Android **tidak boleh** memuat Supabase SDK, anon key, service-role key, atau URL Supabase.

---

## Struktur Berkas

**Dibuat:**

| Berkas | Tanggung jawab |
|---|---|
| `supabase/migrations/20260911100000_app_banners.sql` | Tabel, CHECK, RLS, REVOKE |
| `apps/retail-gateway/src/lib/banners.ts` | Fungsi murni: pilih popup pemenang, petakan baris → DTO |
| `apps/retail-gateway/src/lib/banners.test.ts` | Tes fungsi murni di atas |
| `apps/retail-gateway/src/app/api/v1/banners/route.ts` | Endpoint |
| `apps/admin-dashboard/src/lib/appRetail/bannerForm.ts` | Fungsi murni validasi formulir |
| `apps/admin-dashboard/src/lib/appRetail/bannerForm.test.ts` | Tes validasi |
| `apps/admin-dashboard/src/app/dashboard/app-retail/banner/page.tsx` | Server component pembaca data |
| `apps/admin-dashboard/src/app/dashboard/app-retail/banner/BannerView.tsx` | Daftar + orkestrasi client |
| `apps/admin-dashboard/src/app/dashboard/app-retail/banner/PanelEditBanner.tsx` | Formulir satu banner |
| `mobile/customer-app/.../ui/home/TujuanBanner.kt` | Fungsi murni: `aksi` → tujuan, dan boleh-tampil popup |
| `mobile/customer-app/app/src/test/.../ui/home/TujuanBannerTest.kt` | Tes fungsi murni di atas |
| `mobile/customer-app/.../data/BannerDilihatStore.kt` | SharedPreferences: id popup yang sudah dilihat |

**Diubah:**

| Berkas | Perubahan |
|---|---|
| `apps/admin-dashboard/src/app/dashboard/app-retail/actions.ts` | +3 action banner |
| `apps/admin-dashboard/src/components/layout/navConfig.ts:157-161` | +1 entri nav |
| `apps/admin-dashboard/src/components/layout/navConfig.test.ts:36-38, 91-93` | +1 route di dua daftar |
| `mobile/customer-app/.../data/api/Dto.kt` | +`BannerDto`, +`BannersResponse` |
| `mobile/customer-app/.../data/api/GatewayClient.kt` | +`banners()` |
| `mobile/customer-app/.../data/Repository.kt` | +`banners()` |
| `mobile/customer-app/.../ui/menu/CatalogViewModel.kt` | +field state banner, +pemuatan |
| `mobile/customer-app/.../ui/home/HomeScreen.kt` | hapus `promoSlideItems`, carousel & popup pakai state |
| `mobile/customer-app/.../ui/components/PromoPopupDialog.kt` | cabut blok voucher & seluruh default |

---

### Task 1: Migration tabel `app_banners`

**Files:**
- Create: `supabase/migrations/20260911100000_app_banners.sql`

**Interfaces:**
- Consumes: —
- Produces: tabel `app_banners` dengan kolom `id, slot, urutan, badge, judul, subjudul, teks_tombol, gambar_url, aksi, target_menu_item_id, aktif, dibuat_pada, diubah_pada`

- [ ] **Langkah 1: Tulis migration**

```sql
-- App Retail Tahap 2: banner promosi aplikasi pelanggan.
--
-- Dibaca gateway dengan service client (GET /api/v1/banners); ditulis
-- dashboard admin dengan sesi pengguna. Aplikasi Android TIDAK pernah
-- menyentuh tabel ini langsung.

CREATE TABLE IF NOT EXISTS public.app_banners (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot                text NOT NULL CHECK (slot IN ('carousel', 'popup')),
  urutan              integer NOT NULL DEFAULT 0,
  badge               text,
  judul               text NOT NULL,
  subjudul            text,
  teks_tombol         text,
  gambar_url          text,
  aksi                text NOT NULL DEFAULT 'tidak_ada'
                      CHECK (aksi IN ('tidak_ada', 'menu', 'menu_item')),
  target_menu_item_id uuid REFERENCES public.menu_items(id) ON DELETE SET NULL,
  aktif               boolean NOT NULL DEFAULT false,
  dibuat_pada         timestamptz NOT NULL DEFAULT now(),
  diubah_pada         timestamptz NOT NULL DEFAULT now(),

  -- Target wajib ADA saat aksi 'menu_item', dan wajib KOSONG selain itu.
  -- Ditegakkan basis data: formulir bisa dilewati, CHECK tidak.
  CONSTRAINT app_banners_target_sesuai_aksi CHECK (
    (aksi = 'menu_item' AND target_menu_item_id IS NOT NULL)
    OR (aksi <> 'menu_item' AND target_menu_item_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS app_banners_slot_aktif_urutan_idx
  ON public.app_banners (slot, aktif, urutan);

-- Supabase memberi GRANT ALL ke anon & authenticated lewat default
-- privileges untuk setiap tabel baru. Menulis GRANT tidak membatasi apa
-- pun -- yang membatasi adalah REVOKE ini. (Pelajaran bahan_baku_supplier,
-- 2026-09-08.)
REVOKE ALL ON public.app_banners FROM anon, authenticated;

ALTER TABLE public.app_banners ENABLE ROW LEVEL SECURITY;

-- Satu policy tulis, role `admin` PERSIS -- pola menu_items_all_admin.
-- `owner` dan `admin_hr` adalah role berbeda dan sengaja tidak lolos.
-- NOL policy untuk anon: pelanggan membaca lewat gateway (service client),
-- bukan lewat RLS.
DROP POLICY IF EXISTS app_banners_all_admin ON public.app_banners;
CREATE POLICY app_banners_all_admin ON public.app_banners
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.outlet_staff s
      WHERE s.id = auth.uid() AND s.role = 'admin' AND s.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.outlet_staff s
      WHERE s.id = auth.uid() AND s.role = 'admin' AND s.status = 'active'
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_banners TO authenticated;
```

- [ ] **Langkah 2: Jalankan lint timestamp**

Run: `node scripts/migration-timestamp-lint.mjs`
Expected: keluar dengan kode 0, tanpa menyebut `20260911100000`.

- [ ] **Langkah 3: JANGAN apply**

Migration ini **tidak** dijalankan ke basis data oleh pekerja. Laporkan di ringkasan task bahwa file siap dan menunggu persetujuan owner.

- [ ] **Langkah 4: Commit**

```bash
git add supabase/migrations/20260911100000_app_banners.sql
git commit -m "feat(db): tabel app_banners untuk banner App Retail (belum di-apply)"
```

---

### Task 2: Fungsi murni gateway

**Files:**
- Create: `apps/retail-gateway/src/lib/banners.ts`
- Test: `apps/retail-gateway/src/lib/banners.test.ts`

**Interfaces:**
- Consumes: bentuk baris dari Task 1
- Produces:
  - `export type BannerApp = { id: string; badge: string | null; judul: string; subjudul: string | null; teks_tombol: string | null; gambar_url: string | null; aksi: 'tidak_ada' | 'menu' | 'menu_item'; target_menu_item_id: string | null; urutan: number }`
  - ⚠️ `urutan` **ikut ada di tipe ini dan ikut terkirim ke JSON.** `pilihPopup` membutuhkannya, dan memisahkan tipe internal dari tipe respons hanya untuk menyembunyikan satu angka tidak sepadan. Sisi Android sengaja **tidak** mendeklarasikannya di `BannerDto` (Task 6) — urutan carousel sudah dibawa oleh urutan array.
  - `export function petakanBanner(baris: unknown): BannerApp | null`
  - `export function pilihPopup(baris: BannerApp[]): BannerApp | null`

- [ ] **Langkah 1: Tulis tes yang gagal**

```ts
import { describe, it, expect } from 'vitest'
import { petakanBanner, pilihPopup, type BannerApp } from './banners'

function contoh(ubah: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'b1', badge: '🔥 Promo', judul: 'Judul', subjudul: 'Sub',
    teks_tombol: 'Pesan', gambar_url: 'https://x/y.jpg',
    aksi: 'tidak_ada', target_menu_item_id: null, urutan: 0, ...ubah,
  }
}

describe('petakanBanner', () => {
  it('memetakan baris lengkap', () => {
    expect(petakanBanner(contoh())?.judul).toBe('Judul')
  })

  it('menolak baris tanpa judul', () => {
    expect(petakanBanner(contoh({ judul: null }))).toBeNull()
  })

  it('menolak aksi yang tidak dikenal', () => {
    expect(petakanBanner(contoh({ aksi: 'buka_url' }))).toBeNull()
  })

  it('menolak menu_item tanpa target', () => {
    expect(petakanBanner(contoh({ aksi: 'menu_item' }))).toBeNull()
  })

  it('mengosongkan teks kosong jadi null', () => {
    expect(petakanBanner(contoh({ badge: '' }))?.badge).toBeNull()
  })
})

describe('pilihPopup', () => {
  // `urutan` WAJIB lewat argumen contoh(), bukan disebar sebelum spread --
  // spread menang, jadi `{ urutan: 5, ...contoh() }` diam-diam jadi 0.
  const a = contoh({ id: 'a', urutan: 5 }) as unknown as BannerApp
  const b = contoh({ id: 'b', urutan: 1 }) as unknown as BannerApp

  it('mengembalikan null saat tidak ada', () => {
    expect(pilihPopup([])).toBeNull()
  })

  it('memilih urutan terkecil saat lebih dari satu', () => {
    expect(pilihPopup([a, b])?.id).toBe('b')
  })
})
```

- [ ] **Langkah 2: Jalankan tes, pastikan gagal**

Run: `cd apps/retail-gateway && yarn test banners`
Expected: FAIL — `Failed to resolve import "./banners"`.

- [ ] **Langkah 3: Tulis implementasi minimal**

```ts
/**
 * Pemetaan baris `app_banners` menjadi bentuk yang dikonsumsi aplikasi.
 *
 * Baris yang tidak utuh DIBUANG, bukan dikirim setengah jadi. Banner adalah
 * permukaan promosi paling menonjol di Beranda; baris rusak yang lolos akan
 * tampil sebagai kartu kosong yang bisa diketuk, dan itu lebih buruk
 * daripada tidak ada banner sama sekali.
 */

const AKSI_SAH = ['tidak_ada', 'menu', 'menu_item'] as const
export type AksiBanner = (typeof AKSI_SAH)[number]

export type BannerApp = {
  id: string
  badge: string | null
  judul: string
  subjudul: string | null
  teks_tombol: string | null
  gambar_url: string | null
  aksi: AksiBanner
  target_menu_item_id: string | null
  urutan: number
}

/** Teks kosong dari formulir berarti "tidak diisi", bukan string kosong. */
function teks(nilai: unknown): string | null {
  if (typeof nilai !== 'string') return null
  const rapi = nilai.trim()
  return rapi === '' ? null : rapi
}

export function petakanBanner(baris: unknown): BannerApp | null {
  if (typeof baris !== 'object' || baris === null) return null
  const r = baris as Record<string, unknown>

  const id = teks(r.id)
  const judul = teks(r.judul)
  if (!id || !judul) return null

  const aksi = teks(r.aksi) ?? 'tidak_ada'
  if (!(AKSI_SAH as readonly string[]).includes(aksi)) return null

  const target = teks(r.target_menu_item_id)
  // Cerminan CHECK di basis data. Diperiksa lagi di sini karena baris bisa
  // lahir sebelum constraint itu ada, atau lewat jalur lain.
  if (aksi === 'menu_item' && !target) return null
  if (aksi !== 'menu_item' && target) return null

  return {
    id,
    badge: teks(r.badge),
    judul,
    subjudul: teks(r.subjudul),
    teks_tombol: teks(r.teks_tombol),
    gambar_url: teks(r.gambar_url),
    aksi: aksi as AksiBanner,
    target_menu_item_id: target,
    urutan: typeof r.urutan === 'number' ? r.urutan : 0,
  }
}

/**
 * Popup pemenang saat lebih dari satu aktif: `urutan` terkecil.
 *
 * Deterministik dengan sengaja -- admin tidak perlu diingatkan aturan
 * "cuma boleh satu" yang tak ditegakkan apa pun.
 */
export function pilihPopup(baris: BannerApp[]): BannerApp | null {
  if (baris.length === 0) return null
  return baris.reduce((menang, kini) => (kini.urutan < menang.urutan ? kini : menang))
}
```

- [ ] **Langkah 4: Jalankan tes, pastikan lulus**

Run: `cd apps/retail-gateway && yarn test banners`
Expected: PASS, 7 tes.

- [ ] **Langkah 5: Commit**

```bash
git add apps/retail-gateway/src/lib/banners.ts apps/retail-gateway/src/lib/banners.test.ts
git commit -m "feat(gateway): fungsi murni pemetaan & pemilihan banner"
```

---

### Task 3: Endpoint `GET /api/v1/banners`

**Files:**
- Create: `apps/retail-gateway/src/app/api/v1/banners/route.ts`

**Interfaces:**
- Consumes: `petakanBanner`, `pilihPopup`, `BannerApp` dari Task 2
- Produces: `GET /api/v1/banners` → `{ carousel: BannerApp[], popup: BannerApp | null }`

- [ ] **Langkah 1: Tulis route**

Pola persis `apps/retail-gateway/src/app/api/v1/outlets/route.ts`.

```ts
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { petakanBanner, pilihPopup, type BannerApp } from '@/lib/banners'

export const dynamic = 'force-dynamic'

// Sengaja TANPA cache. Katalog di-cache 5 menit karena besar dan sering
// dibaca; banner kecil dan dibaca sekali per buka Beranda. Cache di sini
// hanya menciptakan pertanyaan "kenapa perubahan saya belum muncul".

export async function GET() {
  const db = createServiceClient()
  const { data, error } = await db
    .from('app_banners')
    .select('id, slot, urutan, badge, judul, subjudul, teks_tombol, gambar_url, aksi, target_menu_item_id')
    .eq('aktif', true)
    .order('urutan', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Gagal memuat banner' }, { status: 502 })
  }

  const baris = data ?? []
  const carousel: BannerApp[] = []
  const popupKandidat: BannerApp[] = []

  for (const b of baris) {
    const dipetakan = petakanBanner(b)
    if (!dipetakan) continue
    if ((b as { slot?: unknown }).slot === 'popup') popupKandidat.push(dipetakan)
    else carousel.push(dipetakan)
  }

  return NextResponse.json({ carousel, popup: pilihPopup(popupKandidat) })
}
```

- [ ] **Langkah 2: Type-check**

Run: `cd apps/retail-gateway && yarn type-check`
Expected: 0 error.

- [ ] **Langkah 3: Commit**

```bash
git add apps/retail-gateway/src/app/api/v1/banners/route.ts
git commit -m "feat(gateway): endpoint GET /api/v1/banners"
```

---

### Task 4: Validasi formulir + Server Action admin

**Files:**
- Create: `apps/admin-dashboard/src/lib/appRetail/bannerForm.ts`
- Test: `apps/admin-dashboard/src/lib/appRetail/bannerForm.test.ts`
- Modify: `apps/admin-dashboard/src/app/dashboard/app-retail/actions.ts`

**Interfaces:**
- Consumes: `pastikanTerubah` (sudah ada di `actions.ts`)
- Produces:
  - `export type InputBanner = { slot: 'carousel' | 'popup'; urutan: number; badge: string; judul: string; subjudul: string; teksTombol: string; gambarUrl: string; aksi: 'tidak_ada' | 'menu' | 'menu_item'; targetMenuItemId: string | null }`
  - `export function periksaBanner(input: InputBanner): string | null` — pesan galat, atau `null` bila sah
  - `export async function simpanBanner(id: string | null, input: InputBanner): Promise<void>`
  - `export async function toggleBannerAktif(id: string, sedangAktif: boolean): Promise<void>`
  - `export async function hapusBanner(id: string): Promise<void>`

- [ ] **Langkah 1: Verifikasi nama bucket ke Supabase hidup**

Buka Supabase Studio → Storage. Catat nama bucket yang benar-benar ada.

Kalau `app-banners` belum ada, **buat** dengan nama persis itu, akses baca publik.

⚠️ Jangan lewati langkah ini. Di Tahap 1 nama `menu_images` ditulis dari ingatan, diwarisi spec → rencana → kode → produksi, dan unggah foto gagal senyap; yang benar `menu-images`.

Laporkan di ringkasan task nama bucket yang diverifikasi.

- [ ] **Langkah 2: Tulis tes validasi yang gagal**

```ts
import { describe, it, expect } from 'vitest'
import { periksaBanner, type InputBanner } from './bannerForm'

function input(ubah: Partial<InputBanner> = {}): InputBanner {
  return {
    slot: 'carousel', urutan: 0, badge: '', judul: 'Judul',
    subjudul: '', teksTombol: '', gambarUrl: '',
    aksi: 'tidak_ada', targetMenuItemId: null, ...ubah,
  }
}

describe('periksaBanner', () => {
  it('menerima banner minimal', () => {
    expect(periksaBanner(input())).toBeNull()
  })

  it('menolak judul kosong', () => {
    expect(periksaBanner(input({ judul: '   ' }))).toMatch(/Judul/)
  })

  it('menolak menu_item tanpa target', () => {
    expect(periksaBanner(input({ aksi: 'menu_item' }))).toMatch(/menu tujuan/i)
  })

  it('menolak target terisi saat aksi bukan menu_item', () => {
    expect(periksaBanner(input({ aksi: 'menu', targetMenuItemId: 'm1' }))).toMatch(/menu tujuan/i)
  })

  it('menerima menu_item dengan target', () => {
    expect(periksaBanner(input({ aksi: 'menu_item', targetMenuItemId: 'm1' }))).toBeNull()
  })
})
```

- [ ] **Langkah 3: Jalankan tes, pastikan gagal**

Run: `cd apps/admin-dashboard && yarn test bannerForm`
Expected: FAIL — modul tidak ditemukan.

- [ ] **Langkah 4: Tulis validasi**

```ts
export type SlotBanner = 'carousel' | 'popup'
export type AksiBanner = 'tidak_ada' | 'menu' | 'menu_item'

export type InputBanner = {
  slot: SlotBanner
  urutan: number
  badge: string
  judul: string
  subjudul: string
  teksTombol: string
  gambarUrl: string
  aksi: AksiBanner
  targetMenuItemId: string | null
}

/**
 * Mencerminkan CHECK `app_banners_target_sesuai_aksi` di basis data.
 *
 * Diperiksa di sini supaya admin melihat pesan yang bisa dibaca manusia,
 * bukan galat constraint Postgres. Basis data tetap yang menegakkan --
 * pemeriksaan ini kenyamanan, bukan penjaga.
 */
export function periksaBanner(input: InputBanner): string | null {
  if (input.judul.trim() === '') return 'Judul wajib diisi.'

  const punyaTarget = (input.targetMenuItemId ?? '').trim() !== ''
  if (input.aksi === 'menu_item' && !punyaTarget) {
    return 'Pilih menu tujuan, atau ubah aksinya.'
  }
  if (input.aksi !== 'menu_item' && punyaTarget) {
    return 'Menu tujuan hanya berlaku untuk aksi "buka menu tertentu".'
  }
  return null
}
```

- [ ] **Langkah 5: Jalankan tes, pastikan lulus**

Run: `cd apps/admin-dashboard && yarn test bannerForm`
Expected: PASS, 5 tes.

- [ ] **Langkah 6: Tambahkan Server Action**

Sisipkan di akhir `apps/admin-dashboard/src/app/dashboard/app-retail/actions.ts`, dan tambahkan `revalidatePath('/dashboard/app-retail/banner')` ke dalam fungsi `segarkan()` yang sudah ada.

```ts
import { periksaBanner, type InputBanner } from '@/lib/appRetail/bannerForm'

/** Teks kosong dari formulir disimpan sebagai NULL, bukan string kosong. */
function nullBilaKosong(nilai: string): string | null {
  const rapi = nilai.trim()
  return rapi === '' ? null : rapi
}

function barisDariInput(input: InputBanner) {
  return {
    slot: input.slot,
    urutan: input.urutan,
    badge: nullBilaKosong(input.badge),
    judul: input.judul.trim(),
    subjudul: nullBilaKosong(input.subjudul),
    teks_tombol: nullBilaKosong(input.teksTombol),
    gambar_url: nullBilaKosong(input.gambarUrl),
    aksi: input.aksi,
    target_menu_item_id:
      input.aksi === 'menu_item' ? nullBilaKosong(input.targetMenuItemId ?? '') : null,
    diubah_pada: new Date().toISOString(),
  }
}

/**
 * Banner baru lahir NONAKTIF -- `aktif` sengaja tidak ditulis di sini, jadi
 * DEFAULT false dari basis data yang berlaku. Menyimpan draft tidak boleh
 * langsung menayangkannya ke pelanggan; menyalakannya adalah tindakan
 * terpisah dan sadar lewat `toggleBannerAktif`.
 */
export async function simpanBanner(id: string | null, input: InputBanner) {
  const galat = periksaBanner(input)
  if (galat) throw new Error(galat)

  const supabase = await getSupabase()
  const baris = barisDariInput(input)

  const { data, error } = id
    ? await supabase.from('app_banners').update(baris).eq('id', id).select('id')
    : await supabase.from('app_banners').insert(baris).select('id')

  if (error) throw new Error(error.message)
  pastikanTerubah(
    data,
    'Banner tidak tersimpan — akun ini belum berhak mengubah pengaturan aplikasi.',
  )
  segarkan()
}

/**
 * Menegasikan `sedangAktif` DI SINI, sama seperti `toggleTayangDiApp`.
 * Pemanggil mengirim keadaan sekarang, bukan keadaan yang diinginkan.
 */
export async function toggleBannerAktif(id: string, sedangAktif: boolean) {
  const supabase = await getSupabase()
  const { data, error } = await supabase
    .from('app_banners')
    .update({ aktif: !sedangAktif, diubah_pada: new Date().toISOString() })
    .eq('id', id)
    .select('id')
  if (error) throw new Error(error.message)
  pastikanTerubah(
    data,
    'Status banner tidak berubah — akun ini belum berhak mengubah pengaturan aplikasi.',
  )
  segarkan()
}

export async function hapusBanner(id: string) {
  const supabase = await getSupabase()
  const { data, error } = await supabase
    .from('app_banners')
    .delete()
    .eq('id', id)
    .select('id')
  if (error) throw new Error(error.message)
  pastikanTerubah(
    data,
    'Banner tidak terhapus — akun ini belum berhak mengubah pengaturan aplikasi.',
  )
  segarkan()
}
```

- [ ] **Langkah 7: Type-check**

Run: `cd apps/admin-dashboard && yarn type-check`
Expected: tidak ada error baru pada `actions.ts` atau `bannerForm.ts`. (Error pre-existing di berkas lain boleh tetap ada — catat jumlahnya sebelum dan sesudah.)

- [ ] **Langkah 8: Commit**

```bash
git add apps/admin-dashboard/src/lib/appRetail/bannerForm.ts \
        apps/admin-dashboard/src/lib/appRetail/bannerForm.test.ts \
        apps/admin-dashboard/src/app/dashboard/app-retail/actions.ts
git commit -m "feat(admin): validasi & server action banner App Retail"
```

---

### Task 5: Halaman admin + entri nav

**Files:**
- Create: `apps/admin-dashboard/src/app/dashboard/app-retail/banner/page.tsx`
- Create: `apps/admin-dashboard/src/app/dashboard/app-retail/banner/BannerView.tsx`
- Create: `apps/admin-dashboard/src/app/dashboard/app-retail/banner/PanelEditBanner.tsx`
- Modify: `apps/admin-dashboard/src/components/layout/navConfig.ts:157-161`
- Modify: `apps/admin-dashboard/src/components/layout/navConfig.test.ts:36-38, 91-93`

**Interfaces:**
- Consumes: `simpanBanner`, `toggleBannerAktif`, `hapusBanner`, `periksaBanner`, `InputBanner` dari Task 4
- Produces: route `/dashboard/app-retail/banner`

- [ ] **Langkah 1: Tambahkan entri nav**

Di `navConfig.ts`, sisipkan setelah baris 160 (`Outlet Aplikasi`), di dalam `items` grup `App Retail`:

```ts
      { href: '/dashboard/app-retail/banner', label: 'Banner Aplikasi', shortLabel: 'Banner App', icon: Images, roles: ['OWNER', 'ADMIN'] },
```

Tambahkan `Images` ke daftar import `lucide-react` di kepala berkas.

- [ ] **Langkah 2: Jalankan tes nav, pastikan gagal**

Run: `cd apps/admin-dashboard && yarn test navConfig`
Expected: FAIL — snapshot route ADMIN & OWNER tidak cocok, dan uji "setiap href punya page.tsx" gagal karena halamannya belum ada.

- [ ] **Langkah 3: Perbarui daftar route di tes**

Di `navConfig.test.ts`, tambahkan `'/dashboard/app-retail/banner'` **setelah** `'/dashboard/app-retail/outlet'` di **kedua** daftar (sekitar baris 38 dan 93).

`EXPECTED_GROUP_COUNT` **tidak berubah** — ini item baru di grup yang sudah ada, bukan grup baru.

- [ ] **Langkah 4: Tulis halaman**

`page.tsx`:

```tsx
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import BannerView from './BannerView'

export const dynamic = 'force-dynamic'

export default async function AppRetailBannerPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  const [bannerRes, menuRes] = await Promise.all([
    supabase
      .from('app_banners')
      .select('id, slot, urutan, badge, judul, subjudul, teks_tombol, gambar_url, aksi, target_menu_item_id, aktif')
      .order('slot')
      .order('urutan'),
    supabase
      .from('menu_items')
      .select('id, name')
      .eq('tampil_di_app', true)
      .order('name'),
  ])

  return (
    <BannerView
      banners={bannerRes.data ?? []}
      menuPilihan={(menuRes.data ?? []) as { id: string; name: string }[]}
      galat={bannerRes.error ? bannerRes.error.message : null}
    />
  )
}
```

`BannerView.tsx` — client component. Wajib memuat:

- `'use client'` di baris pertama.
- Dua bagian terpisah berjudul **"Carousel Beranda"** dan **"Popup Beranda"**, disaring dari prop `banners` berdasarkan `slot`.
- Tiap baris menampilkan: pratinjau `gambar_url` (atau kotak abu bertuliskan "Tanpa gambar"), `judul`, `badge`, label aksi dalam bahasa manusia, dan sakelar aktif.
- Tombol "Tambah banner" per bagian yang membuka `PanelEditBanner` dengan `slot` bagian itu.
- Bila prop `galat` tidak null, tampilkan pita merah bertuliskan pesan itu **dan jangan tampilkan daftar** — daftar kosong karena galat tidak boleh terlihat sama dengan "belum ada banner".
- Di bawah bagian Popup, satu baris keterangan tetap: *"Kalau lebih dari satu popup aktif, yang tampil adalah urutan terkecil."*

`PanelEditBanner.tsx` — client component. Tata letaknya bebas, tetapi **empat titik berikut wajib persis seperti kode di bawah** — ketiganya adalah cacat yang benar-benar terjadi di Tahap 1 dan lolos sampai produksi.

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { simpanBanner } from '../actions'
import { periksaBanner, type InputBanner, type AksiBanner } from '@/lib/appRetail/bannerForm'

// Nama bucket hasil verifikasi Task 4 Langkah 1. JANGAN diketik dari ingatan.
const BUCKET = 'app-banners'

export default function PanelEditBanner(props: {
  awal: InputBanner
  id: string | null
  menuPilihan: { id: string; name: string }[]
  onSelesai: () => void
}) {
  const [form, setForm] = useState<InputBanner>(props.awal)
  const [galat, setGalat] = useState<string | null>(null)
  const [sibuk, setSibuk] = useState(false)

  // (1) Mengganti aksi WAJIB mengosongkan target. Tanpa ini, admin yang
  // sempat memilih menu lalu berpindah ke "buka Menu" akan ditolak
  // `periksaBanner` dengan pesan tentang kolom yang tak lagi terlihat.
  function ubahAksi(aksi: AksiBanner) {
    setForm((s) => ({ ...s, aksi, targetMenuItemId: aksi === 'menu_item' ? s.targetMenuItemId : null }))
  }

  // (2) Kegagalan unggah WAJIB terlihat. Di Tahap 1 blok ini tanpa catch,
  // jadi nama bucket yang salah membuat foto hilang tanpa satu pun pesan.
  async function unggah(file: File) {
    setGalat(null)
    try {
      const supabase = createClient()
      const nama = `${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`
      const { error } = await supabase.storage.from(BUCKET).upload(nama, file)
      if (error) throw error
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(nama)
      setForm((s) => ({ ...s, gambarUrl: data.publicUrl }))
    } catch (e) {
      setGalat(`Gambar gagal diunggah: ${e instanceof Error ? e.message : 'sebab tidak diketahui'}`)
    }
  }

  // (3) Validasi lokal dulu, lalu (4) galat server ditampilkan apa adanya --
  // pesan penolakan RLS dari `pastikanTerubah` harus sampai ke mata admin,
  // bukan ditelan dan diganti "Tersimpan".
  async function simpan() {
    const pesan = periksaBanner(form)
    if (pesan) { setGalat(pesan); return }
    setSibuk(true)
    try {
      await simpanBanner(props.id, form)
      props.onSelesai()
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal menyimpan banner.')
    } finally {
      setSibuk(false)
    }
  }

  return null // ganti dengan formulir; lihat daftar kolom di bawah
}
```

Kolom yang wajib ada di formulir: **judul** (wajib), badge, subjudul, teks tombol, **urutan** (number), **aksi** (`<select>` tiga opsi, memanggil `ubahAksi`), **menu tujuan** (`<select>` dari `menuPilihan`, dirender **hanya saat** `form.aksi === 'menu_item'`), **unggah gambar** (memanggil `unggah`), dan pita galat yang menampilkan `galat` bila tidak null.

- [ ] **Langkah 5: Jalankan tes nav, pastikan lulus**

Run: `cd apps/admin-dashboard && yarn test navConfig`
Expected: PASS.

- [ ] **Langkah 6: Build**

Run: `cd apps/admin-dashboard && yarn build`
Expected: sukses, route `ƒ /dashboard/app-retail/banner` muncul di keluaran.

- [ ] **Langkah 7: Commit**

```bash
git add apps/admin-dashboard/src/app/dashboard/app-retail/banner \
        apps/admin-dashboard/src/components/layout/navConfig.ts \
        apps/admin-dashboard/src/components/layout/navConfig.test.ts
git commit -m "feat(admin): halaman Banner Aplikasi di App Retail"
```

---

### Task 6: Android — DTO, klien, repositori, fungsi murni

**Files:**
- Create: `mobile/customer-app/app/src/main/java/com/sukashawarma/customer/ui/home/TujuanBanner.kt`
- Test: `mobile/customer-app/app/src/test/java/com/sukashawarma/customer/ui/home/TujuanBannerTest.kt`
- Create: `mobile/customer-app/app/src/main/java/com/sukashawarma/customer/data/BannerDilihatStore.kt`
- Modify: `mobile/customer-app/app/src/main/java/com/sukashawarma/customer/data/api/Dto.kt`
- Modify: `mobile/customer-app/app/src/main/java/com/sukashawarma/customer/data/api/GatewayClient.kt`
- Modify: `mobile/customer-app/app/src/main/java/com/sukashawarma/customer/data/Repository.kt`

**Interfaces:**
- Consumes: bentuk JSON dari Task 3
- Produces:
  - `data class BannerDto(id, badge, judul, subjudul, teksTombol, gambarUrl, aksi, targetMenuItemId)`
  - `data class BannersResponse(carousel: List<BannerDto>, popup: BannerDto?)`
  - `sealed class TujuanBanner { object TidakAda; object Menu; data class Item(val menuItemId: String) }`
  - `fun tujuanBanner(aksi: String, targetMenuItemId: String?): TujuanBanner`
  - `fun popupBolehTampil(popupId: String?, sudahDilihat: Set<String>): Boolean`
  - `Repository.banners(): GatewayResult<BannersResponse>`
  - `class BannerDilihatStore(context) { fun sudahDilihat(): Set<String>; fun tandai(id: String) }`

- [ ] **Langkah 1: Tulis tes yang gagal**

```kotlin
package com.sukashawarma.customer.ui.home

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TujuanBannerTest {

    @Test
    fun `aksi tidak dikenal jatuh ke TidakAda`() {
        assertEquals(TujuanBanner.TidakAda, tujuanBanner("buka_url", null))
    }

    @Test
    fun `aksi menu memberi tujuan Menu`() {
        assertEquals(TujuanBanner.Menu, tujuanBanner("menu", null))
    }

    @Test
    fun `aksi menu_item tanpa target jatuh ke TidakAda`() {
        assertEquals(TujuanBanner.TidakAda, tujuanBanner("menu_item", null))
    }

    @Test
    fun `aksi menu_item dengan target membawa id`() {
        assertEquals(TujuanBanner.Item("m1"), tujuanBanner("menu_item", "m1"))
    }

    @Test
    fun `popup tanpa id tidak tampil`() {
        assertFalse(popupBolehTampil(null, emptySet()))
    }

    @Test
    fun `popup baru tampil`() {
        assertTrue(popupBolehTampil("b1", emptySet()))
    }

    @Test
    fun `popup yang sudah dilihat tidak tampil lagi`() {
        assertFalse(popupBolehTampil("b1", setOf("b1")))
    }

    @Test
    fun `popup berbeda tetap tampil walau ada yang sudah dilihat`() {
        assertTrue(popupBolehTampil("b2", setOf("b1")))
    }
}
```

- [ ] **Langkah 2: Jalankan tes, pastikan gagal**

Run: `cd mobile/customer-app && ./gradlew testDebugUnitTest --tests "*TujuanBannerTest*"`
Expected: FAIL — kompilasi gagal, `tujuanBanner` tidak dikenal.

Catatan lingkungan (mesin dev ini): `JAVA_HOME=C:\Program Files\Android\Android Studio1\jbr` dan `TEMP=C:\t` wajib diset, kalau tidak gradle gagal.

- [ ] **Langkah 3: Tulis implementasi minimal**

```kotlin
package com.sukashawarma.customer.ui.home

/**
 * Ke mana ketukan banner membawa pelanggan.
 *
 * Daftar tertutup dengan sengaja: banner TIDAK boleh membuka URL bebas.
 * Siapa pun yang bisa menulis baris banner akan bisa mengarahkan pelanggan
 * ke alamat mana saja, dan itu tidak sebanding dengan manfaatnya.
 */
sealed class TujuanBanner {
    object TidakAda : TujuanBanner()
    object Menu : TujuanBanner()
    data class Item(val menuItemId: String) : TujuanBanner()
}

/**
 * Aksi yang tak dikenal jatuh ke [TujuanBanner.TidakAda], bukan melempar.
 * Aplikasi yang sudah terpasang harus tetap hidup kalau gateway suatu saat
 * mengirim aksi yang lebih baru daripada APK ini.
 */
fun tujuanBanner(aksi: String, targetMenuItemId: String?): TujuanBanner = when (aksi) {
    "menu" -> TujuanBanner.Menu
    "menu_item" -> targetMenuItemId?.takeIf { it.isNotBlank() }
        ?.let { TujuanBanner.Item(it) }
        ?: TujuanBanner.TidakAda
    else -> TujuanBanner.TidakAda
}

/** Popup tampil sekali per banner per pelanggan (keputusan owner K3). */
fun popupBolehTampil(popupId: String?, sudahDilihat: Set<String>): Boolean {
    if (popupId.isNullOrBlank()) return false
    return popupId !in sudahDilihat
}
```

- [ ] **Langkah 4: Jalankan tes, pastikan lulus**

Run: `cd mobile/customer-app && ./gradlew testDebugUnitTest --tests "*TujuanBannerTest*"`
Expected: PASS, 8 tes.

- [ ] **Langkah 5: Tambahkan DTO**

Sisipkan di `Dto.kt`, setelah `CatalogResponse`:

```kotlin
@Serializable
data class BannerDto(
    val id: String,
    val badge: String? = null,
    val judul: String,
    val subjudul: String? = null,
    @SerialName("teks_tombol") val teksTombol: String? = null,
    @SerialName("gambar_url") val gambarUrl: String? = null,
    val aksi: String = "tidak_ada",
    @SerialName("target_menu_item_id") val targetMenuItemId: String? = null
)

@Serializable
data class BannersResponse(
    val carousel: List<BannerDto> = emptyList(),
    val popup: BannerDto? = null
)
```

- [ ] **Langkah 6: Tambahkan panggilan klien & repositori**

Di `GatewayClient.kt`, setelah `catalog(...)` (sekitar baris 111) — endpoint ini **tanpa** header Authorization, sama seperti `outlets` dan `catalog`:

```kotlin
    suspend fun banners(): GatewayResult<BannersResponse> {
        return try {
            val response = client.get("$baseUrl/api/v1/banners")
            hasil(response)
        } catch (e: Exception) {
            GatewayResult.Gagal(GatewayError.Jaringan(e))
        }
    }
```

Perbarui juga komentar KDoc kelas (baris 40–41) agar `banners` ikut disebut sebagai endpoint tanpa token.

Di `Repository.kt`, mengikuti pola `outlets()`:

```kotlin
    suspend fun banners(): GatewayResult<BannersResponse> = client.banners()
```

- [ ] **Langkah 7: Tulis `BannerDilihatStore`**

```kotlin
package com.sukashawarma.customer.data

import android.content.Context

/**
 * Id banner popup yang sudah pernah dilihat pelanggan di HP ini.
 *
 * SharedPreferences biasa, BUKAN terenkripsi seperti [SessionStore]: ini
 * preferensi tampilan, bukan identitas. Menyimpannya bersama token justru
 * mencampur data biasa ke dalam berkas yang seharusnya hanya berisi rahasia.
 *
 * Disimpan per-HP dengan sengaja. Pelanggan yang ganti HP atau menghapus
 * data akan melihat popup lagi; itu wajar dan tidak perlu ditutup dengan
 * menyimpannya di server.
 */
class BannerDilihatStore(context: Context) {

    private val prefs = context.getSharedPreferences(FILE_NAME, Context.MODE_PRIVATE)

    fun sudahDilihat(): Set<String> = prefs.getStringSet(KEY_DILIHAT, emptySet()) ?: emptySet()

    fun tandai(id: String) {
        // Salin dulu: getStringSet mengembalikan instance yang TIDAK boleh
        // diubah di tempat -- mengubahnya membuat perilaku simpan tak
        // terdefinisi menurut dokumentasi Android.
        val baru = sudahDilihat().toMutableSet().apply { add(id) }
        prefs.edit().putStringSet(KEY_DILIHAT, baru).apply()
    }

    private companion object {
        const val FILE_NAME = "banner_dilihat"
        const val KEY_DILIHAT = "popup_dilihat"
    }
}
```

- [ ] **Langkah 8: Kompilasi**

Run: `cd mobile/customer-app && ./gradlew assembleDebug`
Expected: BUILD SUCCESSFUL.

- [ ] **Langkah 9: Commit**

```bash
git add mobile/customer-app/app/src/main/java/com/sukashawarma/customer/ui/home/TujuanBanner.kt \
        mobile/customer-app/app/src/test/java/com/sukashawarma/customer/ui/home/TujuanBannerTest.kt \
        mobile/customer-app/app/src/main/java/com/sukashawarma/customer/data/BannerDilihatStore.kt \
        mobile/customer-app/app/src/main/java/com/sukashawarma/customer/data/api/Dto.kt \
        mobile/customer-app/app/src/main/java/com/sukashawarma/customer/data/api/GatewayClient.kt \
        mobile/customer-app/app/src/main/java/com/sukashawarma/customer/data/Repository.kt
git commit -m "feat(customer-app): DTO, klien, dan logika tujuan banner"
```

---

### Task 7: Android — sambungkan Beranda, cabut hardcode & voucher

**Files:**
- Modify: `mobile/customer-app/.../ui/menu/CatalogViewModel.kt`
- Modify: `mobile/customer-app/.../ui/home/HomeScreen.kt`
- Modify: `mobile/customer-app/.../ui/components/PromoPopupDialog.kt`
- Modify: `mobile/customer-app/.../AppContainer.kt`

**Interfaces:**
- Consumes: semua yang dihasilkan Task 6
- Produces: Beranda yang menampilkan banner dari gateway; nol teks promo hardcoded

- [ ] **Langkah 1: Tambahkan banner ke state ViewModel**

Di `CatalogViewModel.kt`, tambahkan ke `data class CatalogState`:

```kotlin
    val bannerCarousel: List<BannerDto> = emptyList(),
    val bannerPopup: BannerDto? = null,
```

Tambahkan import `com.sukashawarma.customer.data.api.BannerDto`.

Di dalam `muat()`, setelah blok `is GatewayResult.Sukses` mulai (sebelum pemeriksaan `outlets.isEmpty()`), sisipkan pemuatan banner:

```kotlin
                    // Banner tidak boleh menjatuhkan Beranda: gagal memuatnya
                    // berarti tidak ada banner, bukan layar galat. Katalog
                    // adalah isi utama halaman ini.
                    val banner = repository.banners()
                    if (banner is GatewayResult.Sukses) {
                        _state.value = _state.value.copy(
                            bannerCarousel = banner.data.carousel,
                            bannerPopup = banner.data.popup
                        )
                    }
```

- [ ] **Langkah 2: Cabut daftar hardcoded dari HomeScreen**

Hapus seluruhnya:
- `private data class PromoSlideItem(...)` (sekitar baris 310–316)
- `private val promoSlideItems = listOf(...)` (sekitar baris 318–341)

Ubah `PromoMediaCarousel` agar menerima `slides: List<BannerDto>` dan `onKetuk: (BannerDto) -> Unit`, memakai `slides.size` untuk `rememberPagerState` dan `slides[page]` untuk isinya.

Di daftar `LazyColumn`, bungkus kedua permukaan agar **tidak dirender saat kosong**:

```kotlin
        if (state.bannerCarousel.isNotEmpty()) {
            item(key = "home-promo-carousel") {
                PromoMediaCarousel(
                    slides = state.bannerCarousel,
                    onKetuk = { banner -> bukaTujuan(tujuanBanner(banner.aksi, banner.targetMenuItemId)) }
                )
            }
        }
```

di mana `bukaTujuan` didefinisikan di badan `HomeScreen`:

```kotlin
    fun bukaTujuan(tujuan: TujuanBanner) {
        when (tujuan) {
            is TujuanBanner.TidakAda -> Unit
            is TujuanBanner.Menu -> onBukaMenu()
            is TujuanBanner.Item -> state.semuaItem
                .firstOrNull { it.id == tujuan.menuItemId }
                ?.let(onPilihItem)
                ?: onBukaMenu()
        }
    }
```

Catatan: menu tujuan yang tidak ada di katalog outlet ini jatuh ke `onBukaMenu()`, bukan diam saja — ketukan yang tidak melakukan apa pun terbaca sebagai aplikasi rusak.

`SecondaryMediaBanner` **tetap seperti sekarang**, tapi `onCekInfo`-nya diganti dari `onBukaPromoPopup` menjadi `onBukaMenu` — popup kini milik data, bukan tombol.

Setelah itu parameter `onBukaPromoPopup` (baris 173) **tidak dipakai siapa pun lagi** — hapus parameternya beserta argumen di tempat pemanggilan (baris 154). Parameter nganggur di composable yang panjang adalah jejak yang menyesatkan pembaca berikutnya.

- [ ] **Langkah 3: Ganti pemicu popup**

Ganti `var tampilkanPromoPopup by rememberSaveable { mutableStateOf(true) }` (baris 89) dan blok `if` di baris 92–99 dengan:

```kotlin
    val konteks = LocalContext.current
    val dilihatStore = remember { BannerDilihatStore(konteks) }
    var sudahDilihat by remember { mutableStateOf(dilihatStore.sudahDilihat()) }

    val popup = state.bannerPopup
    if (popupBolehTampil(popup?.id, sudahDilihat) && popup != null &&
        state.outlet != null && !state.memuat && state.galat == null
    ) {
        PromoPopupDialog(
            imageUrl = popup.gambarUrl,
            badgeText = popup.badge,
            judul = popup.judul,
            subjudul = popup.subjudul,
            teksTombol = popup.teksTombol,
            onDismiss = {
                dilihatStore.tandai(popup.id)
                sudahDilihat = dilihatStore.sudahDilihat()
            },
            onKlaimPromo = {
                dilihatStore.tandai(popup.id)
                sudahDilihat = dilihatStore.sudahDilihat()
                bukaTujuan(tujuanBanner(popup.aksi, popup.targetMenuItemId))
            }
        )
    }
```

Tambahkan import: `androidx.compose.ui.platform.LocalContext`, `androidx.compose.runtime.remember`, `com.sukashawarma.customer.data.BannerDilihatStore`.

- [ ] **Langkah 4: Cabut voucher & default dari PromoPopupDialog**

Ganti tanda tangan (baris 55–65) menjadi — **tanpa satu pun nilai default**:

```kotlin
@Composable
fun PromoPopupDialog(
    onDismiss: () -> Unit,
    onKlaimPromo: () -> Unit,
    judul: String,
    imageUrl: String?,
    badgeText: String?,
    subjudul: String?,
    teksTombol: String?,
    modifier: Modifier = Modifier
) {
```

Hapus konstanta `DEFAULT_PROMO_IMAGE_URL` (baris 47).

**Hapus seluruh blok voucher** yang memuat `kodeVoucher` (baris 228) dan `infoDiskon` (baris 245), termasuk kotak/pembungkusnya — bukan hanya teksnya. Selama belum ada voucher, popup tidak boleh punya tempat untuk memajang satu pun.

Render `badgeText`, `subjudul`, dan `teksTombol` hanya bila tidak null/kosong. Untuk `imageUrl` null, isi kotak gambar dengan `SukaTint` (warna tema) — **jangan** memakai URL cadangan dari luar.

- [ ] **Langkah 5: Sediakan store di AppContainer bila perlu**

Kalau `AppContainer.kt` merakit store lain untuk layar, tambahkan `BannerDilihatStore` mengikuti pola `OutletStore` di sana. Kalau `HomeScreen` membuatnya sendiri lewat `LocalContext` (Langkah 3), lewati langkah ini dan catat alasannya.

- [ ] **Langkah 6: Jalankan seluruh tes unit**

Run: `cd mobile/customer-app && ./gradlew testDebugUnitTest`
Expected: seluruh tes lulus, termasuk 14 tes yang sudah ada sebelumnya. Catat jumlah sebelum & sesudah.

- [ ] **Langkah 7: Pastikan nol jejak SUKABARU**

Run: `grep -rn "SUKABARU\|googleusercontent" mobile/customer-app/app/src/main/java/com/sukashawarma/customer/ui/home/HomeScreen.kt mobile/customer-app/app/src/main/java/com/sukashawarma/customer/ui/components/PromoPopupDialog.kt`
Expected: **nol hasil.**

(Kemunculan `googleusercontent` di `HomeScreen.kt:539` — gambar cadangan menu — **sengaja dibiarkan** atas keputusan owner. Kalau grep di atas masih menemukannya di baris itu saja, itu benar; yang wajib nol adalah di kedua permukaan promo.)

- [ ] **Langkah 8: Build APK**

Run: `cd mobile/customer-app && ./gradlew assembleDebug`
Expected: BUILD SUCCESSFUL.

- [ ] **Langkah 9: Periksa isolasi POS**

Run: `git diff --name-only origin/main...HEAD | grep -E "^(apps/pos-kasir|pos-admin|mobile/native-pos|mobile/native-superapp)/"`
Expected: **nol baris.**

- [ ] **Langkah 10: Commit**

```bash
git add mobile/customer-app/app/src/main/java/com/sukashawarma/customer/ui/menu/CatalogViewModel.kt \
        mobile/customer-app/app/src/main/java/com/sukashawarma/customer/ui/home/HomeScreen.kt \
        mobile/customer-app/app/src/main/java/com/sukashawarma/customer/ui/components/PromoPopupDialog.kt
git commit -m "feat(customer-app): banner dari gateway, cabut promo hardcoded & voucher SUKABARU"
```

---

## Uji manual setelah semua task (butuh migration sudah di-apply + redeploy)

1. Unggah satu banner carousel di dashboard → muncul di aplikasi.
2. Nonaktifkan → hilang.
3. Tanpa banner aktif → Beranda langsung ke daftar menu, tanpa ruang kosong.
4. Popup muncul sekali; tutup, pindah layar, kembali ke Beranda → tidak muncul lagi.
5. Ketuk banner ber-`aksi='menu_item'` → mendarat di menu yang benar.
6. Masuk sebagai OWNER, coba simpan → **diharapkan** muncul "Banner tidak tersimpan — akun ini belum berhak…" (RLS menuntut role `admin` persis).

## Urutan live

| Lapis | Kapan berlaku |
|---|---|
| Migration | setelah owner meng-apply |
| Gateway | setelah redeploy Coolify |
| Dashboard admin | setelah redeploy Coolify |
| Android | setelah APK dibangun ulang & dipasang di HP penguji |

Selama APK lama terpasang, ia tetap menampilkan tiga slide hardcoded termasuk SUKABARU.
