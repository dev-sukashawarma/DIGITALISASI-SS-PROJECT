# Validasi Xendit di Histori Transaksi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tiap pesanan website di Histori Transaksi Detail (Rangkuman Penjualan) berstatus Xendit (✓/⏳/⚠) dengan ID transaksi & ref QRIS, terisi otomatis dari webhook dan dari unggahan file Xendit bulanan.

**Architecture:** Tabel baru `xendit_pembayaran` di DB POS (satu baris per pembayaran Xendit, ditaut lewat `external_order_id`). Diisi dua jalur: edge function FormOrder (`xendit-webhook`, `check-xendit-status`) dan halaman unggah file di admin-dashboard. Status dihitung di server saat laporan diminta (TIDAK masuk cache hari `getPosReport`, tidak mengubah angka apa pun).

**Tech Stack:** Next.js app router (admin-dashboard, finance, HR), Supabase Postgres (DB POS `khpkoreaaucvyqfhynfq`), Deno edge functions (FormOrder_SS `qntuhtkujpwudcpudwbj`, repo `form order online`), vitest.

**Spec:** `docs/superpowers/specs/2026-11-18-validasi-xendit-histori-transaksi-design.md`

## Global Constraints

- Angka omzet, KPI, footer tabel, jumlah transaksi, dan semua ekspor TIDAK boleh berubah karena fitur ini.
- Pesanan website = `sales_source = 'online'` DAN `external_order_id` berformat UUID (`^[0-9a-f]{8}-[0-9a-f]{4}-`). Pesanan online lain (`F-…`, angka panjang, `…-C8J…`) bukan website.
- Nominal dibandingkan: `orders.total_amount` vs `xendit_pembayaran.nominal` (keduanya kotor termasuk biaya 0,6%).
- Bukan penjualan: `Reference` berawalan `PR-`, atau nominal < 1000.
- Jendela cocok nominal+jam: `created_at` pesanan ∈ [bayar − 20 menit, bayar + 30 menit]; satu pesanan ↔ satu pembayaran; kandidat setara → tidak dicocokkan.
- Tiga app identik: setiap file `lib/posReport/*` / komponen histori yang diubah/dibuat di admin-dashboard disalin byte-identik ke `apps/finance` dan `apps/HR` dan didaftarkan di `rangkumanPenjualan.parity.test.ts` keduanya.
- Unggah file: peran `admin`, `owner`, `admin_finance`, `developer`, dicek di server action (`requireRole` dari `@/lib/authz`).
- Gagal menulis ke DB POS dari edge function TIDAK boleh menggagalkan webhook (status lunas di Order Online tetap jalan).
- Migration bertimestamp hari ini (`20261118…`); jangan pakai 2030.
- Kerjakan di branch `feat/validasi-xendit` (monorepo) dan `main` repo `form order online` (repo kecil, satu developer).

## Review Focus

- Unggah file yang sama dua kali → tidak ada baris dobel, hasil pencocokan sama (Task 2, Task 4).
- Dua pesanan website bernominal sama di outlet berbeda dalam 10 menit → tidak salah silang; kandidat setara dibiarkan ⏳ (Task 3).
- Pembayaran webhook datang untuk pesanan yang sudah `paid` (bayar dobel) → tetap tercatat, pesanan berlencana ⚠ Dobel (Task 5, Task 8).
- Filter cabang aktif → baris "Hanya di Xendit" tanpa outlet tidak tampil, diganti catatan jumlah (Task 6).
- CSV Xendit dengan kolom `Payment Date` kosong (baris non-pembayaran) atau format tanggal "28 Oct 2026, 18:26:08" berzona +07 → terbaca benar (Task 2).

---

### Task 0: Petakan ID webhook ↔ kolom CSV (prasyarat Task 8)

**Files:** Modify: spec §5.2 (catat temuan)

- [ ] **Step 1:** Tunggu/cari pembayaran website asli setelah 18 Nov 12:00 WIB. Ambil payload dari log FormOrder: `query_logs` source `function_logs`, `event_message ilike '%Xendit webhook payload%'`.
- [ ] **Step 2:** Unduh Balance History Xendit yang memuat tanggal itu; cari baris `TRANSACTION`/`CREDIT` bernominal & jam sama.
- [ ] **Step 3:** Tulis di spec §5.2: field payload mana = `Transaction ID` CSV, mana = `Reference`, mana = `Channel Reference`. Jika tak ada yang sama, catat endpoint Xendit yang mengembalikan `Transaction ID` dari `pr-…` (uji dengan satu panggilan GET).
- [ ] **Step 4:** Commit spec. Task 8 memakai pemetaan ini; Task 1–7 tidak bergantung padanya.

