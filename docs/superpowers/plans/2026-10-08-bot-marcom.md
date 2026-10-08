# Bot Marcom Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Membangun Bot Marcom yang terdiri dari paket alat MCP Hermes (domain `marcom` berbasis Prisma) dan Widget Chat Melayang di dalam Dashboard Marcom (`apps/marcom`) untuk memantau Endorsement, Content Planner, Ads & Budget, serta Promo.

**Architecture:** 
- **MCP Server Marcom**: Diletakkan di `apps/marcom/src/app/api/hermes/mcp/route.ts` dengan otentikasi Bearer Token. Server ini mengekspos 4 alat read-only yang memanggil logika murni di `src/lib/hermes/marcom/` dan loader data Prisma di `src/lib/hermes/server/marcomSumber.ts`.
- **Widget Chat**: Komponen melayang di `src/components/botMarcom/` yang dipasang di `src/app/dashboard/layout.tsx`, memanggil server action `src/app/actions/botMarcom.ts` yang meneruskan pesan ke Hermes API server VPS (`/p/marcom/v1/chat/completions`).

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Prisma (PostgreSQL `marcom_db`), TailwindCSS, Vitest.

---

## File Structure

| Berkas | Tanggung Jawab |
|---|---|
| `docs/superpowers/specs/2026-10-08-bot-marcom-design.md` | Dokumen spesifikasi desain Bot Marcom |
| `apps/marcom/src/lib/hermes/marcom/tipe.ts` (baru) | Interface kontrak data, input/output alat, dan `KonteksMarcom` |
| `apps/marcom/src/lib/hermes/marcom/fixture.ts` (baru) | Data mock untuk pengujian hermetis TDD |
| `apps/marcom/src/lib/hermes/marcom/endorsement.ts` (baru) | Logika murni ringkasan & daftar endorsement/KOL |
| `apps/marcom/src/lib/hermes/marcom/endorsement.test.ts` (baru) | Unit test alat endorsement |
| `apps/marcom/src/lib/hermes/marcom/konten.ts` (baru) | Logika murni jadwal & performa konten |
| `apps/marcom/src/lib/hermes/marcom/konten.test.ts` (baru) | Unit test alat konten |
| `apps/marcom/src/lib/hermes/marcom/adsBudget.ts` (baru) | Logika murni realisasi budget & status ads |
| `apps/marcom/src/lib/hermes/marcom/adsBudget.test.ts` (baru) | Unit test alat ads & budget |
| `apps/marcom/src/lib/hermes/marcom/promo.ts` (baru) | Logika murni promo aktif & akan datang |
| `apps/marcom/src/lib/hermes/marcom/promo.test.ts` (baru) | Unit test alat promo |
| `apps/marcom/src/lib/hermes/server/marcomSumber.ts` (baru) | Data loader membaca database via Prisma |
| `apps/marcom/src/app/api/hermes/mcp/route.ts` (baru) | Route handler server MCP Hermes |
| `apps/marcom/src/app/api/hermes/mcp/route.test.ts` (baru) | Integration test endpoint MCP (auth, tools list, tools call) |
| `apps/marcom/src/lib/hermes/klien.ts` (baru) | Klien pemanggil API Server Hermes VPS |
| `apps/marcom/src/app/actions/botMarcom.ts` (baru) | Server action perpesanan chat bot |
| `apps/marcom/src/components/botMarcom/BotMarcomWidget.tsx` (baru) | Tombol launcher melayang dengan badge status |
| `apps/marcom/src/components/botMarcom/PanelBotMarcom.tsx` (baru) | Jendela obrolan interaktif + quick chips pertanyaan |
| `apps/marcom/src/components/botMarcom/IsiPesan.tsx` (baru) | Renderer pesan teks, kartu suka-ui, dan tabel suka-ui |
| `apps/marcom/src/app/dashboard/layout.tsx` (ubah) | Pemasangan widget di layout dashboard |
| `supabase/verifikasi/hermes/gerbang-marcom.md` (baru) | Lembar uji gerbang verifikasi angka dengan layar Marcom |

---

### Task 1: Tipe Kontrak & Fixture Data Marcom

**Files:**
- Create: `apps/marcom/src/lib/hermes/marcom/tipe.ts`
- Create: `apps/marcom/src/lib/hermes/marcom/fixture.ts`

**Step 1: Buat interface tipe `tipe.ts`**
- Tipe `EndorsementData`: id, kol_nama, outlet_nama, schedule_date, visit_status, draft_status, post_status, payment_status, rate_card, tipe, post_url, views, likes.
- Tipe `KontenData`: id, judul, platform, pilar, format, status, tanggal_posting, jam_posting, creator, outlet_nama, views, likes, reach.
- Tipe `BudgetData`: outlet_nama, period_month, period_year, target_budget, target_kol_count, spent, kol_count.
- Tipe `AdData`: id, platform, outlet_nama, budget, spent, status.
- Tipe `PromoData`: id, judul, deskripsi, outlet_nama, tanggal_mulai, tanggal_selesai, tipe.
- Tipe `KonteksMarcom`:
  - `sekarang: Date`
  - `hariIni: string`
  - `daftarEndorsement(): Promise<EndorsementData[]>`
  - `daftarKonten(dari: string, sampai: string): Promise<KontenData[]>`
  - `daftarBudget(bulan: number, tahun: number): Promise<BudgetData[]>`
  - `daftarAds(): Promise<AdData[]>`
  - `daftarPromo(tanggal: string): Promise<PromoData[]>`

**Step 2: Buat fixture data realistis di `fixture.ts`**
- Menyediakan mock `marcomPalsu: KonteksMarcom` yang mengembalikan data tiruan lengkap untuk keperluan unit test.

**Step 3: Commit**
```bash
git branch --show-current
git add apps/marcom/src/lib/hermes/marcom/tipe.ts apps/marcom/src/lib/hermes/marcom/fixture.ts
git commit -m "feat(marcom-bot): tipe kontrak dan fixture data hermes marcom"
```

---

### Task 2: Logika Murni `marcom_endorsement` + Unit Test

**Files:**
- Create: `apps/marcom/src/lib/hermes/marcom/endorsement.ts`
- Create: `apps/marcom/src/lib/hermes/marcom/endorsement.test.ts`

**Step 1: Tulis unit test di `endorsement.test.ts`**
- Test hitung ringkasan: `total`, `visit_pending`, `draft_pending`, `belum_posting`, `belum_bayar`.
- Test filter status: `PENDING_DRAFT`, `PENDING_VISIT`, `UNPAID`.
- Test filter outlet dan filter nama KOL.
- Memastikan tidak ada nomor rekening KOL atau data pribadi sensitif yang bocor.

**Step 2: Jalankan test dan pastikan gagal**
Run: `node "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/node_modules/vitest/vitest.mjs" run apps/marcom/src/lib/hermes/marcom/endorsement.test.ts`
Expected: FAIL.

**Step 3: Implementasikan fungsi `hitungEndorsement` di `endorsement.ts`**

**Step 4: Jalankan test dan pastikan lulus**
Expected: PASS.

**Step 5: Commit**
```bash
git branch --show-current
git add apps/marcom/src/lib/hermes/marcom/endorsement.ts apps/marcom/src/lib/hermes/marcom/endorsement.test.ts
git commit -m "feat(marcom-bot): logika murni endorsement dan unit test"
```

---

### Task 3: Logika Murni `marcom_konten_jadwal` + Unit Test

**Files:**
- Create: `apps/marcom/src/lib/hermes/marcom/konten.ts`
- Create: `apps/marcom/src/lib/hermes/marcom/konten.test.ts`

**Step 1: Tulis unit test di `konten.test.ts`**
- Test resolusi periode: `hari_ini`, `kemarin`, `minggu_ini`, `minggu_depan`, `bulan_ini`.
- Test kalkulasi ringkasan: `total`, `sudah_posting`, `belum_posting`.
- Test filter platform (TIKTOK, IG_REEL, dll) dan outlet.

**Step 2: Jalankan test dan pastikan gagal**
Run: `node "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/node_modules/vitest/vitest.mjs" run apps/marcom/src/lib/hermes/marcom/konten.test.ts`
Expected: FAIL.

**Step 3: Implementasikan `hitungJadwalKonten` di `konten.ts`**

**Step 4: Jalankan test dan pastikan lulus**
Expected: PASS.

**Step 5: Commit**
```bash
git branch --show-current
git add apps/marcom/src/lib/hermes/marcom/konten.ts apps/marcom/src/lib/hermes/marcom/konten.test.ts
git commit -m "feat(marcom-bot): logika murni jadwal konten dan unit test"
```

---

### Task 4: Logika Murni `marcom_ads_budget` + Unit Test

**Files:**
- Create: `apps/marcom/src/lib/hermes/marcom/adsBudget.ts`
- Create: `apps/marcom/src/lib/hermes/marcom/adsBudget.test.ts`

**Step 1: Tulis unit test di `adsBudget.test.ts`**
- Test perhitungan total target budget vs spent, sisa budget, persentase terpakai.
- Test pengelompokan per outlet: target budget, spent, target KOL, KOL tercapai.
- Test daftar iklan aktif (status `ON`).

**Step 2: Jalankan test dan pastikan gagal**
Run: `node "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/node_modules/vitest/vitest.mjs" run apps/marcom/src/lib/hermes/marcom/adsBudget.test.ts`
Expected: FAIL.

**Step 3: Implementasikan `hitungAdsBudget` di `adsBudget.ts`**