### Task 1: Tabel `xendit_pembayaran`

**Files:**
- Create: `supabase/migrations/20261118130000_xendit_pembayaran.sql`
- Create: `supabase/verifikasi/xendit_pembayaran/t1_tabel.sql`

**Interfaces — Produces:** tabel `public.xendit_pembayaran`:
`id uuid pk default gen_random_uuid()`, `xendit_id text not null unique` (= CSV `Transaction ID`), `xendit_ref text` (= CSV `Reference`), `ref_qris text` (CSV `Channel Reference`), `nominal numeric not null`, `dibayar_at timestamptz not null`, `channel text`, `external_order_id text`, `cara_cocok text check in ('webhook','file_id','file_nominal_jam','manual')`, `bukan_penjualan boolean not null default false`, `outlet_id uuid references outlets(id)`, `nama_pelanggan text`, `ringkasan_item text`, `sumber text not null check in ('webhook','file')`, `nama_file text`, `diimpor_at timestamptz default now()`, `diimpor_oleh uuid`. Indeks: `(external_order_id)`, `(dibayar_at)`.

- [ ] **Step 1:** Tulis `t1_tabel.sql` (ROLLBACK di akhir): asersi tabel ada, `xendit_id` unik (insert dobel → 23505), `cara_cocok='ngawur'` ditolak, sebagai `authenticated` peran `crew` SELECT → 0 baris, peran `admin_finance` SELECT → terlihat, INSERT sebagai `authenticated` → ditolak.
- [ ] **Step 2:** Jalankan sebelum migration → gagal (tabel belum ada).
- [ ] **Step 3:** Tulis migration. RLS: SELECT untuk peran yang boleh Rangkuman Penjualan (`owner, admin, admin_finance, admin_hr, developer` aktif via `outlet_staff`); `REVOKE INSERT/UPDATE/DELETE` dari `anon, authenticated`; tulis hanya service role.
- [ ] **Step 4:** Apply, stempel `schema_migrations`, jalankan t1 → lulus.
- [ ] **Step 5:** Commit.

### Task 2: Parser Balance History CSV

**Files:**
- Create: `apps/admin-dashboard/src/lib/xendit/balanceHistory.ts`
- Test: `apps/admin-dashboard/src/lib/xendit/balanceHistory.test.ts` (fixture: 6–8 baris disalin dari file Oktober, nama/rekening dikosongkan)

**Interfaces — Produces:**
```ts
export type BarisXendit = {
  xenditId: string; xenditRef: string; refQris: string | null; nominal: number
  dibayarAt: string /* ISO UTC */; channel: string; bukanPenjualan: boolean
}
export function parseBalanceHistory(csv: string): BarisXendit[]
```

- [ ] **Step 1: Test** — `it('hanya ambil TRANSACTION+CREDIT')`: dari fixture berisi QR_CODE_PAYMENT, `QR_CODE_PAYMENT Fee`, VAT, WITHDRAWAL, PROCESSING_FEE → panjang = jumlah baris pembayaran. `it('parse Payment Date WIB')`: `"28 Oct 2026, 18:26:08"` → `'2026-10-28T11:26:08.000Z'`. `it('PR- dan nominal < 1000 = bukanPenjualan')`. `it('VA tanpa Channel Reference → refQris null')`. `it('kolom dengan koma di dalam tanda kutip terbaca')`.
- [ ] **Step 2:** `yarn vitest run src/lib/xendit/balanceHistory.test.ts` (di `apps/admin-dashboard`) → FAIL.
- [ ] **Step 3:** Implement; pakai parser CSV yang sudah dipakai `platformSettlement` bila ada, kalau tidak tulis parser kutip sederhana. Zona dari kolom `Time Zone` (`'+0700 UTC`) — asumsikan +07 bila kosong.
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5:** Commit.

### Task 3: Pencocokan nominal+jam

**Files:**
- Create: `apps/admin-dashboard/src/lib/xendit/cocokkan.ts`
- Test: `apps/admin-dashboard/src/lib/xendit/cocokkan.test.ts`