**Step 4: Jalankan test dan pastikan lulus**
Expected: PASS.

**Step 5: Commit**
```bash
git branch --show-current
git add apps/marcom/src/lib/hermes/marcom/adsBudget.ts apps/marcom/src/lib/hermes/marcom/adsBudget.test.ts
git commit -m "feat(marcom-bot): logika murni ads dan budget marcom + test"
```

---

### Task 5: Logika Murni `marcom_promo_aktif` + Unit Test

**Files:**
- Create: `apps/marcom/src/lib/hermes/marcom/promo.ts`
- Create: `apps/marcom/src/lib/hermes/marcom/promo.test.ts`

**Step 1: Tulis unit test di `promo.test.ts`**
- Test pemisahan antara promo yang sedang aktif hari ini (`startDate <= tgl && endDate >= tgl`) vs promo yang akan datang (`startDate > tgl`).
- Test filter outlet.

**Step 2: Jalankan test dan pastikan gagal**
Run: `node "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/node_modules/vitest/vitest.mjs" run apps/marcom/src/lib/hermes/marcom/promo.test.ts`
Expected: FAIL.

**Step 3: Implementasikan `hitungPromoAktif` di `promo.ts`**

**Step 4: Jalankan test dan pastikan lulus**
Expected: PASS.

**Step 5: Commit**
```bash
git branch --show-current
git add apps/marcom/src/lib/hermes/marcom/promo.ts apps/marcom/src/lib/hermes/marcom/promo.test.ts
git commit -m "feat(marcom-bot): logika murni promo aktif + test"
```

---

### Task 6: Server Data Loader Prisma Marcom (`src/lib/hermes/server/marcomSumber.ts`)

**Files:**
- Create: `apps/marcom/src/lib/hermes/server/marcomSumber.ts`

**Step 1: Implementasikan `buatKonteksMarcom(prisma, sekarang)`**
- Membaca data langsung dari tabel Prisma:
  - `prisma.endorsement.findMany({ include: { kol: true, outlet: true, posts: true } })`
  - `prisma.internalContent.findMany({ include: { outlet: true } })`
  - `prisma.outletBudget.findMany({ include: { outlet: true } })`
  - `prisma.ad.findMany({ include: { outlet: true } })`
  - `prisma.promoEvent.findMany({ include: { outlet: true } })`
- Mapping data ke tipe kontrak `tipe.ts` dengan penanganan nilai null dan zona waktu WIB.

**Step 2: Commit**
```bash
git branch --show-current
git add apps/marcom/src/lib/hermes/server/marcomSumber.ts
git commit -m "feat(marcom-bot): server data loader dari Prisma marcom_db"
```

---

### Task 7: Route Handler MCP Server `/api/hermes/mcp` di `apps/marcom`

**Files:**
- Create: `apps/marcom/src/app/api/hermes/mcp/route.ts`
- Create: `apps/marcom/src/app/api/hermes/mcp/route.test.ts`

**Step 1: Tulis integration test untuk route MCP**
- Verifikasi penolakan tanpa Authorization header atau kunci tidak valid (HTTP 401).
- Verifikasi method `initialize` dan `tools/list` mengembalikan 4 alat domain `marcom`: `marcom_endorsement`, `marcom_konten_jadwal`, `marcom_ads_budget`, `marcom_promo_aktif`.
- Verifikasi method `tools/call` mengeksekusi alat dan mengembalikan hasil beserta `meta.sumber` dan `meta.dihitung_pada`.

**Step 2: Jalankan test dan pastikan gagal**
Run: `node "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/node_modules/vitest/vitest.mjs" run apps/marcom/src/app/api/hermes/mcp/route.test.ts`
Expected: FAIL (route belum ada).

**Step 3: Implementasikan route handler di `apps/marcom/src/app/api/hermes/mcp/route.ts`**
- Otentikasi Bearer token menggunakan env `HERMES_MARCOM_API_KEY` (atau fallback key internal terkonfigurasi).
- Menangani protokol JSON-RPC MCP standard.

**Step 4: Jalankan test dan pastikan lulus**
Expected: PASS.

**Step 5: Commit**
```bash
git branch --show-current
git add apps/marcom/src/app/api/hermes/mcp/route.ts apps/marcom/src/app/api/hermes/mcp/route.test.ts
git commit -m "feat(marcom-bot): endpoint MCP Hermes di apps/marcom"
```

---

### Task 8: Server Action Chat & Klien Hermes

**Files:**
- Create: `apps/marcom/src/lib/hermes/klien.ts`
- Create: `apps/marcom/src/app/actions/botMarcom.ts`
- Create: `apps/marcom/src/lib/hermes/klien.test.ts`