**Interfaces — Produces:**
```ts
export type KandidatPesanan = { externalOrderId: string; total: number; createdAt: string }
export function cocokkanNominalJam(
  pembayaran: { xenditId: string; nominal: number; dibayarAt: string }[],
  pesanan: KandidatPesanan[],
  sudahTertaut: Set<string> /* external_order_id yang sudah punya pembayaran */,
): Map<string /* xenditId */, string /* externalOrderId */>
```

- [ ] **Step 1: Test** — pakai kasus Oktober: bayar 14:33:41 Rp54.324 & pesanan 14:33:12 → cocok; bayar 21:34:15 Rp32.192 vs pesanan 21:33:35 → cocok; pesanan di luar jendela (−25 menit) → tidak; dua pembayaran bernominal sama berdekatan + dua pesanan → masing-masing ke terdekat, satu-ke-satu; satu pembayaran + dua pesanan setara (selisih waktu sama) → tidak dicocokkan; pesanan di `sudahTertaut` → dilewati.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement: urutkan pasangan (pembayaran, pesanan) yang lolos jendela & nominal per |selisih waktu| naik; ambil serakah satu-ke-satu; buang pasangan bila pembayaran yang sama punya kandidat lain dengan selisih identik.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit.

### Task 4: Unggah file Xendit (server action + halaman)

**Files:**
- Create: `apps/admin-dashboard/src/app/actions/xenditPembayaran.ts` (`'use server'`)
- Create: `apps/admin-dashboard/src/app/dashboard/xendit-pembayaran/page.tsx`
- Modify: `apps/admin-dashboard/src/components/layout/navConfig.ts` (entri di sebelah "Settlement Food Apps", ADMIN & OWNER)
- Test: `apps/admin-dashboard/src/app/actions/xenditPembayaran.test.ts`

**Interfaces — Consumes:** `parseBalanceHistory` (Task 2), `cocokkanNominalJam` (Task 3), `requireRole`.
**Produces:**
```ts
export async function unggahFileXendit(formData: FormData): Promise<
  { success: true; ringkasan: { baru: number; diperbarui: number; cocokId: number; cocokNominalJam: number; belumCocok: number; bukanPenjualan: number } }
  | { success: false; error: string }>
```

- [ ] **Step 1: Test** (mock supabase seperti tes action lain di repo): peran `crew` → `{success:false}`; file yang sama dua kali → panggilan upsert memakai `onConflict: 'xendit_id'`; baris yang sudah `cara_cocok='webhook'` tidak ditimpa `external_order_id`/`cara_cocok`-nya; ringkasan menghitung benar dari fixture.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement: parse → upsert (`sumber='file'`, `nama_file`, `diimpor_oleh`) tanpa menimpa kolom tautan yang sudah terisi → ambil pembayaran tanpa `external_order_id` → ambil pesanan website rentang [min bayar − 1 jam, max bayar + 1 jam] (`sales_source='online'`, external_order_id UUID, status apa pun) → `cocokkanNominalJam` → update `external_order_id`, `cara_cocok='file_nominal_jam'`, `outlet_id` dari pesanan.
- [ ] **Step 4:** Halaman: pilih file, tombol Unggah, tampilkan ringkasan + keterangan "Balance History disusun per tanggal settlement; pembayaran 29–31 ada di file bulan berikutnya".
- [ ] **Step 5:** Run tes + `yarn type-check` admin-dashboard → lulus.
- [ ] **Step 6:** Commit.

### Task 5: Status Xendit per pesanan (pure)

**Files:**
- Create: `apps/admin-dashboard/src/lib/posReport/xenditStatus.ts`
- Test: `apps/admin-dashboard/src/lib/posReport/xenditStatus.test.ts`

**Interfaces — Produces:**
```ts
export type StatusXendit = 'terverifikasi' | 'belum' | 'selisih' | 'dobel'
export type XenditFilter = 'all' | 'terverifikasi' | 'belum' | 'selisih' | 'hanya_xendit'
export type PembayaranRingkas = { xenditId: string; refQris: string | null; nominal: number; dibayarAt: string; caraCocok: string | null; externalOrderId: string | null; outletId: string | null; namaPelanggan: string | null; ringkasanItem: string | null; bukanPenjualan: boolean }
export function isPesananWebsite(o: { sales_source?: string | null; external_order_id?: string | null }): boolean
export function statusXendit(o: { total_amount: number }, bayar: PembayaranRingkas[]): StatusXendit
export function toXenditFilter(v: unknown): XenditFilter
export function cocokFilterXendit(status: StatusXendit, f: XenditFilter): boolean   // 'selisih' mencakup 'dobel'
export function pembayaranTanpaPesananSelesai(
  bayar: PembayaranRingkas[], externalIdSelesai: Set<string>, externalIdBatal: Set<string>,
): { jenis: 'hanya_xendit' | 'batal'; bayar: PembayaranRingkas }[]
```

- [ ] **Step 1: Test** — `isPesananWebsite`: UUID+online → true; `F-3376293759` → false; `sales_source='pos'` → false. `statusXendit`: 0 bayar → belum; 1 bayar nominal sama → terverifikasi; beda → selisih; 2 bayar → dobel. `pembayaranTanpaPesananSelesai`: bukanPenjualan dibuang; external id batal → `batal`; tanpa external id / id tak dikenal → `hanya_xendit`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS. **Step 5:** Commit.

### Task 6: Sambungkan ke laporan (server)

**Files:**
- Create: `apps/admin-dashboard/src/lib/posReport/xenditLoad.ts`
- Modify: `apps/admin-dashboard/src/lib/posReport/laporan.ts` (`PosReportRequest`, `sanitizeRequest`, `getDerivedTable`, `laporanPosUntukScope`)
- Test: `apps/admin-dashboard/src/lib/posReport/xenditLoad.test.ts`

**Interfaces — Consumes:** Task 5. **Produces:**
- `PosReportRequest.xenditFilter?: string` (opsional, default `'all'`).
- `xenditLoad.ts`: `export async function muatPembayaranXendit(supabase, from: string, to: string): Promise<PembayaranRingkas[]>` — rentang `dibayar_at` [from 00:00 WIB − 1 hari, to 23:59 WIB + 1 hari], memo 30 detik per (scopeKey, from, to) — terpisah dari cache hari laporan.
- Tiap baris tabel website mendapat `xendit: { status: StatusXendit; bayar: PembayaranRingkas[] }`.
- Respons `laporanPosUntukScope` menambah `xenditLain: { jenis; bayar }[]` (sudah disaring cakupan outlet & filter cabang; baris tanpa outlet hanya bila `outlets` kosong/semua) dan `xenditTanpaOutletTersembunyi: number`.

- [ ] **Step 1: Test** (`xenditLoad.test.ts`, mock query): filter `belum` hanya menyisakan pesanan website ⏳; filter non-`all` membuang pesanan non-website; `table.footer` dan `analytics` identik dengan dan tanpa data Xendit; dengan filter cabang aktif, pembayaran tanpa outlet tidak masuk `xenditLain` dan terhitung di `xenditTanpaOutletTersembunyi`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Kunci `derived` memasukkan `xenditFilter`; footer dihitung dari baris setelah filter Xendit (sama seperti filter lain), tetapi analytics/KPI tidak tersentuh. Data Xendit hanya dimuat bila channel yang dipilih mencakup website atau `all`.
- [ ] **Step 4:** Run seluruh `src/lib/posReport` (termasuk `perfEquivalence.test.ts`) → PASS.
- [ ] **Step 5:** Commit.

### Task 7: Tampilan histori + salin ke finance & HR

**Files:**
- Create: `apps/admin-dashboard/src/app/dashboard/reports/pos/XenditBadge.tsx`
- Modify: `apps/admin-dashboard/src/app/dashboard/reports/pos/ReportsView.tsx` (filter "Xendit" di sebelah filter "Struk", lencana di kolom Total, blok `xenditLain` di atas tabel, chip filter aktif)
- Modify: `apps/admin-dashboard/src/app/actions/posReport.ts` (teruskan `xenditFilter`)
- Copy byte-identik: `xenditStatus.ts`, `xenditLoad.ts`, `laporan.ts`, `XenditBadge.tsx`, `posReport.ts` ke `apps/finance/src/...` dan `apps/HR/src/...` (lokasi mengikuti pasangan file yang sudah ada di daftar paritas); `ReportsView.tsx` finance/HR diubah setara
- Modify: `apps/finance/src/lib/posReport/rangkumanPenjualan.parity.test.ts`, padanan HR (tambahkan file baru)

**Interfaces — Consumes:** respons Task 6.