**Step 1: Implementasikan `klien.ts`**
- Fungsi `tanyaHermesMarcom(pesan, sesiId)` memanggil endpoint Hermes API server VPS (`HERMES_API_URL/p/marcom/v1/chat/completions`).
- Timeout dan error handling ramah jika server bot sedang dingin/reboot.

**Step 2: Implementasikan server action `kirimPesanBotMarcom(pesan, sesiId)`**
- Validasi autentikasi user melalui Supabase Auth server.
- Sanitasi input pesan.

**Step 3: Test unit dan commit**
```bash
git branch --show-current
git add apps/marcom/src/lib/hermes/klien.ts apps/marcom/src/lib/hermes/klien.test.ts apps/marcom/src/app/actions/botMarcom.ts
git commit -m "feat(marcom-bot): server action dan klien Hermes chat"
```

---

### Task 9: Komponen UI Widget Chat Melayang

**Files:**
- Create: `apps/marcom/src/components/botMarcom/BotMarcomWidget.tsx`
- Create: `apps/marcom/src/components/botMarcom/PanelBotMarcom.tsx`
- Create: `apps/marcom/src/components/botMarcom/IsiPesan.tsx`
- Create: `apps/marcom/src/components/botMarcom/QuickChips.tsx`

**Step 1: Buat renderer pesan `IsiPesan.tsx`**
- Mendukung format teks markdown sederhana.
- Mendukung render kartu ringkasan dan tabel mini.

**Step 2: Buat panel chat `PanelBotMarcom.tsx`**
- Header dengan status bot ("Online", avatar robot Marcom).
- Riwayat percakapan yang disimpan di state / localStorage.
- Quick chips saran pertanyaan.
- Text input dengan tombol kirim dan tombol enter.

**Step 3: Buat widget trigger `BotMarcomWidget.tsx`**
- Tombol lingkaran melayang di pojok kanan bawah (`fixed bottom-6 right-6 z-50`).
- Animasi transisi buka/tutup panel.

**Step 4: Commit**
```bash
git branch --show-current
git add apps/marcom/src/components/botMarcom/
git commit -m "feat(marcom-bot): komponen UI widget chat melayang"
```

---

### Task 10: Integrasi Widget ke Layout Dashboard Marcom

**Files:**
- Modify: `apps/marcom/src/app/dashboard/layout.tsx`

**Step 1: Pasang `BotMarcomWidget` di dalam layout dashboard**
- Hanya dirender jika user sudah login di dashboard.

**Step 2: Commit**
```bash
git branch --show-current
git add apps/marcom/src/app/dashboard/layout.tsx
git commit -m "feat(marcom-bot): integrasikan widget chat ke layout dashboard marcom"
```

---

### Task 11: Lembar Verifikasi & Dokumentasi VPS

**Files:**
- Create: `supabase/verifikasi/hermes/gerbang-marcom.md`
- Modify: `docs/RUNBOOK-HERMES-VPS.md`

**Step 1: Tulis lembar uji `gerbang-marcom.md`**
- Tabel paritas 6 pertanyaan dengan layar Marcom:
  1. Status endorsement & review draft video (`marcom_endorsement` -> `/dashboard/endorsements`)
  2. Jadwal konten TikTok/IG hari ini & minggu ini (`marcom_konten_jadwal` -> `/dashboard/content-planner`)
  3. Realisasi budget iklan outlet bulan ini (`marcom_ads_budget` -> `/dashboard/budget`)
  4. Status iklan aktif (`marcom_ads_budget` -> `/dashboard/ads`)
  5. Promo aktif di outlet (`marcom_promo_aktif` -> `/dashboard/menu/promo`)
  6. Rate card & kontak KOL untuk kolaborasi (`marcom_endorsement` -> `/dashboard/kols`)
- 2 pertanyaan penolakan:
  7. Minta nomor rekening KOL -> HARUS MENOLAK
  8. Minta password/token sistem -> HARUS MENOLAK

**Step 2: Catat petunjuk pendaftaran profil `marcom` di `docs/RUNBOOK-HERMES-VPS.md`**

**Step 3: Commit**
```bash
git branch --show-current
git add supabase/verifikasi/hermes/gerbang-marcom.md docs/RUNBOOK-HERMES-VPS.md
git commit -m "docs(marcom-bot): lembar uji gerbang marcom dan dokumentasi runbook"
```

---

### Task 12: Verifikasi Menyeluruh & Laporan Selesai

**Step 1: Jalankan seluruh test suite unit & integrasi**
Run: `node "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/node_modules/vitest/vitest.mjs" run apps/marcom/src/lib/hermes`
Expected: 100% PASS.

**Step 2: Verifikasi status git**
Run:
```bash
git branch --show-current
git status
git log -n 12 --oneline
```
Expected: Branch `feat/bot-marcom`, status bersih.

**Step 3: Laporan ke user untuk review dan persetujuan merge/deploy.**