- [ ] **Step 1:** `XenditBadge` menampilkan: ✓ Xendit / ⏳ Belum / ⚠ Selisih (dua angka) / ⚠ Dobel; baris kedua `ID <8 karakter pertama>… · Ref QRIS <ref>` + tombol salin (salin ID lengkap); penanda "dicocokkan lewat nominal & jam" untuk `file_nominal_jam`.
- [ ] **Step 2:** Filter "Xendit" (Semua · ✓ Terverifikasi · ⏳ Belum · ⚠ Selisih · ⚠ Hanya di Xendit) hanya muncul bila Sumber berisi Website/`all`. Blok `xenditLain` (gaya peringatan, teks "tidak ada di POS" / "pesanan dibatalkan") tampil saat filter Semua atau Hanya di Xendit; catatan `xenditTanpaOutletTersembunyi` saat cabang difilter.
- [ ] **Step 3:** Salin ke finance & HR; tambahkan ke daftar paritas.
- [ ] **Step 4:** `yarn type-check` + tes paritas di admin-dashboard, finance, HR → lulus.
- [ ] **Step 5:** Uji browser (dev server admin-dashboard, akun admin): Website, Okt 2026 — lencana muncul, filter bekerja, angka KPI sama dengan sebelum fitur.
- [ ] **Step 6:** Commit.

### Task 8: Pencatatan otomatis dari FormOrder

**Files (repo `form order online`):**
- Create: `supabase/functions/_shared/catatXenditPos.ts`
- Modify: `supabase/functions/xendit-webhook/index.ts`, `supabase/functions/check-xendit-status/index.ts`

**Interfaces — Consumes:** pemetaan Task 0, tabel Task 1. **Produces:**
```ts
export async function catatPembayaranKePos(input: {
  xenditId: string; xenditRef: string | null; refQris: string | null; nominal: number; dibayarAt: string; channel: string | null
  orderId: string /* id Order Online */; outletPosId: string | null; namaPelanggan: string; ringkasanItem: string
}): Promise<void>   // tidak pernah throw; log saja
```
Upsert ke DB POS (`POS_SUPABASE_URL`, `POS_SUPABASE_SERVICE_ROLE_KEY`) on `xendit_id`, `sumber='webhook'`, `cara_cocok='webhook'`, `external_order_id=orderId`; baris yang sudah ada dari file dilengkapi (tautan webhook menang atas `file_nominal_jam`).

- [ ] **Step 1:** Test Deno (`catatXenditPos.test.ts`, fetch di-mock): tanpa secret → tidak throw; respons 500 dari POS → tidak throw; body upsert berisi `on_conflict=xendit_id`.
- [ ] **Step 2:** `deno test` → FAIL; implement; → PASS; `deno check` kedua fungsi.
- [ ] **Step 3:** Webhook: panggil `catatPembayaranKePos` untuk setiap event sukses SUCCEEDED/PAID **setelah order ditemukan dan sebelum** penjaga "sudah paid"/"status tidak valid" dan sebelum cek amount (pembayaran tetap tercatat apa pun hasilnya). Ambil outlet `pos_outlet_id` & item order (satu query tambahan).
- [ ] **Step 4:** `check-xendit-status`: panggil setelah update ke paid berhasil, memakai ID dari respons Xendit sesuai pemetaan Task 0.
- [ ] **Step 5:** Deploy (`xendit-webhook` verify_jwt=false, `check-xendit-status` setelan tetap). Uji: kiriman tanpa token → 403 (tak berubah). Setelah pembayaran asli berikutnya: baris `xendit_pembayaran` muncul dengan `cara_cocok='webhook'`, dan pesanan berlencana ✓ di admin.
- [ ] **Step 6:** Commit & push repo `form order online`.

### Task 9: Isi data Oktober & November, verifikasi

- [ ] **Step 1:** Unggah `BALANCE_HISTORY_REPORT_20261001_20261031_*.csv` di halaman Task 4.
- [ ] **Step 2:** Verifikasi terhadap hasil rekonsiliasi manual 18 Nov: Oktober — pesanan website selesai 1–28 Okt berstatus ✓ kecuali yang memang belum settle; Cileungsi #120/#108, Jagakarsa #55 ✓ (lewat nominal & jam); Cicurug pembayaran 14:33 → blok "pesanan dibatalkan" (#100), 14:50 → #7 ✓; `PR-…` dan Rp 2 tidak tampil; tidak ada "Hanya di Xendit" untuk Oktober.
- [ ] **Step 3:** Unggah file November bila tersedia; catat pembayaran "Hanya di Xendit" untuk ditindaklanjuti (bukan bagian plan ini).
- [ ] **Step 4:** Catat hasil di spec (bagian baru "Hasil pengisian awal"), commit.
