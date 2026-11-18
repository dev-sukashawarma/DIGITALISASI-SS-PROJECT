# Biaya Xendit di Rangkuman Penjualan — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kartu Admin Fee Rangkuman Penjualan memuat Biaya Xendit pesanan website (aktual dari file Balance History, estimasi untuk sisanya) dan Laba Kotor ikut terpotong.

**Architecture:** Aturan tarif murni di `lib/xendit/tarif.ts`. Saat file diunggah, biaya per pembayaran (`biaya_mdr`, `biaya_proses`) disimpan di `xendit_pembayaran`. `laporan.ts` — di luar cache hari laporan — memuat biaya pembayaran milik pesanan website selesai, menghitung total lewat `lib/posReport/biayaXendit.ts`, dan menyesuaikan `totalAdminFee`/`netDisbursement`/`realGrossProfit` pada salinan analytics. `compute.ts` tidak disentuh.

**Tech Stack:** Next.js (app router), TypeScript, Supabase/Postgres, Vitest, papaparse.

**Spec:** `docs/superpowers/specs/2026-11-18-biaya-xendit-rangkuman-penjualan-design.md`

## Global Constraints

- Hanya Rangkuman Penjualan. Profit, Laba Rugi Mitra, bagi hasil, bot, ekspor Excel/PDF tidak diubah.
- Pesanan website = `isPesananWebsite()` (`sales_source='online'` + `external_order_id` UUID).
- Tarif: Processing Fee **Rp 4.440** per pembayaran bertanggal bayar ≥ **2026-10-01 WIB**, 0 sebelumnya. MDR QRIS: `floor(nominal × 0,0063)` + `floor(fee × 0,11)`; QRIS < Rp 100.000 sejak 2026-10-01 = 0; sebelum 2026-10-01 semua QRIS kena MDR. VA = **9.000 + 990**. Channel kosong/tak dikenal = QRIS. (Cek file: 262.566 → 1.654 + 181; 127.762 → 804 + 88.)
- Pembayaran `bukan_penjualan` (PR-…, < Rp 1.000) tidak pernah dibebankan.
- Paritas: setiap berkas `lib/posReport/*`, `lib/xendit/tarif.ts`, `ReportsView.tsx`, `AdminFeeBreakdownTooltip.tsx` yang diubah/dibuat disalin **byte-identik** ke `apps/finance/src` & `apps/HR/src` dan didaftarkan di `src/lib/posReport/rangkumanPenjualan.parity.test.ts` keduanya.
- Migration bertimestamp `20261118…` (bukan 2030), diuji dalam transaksi + ROLLBACK dengan kontrol negatif. Apply ke produksi & push ke `main` hanya atas izin user.
- Komentar & teks UI dalam Bahasa Indonesia, mengikuti gaya berkas sekitarnya.

## Review Focus

1. Pesanan website dibayar dua kali (dobel) — biaya keduanya terhitung; pesanan dengan satu pembayaran tak-diketahui-biaya → hanya pembayaran itu yang diestimasi. (Test di Task 3.)
2. Pemanggil tanpa hak baca Xendit atau gagal muat → semua pesanan website diestimasi, laporan tetap tampil. (Test di Task 3.)
3. Unggah ulang file yang sama → nilai biaya identik, tidak menggandakan. (Test di Task 2.)
4. Analytics laporan di-cache dan dibagi antar pemanggil berhak-baca berbeda → biaya tidak boleh menempel ke objek cache. (Test di Task 4.)
5. Filter tanpa pesanan website (Kasir saja, SS Online) → `biayaXendit = 0`, kartu tak berubah. (Test di Task 3; Task 4 melewati query.)

---

### Task 1: Kolom biaya di `xendit_pembayaran` + aturan tarif

**Files:**
- Create: `supabase/migrations/20261118150000_xendit_pembayaran_biaya.sql` (pastikan dulu timestamp belum dipakai: `ls supabase/migrations | grep 20261118150000`)
- Create: `apps/admin-dashboard/src/lib/xendit/tarif.ts`
- Test: `apps/admin-dashboard/src/lib/xendit/tarif.test.ts`

**Interfaces:**
- Produces:
  - `BIAYA_PROSES = 4440`, `MULAI_BIAYA_PROSES = '2026-10-01'`
  - `tanggalWibDari(iso: string): string` → `'YYYY-MM-DD'` WIB
  - `biayaProses(dibayarAtIso: string): number` → 4440 atau 0
  - `jenisChannel(channel: string | null | undefined): 'qris' | 'va'` — `'QRIS'`/kosong/tak dikenal → `'qris'`; kode bank (BRI, BNI, MANDIRI, BSI, BCA, PERMATA, CIMB, BJB, …) → `'va'`
  - `mdrSeharusnya(nominal: number, channel: string | null | undefined, dibayarAtIso: string): number`
  - `estimasiBiayaXendit(nominal: number, channel: string | null | undefined, dibayarAtIso: string): number` = `mdrSeharusnya + biayaProses`

- [ ] **Step 1: Failing tests** `tarif.test.ts`:
  - `biayaProses('2026-09-30T16:59:59Z')` = 0 (23:59:59 WIB 30 Sep); `biayaProses('2026-09-30T17:00:00Z')` = 4440.
  - `mdrSeharusnya(262566,'QRIS','2026-10-26T07:50:39Z')` = 1835; `(127762,'QRIS','2026-10-25T08:33:57Z')` = 892; `(99999,'QRIS','2026-10-25T08:33:57Z')` = 0; `(50000,'QRIS','2026-09-29T05:00:00Z')` = 349; `(36216,'BNI','2026-10-25T08:33:57Z')` = 9990; `(36216,null,'2026-10-25T08:33:57Z')` = 0.
  - `estimasiBiayaXendit(262566,'QRIS','2026-10-26T07:50:39Z')` = 6275.
- [ ] **Step 2:** `cd apps/admin-dashboard && yarn vitest run src/lib/xendit/tarif.test.ts` → FAIL (module not found).
- [ ] **Step 3:** Implement `tarif.ts` per Interfaces.
- [ ] **Step 4:** Run test → PASS.
- [ ] **Step 5: Migration** — `ALTER TABLE public.xendit_pembayaran ADD COLUMN IF NOT EXISTS biaya_mdr numeric, ADD COLUMN IF NOT EXISTS biaya_proses numeric;` + `COMMENT ON COLUMN` (NULL = belum diketahui dari file Balance History). Tanpa perubahan RLS/grant.
- [ ] **Step 6: Uji migration** (konektor Supabase `execute_sql`, project produksi): kontrol negatif dulu — `SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='xendit_pembayaran' AND column_name IN ('biaya_mdr','biaya_proses')` → 0; lalu `BEGIN; <isi migration>; <query sama> → 2; ROLLBACK;`. Apply hanya **atas izin user**; sesudahnya query sama → 2 dan stempel `schema_migrations` sesuai nama berkas (rename berkas bila konektor menstempel versi lain).
- [ ] **Step 7: Commit** `feat(xendit): kolom biaya per pembayaran + aturan tarif`.

### Task 2: Unggah file menyimpan biaya

**Files:**
- Modify: `apps/admin-dashboard/src/lib/xendit/balanceHistory.ts` (+ `balanceHistory.test.ts`)
- Modify: `apps/admin-dashboard/src/lib/xendit/unggah.ts` (+ `unggah.test.ts`), `dbSupabase.ts`
- Modify: `apps/admin-dashboard/src/app/actions/xenditPembayaran.ts`
- Modify: `apps/admin-dashboard/src/app/dashboard/xendit-pembayaran/page.tsx` (tipe `Ringkasan` + 1 baris info)

**Interfaces:**
- Consumes: `mdrSeharusnya`, `biayaProses` (Task 1)
- Produces:
  - `parseBiayaXendit(csv: string): { mdrPerTransaksi: Record<string, number>; tagihanProses: number }` — `mdrPerTransaksi[transactionId]` = Σ Amount baris `Line Type` ∈ {`FEE`,`VAT`} DEBIT, dikunci **Transaction ID**; `tagihanProses` = Σ Amount `Transaction Type = PROCESSING_FEE_DEDUCTION` ÷ 4000.
  - `prosesUnggahXendit(db, baris, meta, biaya: { mdrPerTransaksi: Record<string, number>; tagihanProses: number } = { mdrPerTransaksi: {}, tagihanProses: 0 })` — `dataFile()` ikut mengisi `biaya_proses = biayaProses(dibayarAt)` dan `biaya_mdr` = `mdrPerTransaksi[id]` bila ada; `0` bila `mdrSeharusnya(nominal, channel, dibayarAt) === 0`; selain itu `null`.
  - `DbXendit.perbaruiBiaya(rows: { xendit_id: string; biaya_mdr: number }[]): Promise<void>` — dipakai untuk id di `mdrPerTransaksi` yang tak ada di `baris` tetapi ada di DB (cek lewat `ambilPembayaran`).
  - `RingkasanUnggah` + `tagihanProses: number; pembayaranBerbiayaProses: number` (baris file dengan `biaya_proses > 0`).
  - Tipe argumen `DbXendit.perbarui` ditambah `biaya_mdr` & `biaya_proses`.

- [ ] **Step 1: Failing tests**
  - `balanceHistory.test.ts`: CSV sintetis — QRIS 262.566 (Transaction ID `T1`) + baris FEE 1654 & VAT 181 ber-Transaction ID `T1` + satu `PROCESSING_FEE_DEDUCTION` 16000 → `parseBiayaXendit` = `{ mdrPerTransaksi: { T1: 1835 }, tagihanProses: 4 }`.
  - `unggah.test.ts`: (a) QRIS 50.000 Okt tanpa FEE → `sisipkan` menerima `biaya_mdr: 0, biaya_proses: 4440`; (b) VA BNI Okt tanpa FEE → `biaya_mdr: null`; (c) `T1` → `biaya_mdr: 1835`; (d) FEE ber-id `T9` yang tak ada di file tapi ada di DB → `perbaruiBiaya([{ xendit_id: 'T9', biaya_mdr: … }])`; (e) unggah dua kali → nilai biaya identik di `sisipkan`/`perbarui`; (f) ringkasan memuat `tagihanProses` & `pembayaranBerbiayaProses`.
- [ ] **Step 2:** `yarn vitest run src/lib/xendit` → FAIL.
- [ ] **Step 3:** Implement. Server action: baca teks file sekali, `parseBalanceHistory(teks)` + `parseBiayaXendit(teks)`, teruskan biaya ke `prosesUnggahXendit`. `perbaruiBiaya` = update per baris `.eq('xendit_id', …)`.
- [ ] **Step 4:** Halaman unggah: baris info abu-abu `Processing Fee di file: {tagihanProses} tagihan · pembayaran sejak 1 Okt: {pembayaranBerbiayaProses}` (bukan peringatan; selisih wajar karena tagihan jatuh sehari sesudah bayar/settlement).
- [ ] **Step 5:** Test PASS; `yarn type-check` lulus.
- [ ] **Step 6: Commit** `feat(xendit): simpan biaya per pembayaran saat unggah Balance History`.

### Task 3: Hitung Biaya Xendit laporan

**Files:**
- Create: `apps/admin-dashboard/src/lib/posReport/biayaXendit.ts`
- Test: `apps/admin-dashboard/src/lib/posReport/biayaXendit.test.ts`

**Interfaces:**
- Consumes: `isPesananWebsite` (`@/lib/xendit/website`), `estimasiBiayaXendit` (`@/lib/xendit/tarif`)
- Produces:
  - `type BiayaPembayaran = { externalOrderId: string; nominal: number; channel: string | null; dibayarAt: string; biayaMdr: number | null; biayaProses: number | null; bukanPenjualan: boolean }`
  - `type HasilBiayaXendit = { total: number; estimasi: number; jumlahPesananEstimasi: number }`
  - `hitungBiayaXendit(pesanan: Array<{ sales_source?: string | null; external_order_id?: string | null; total_amount: number | string; created_at: string }>, bayar: BiayaPembayaran[] | null): HasilBiayaXendit` — `bayar === null` = tanpa akses/gagal muat → semua estimasi. Per pesanan website: pembayaran penjualan yang tertaut; tiap pembayaran pakai `biayaMdr + biayaProses` bila keduanya non-null, selain itu `estimasiBiayaXendit(nominal, channel, dibayarAt)`; pesanan tanpa pembayaran → `estimasiBiayaXendit(total_amount, null, created_at)`. Pesanan masuk `jumlahPesananEstimasi` bila ≥1 bagiannya estimasi; `estimasi` = jumlah rupiah bagian estimasi.
  - `muatBiayaPembayaran(supabase: any, externalIds: string[]): Promise<BiayaPembayaran[] | null>` — `rpc('boleh_baca_xendit')` false → `null`; select `external_order_id, nominal, channel, dibayar_at, biaya_mdr, biaya_proses, bukan_penjualan` dengan `.in('external_order_id', potongan 200)`; error → throw.

- [ ] **Step 1: Failing tests** (`hitungBiayaXendit`):
  - satu pesanan, satu pembayaran `biayaMdr 1835, biayaProses 4440` → `{ total: 6275, estimasi: 0, jumlahPesananEstimasi: 0 }`
  - pesanan dobel, dua pembayaran `0 + 4440` → total 8880
  - satu aktual (`0+4440`) + satu VA BNI Okt `biayaMdr: null` → total 4440 + 14430 = 18870, `estimasi 14430`, `jumlahPesananEstimasi 1`
  - `bayar = null`, pesanan 50.000 bertanggal Okt → `{ total: 4440, estimasi: 4440, jumlahPesananEstimasi: 1 }`
  - pembayaran `bukanPenjualan` diabaikan; pesanan `sales_source: 'pos'` → total 0
  - pesanan 150.000 tanggal 29 Sep tanpa pembayaran → 1048
- [ ] **Step 2:** `yarn vitest run src/lib/posReport/biayaXendit.test.ts` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(laporan): hitung Biaya Xendit pesanan website`.

### Task 4: Pasang ke `laporan.ts`

**Files:**
- Modify: `apps/admin-dashboard/src/lib/posReport/biayaXendit.ts`, `apps/admin-dashboard/src/lib/posReport/laporan.ts` (`laporanPosUntukScope`)
- Test: `apps/admin-dashboard/src/lib/posReport/biayaXendit.test.ts`

**Interfaces:**
- Consumes: Task 3
- Produces (di `biayaXendit.ts`): `terapkanBiayaKeAnalytics<A extends { grossRevenue: number; totalHPP: number; totalAdminFee: number }>(a: A, h: HasilBiayaXendit): A & { biayaXendit: number; biayaXenditEstimasi: number; jumlahPesananEstimasiXendit: number; netDisbursement: number; realGrossProfit: number }` — mengembalikan **objek baru**; `totalAdminFee = a.totalAdminFee + h.total`, `netDisbursement = max(0, grossRevenue − totalAdminFee)`, `realGrossProfit = max(0, netDisbursement − totalHPP)` (rumus yang sama dengan `compute.ts`).

- [ ] **Step 1: Failing test** `terapkanBiayaKeAnalytics({ grossRevenue: 100000, totalHPP: 40000, totalAdminFee: 5000 }, { total: 6275, estimasi: 0, jumlahPesananEstimasi: 0 })` → `totalAdminFee 11275, netDisbursement 88725, realGrossProfit 48725, biayaXendit 6275`; objek input tetap `totalAdminFee 5000`.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** `laporanPosUntukScope`: bila `prepared.isSSOnlineSelected` atau tak ada pesanan website di `completedOrders` → `HasilBiayaXendit` nol tanpa query. Selain itu `muatBiayaPembayaran(scope.supabase, idUnik)` dalam try/catch (gagal → `console.error('Gagal memuat biaya Xendit:', e)` dan `null`), lalu `analytics: terapkanBiayaKeAnalytics({ ...summary, completedCount: completedOrders.length }, hitungBiayaXendit(completedOrders, bayar))`. `prepared.analytics` tidak dimutasi.
- [ ] **Step 4:** `yarn vitest run src/lib/posReport` & `yarn type-check` lulus.
- [ ] **Step 5: Commit** `feat(laporan): Biaya Xendit memotong Admin Fee & Laba Kotor`.

### Task 5: Tampilan kartu Admin Fee

**Files:**
- Modify: `apps/admin-dashboard/src/app/dashboard/reports/pos/ReportsView.tsx` (default analytics ±baris 382; kartu Admin Fee ±baris 741–800)
- Modify: `apps/admin-dashboard/src/components/profit/AdminFeeBreakdownTooltip.tsx`

**Interfaces:**
- Consumes: field analytics `biayaXendit`, `biayaXenditEstimasi`, `jumlahPesananEstimasiXendit` (Task 4).

- [ ] **Step 1:** Default analytics kosong + `biayaXendit: 0, biayaXenditEstimasi: 0, jumlahPesananEstimasiXendit: 0`.
- [ ] **Step 2:** Sub-rincian kartu: baris `Biaya Xendit:` → `formatRupiah(analytics.biayaXendit)` bila `> 0`, plus teks kecil `estimasi {n} pesanan` bila `jumlahPesananEstimasiXendit > 0`. Sembunyikan baris `Komisi Platform` bila `selectedChannels` hanya `['online']`; badge kanan atas untuk kondisi itu = `Promo & Xendit`.
- [ ] **Step 3:** Tooltip: tipe `analytics` + `biayaXendit?: number`; bila `> 0`, satu blok ringkas di atas tab platform: "Biaya Xendit (website): Rp … — Rp 4.440 Processing Fee per pembayaran + MDR QRIS ≥ Rp 100 rb (0,63% + PPN) / VA Rp 9.990".
- [ ] **Step 4:** `yarn type-check` lulus. Cek visual di preview dev server (sumber Website, Oktober) bila bisa login; kalau tidak, catat "belum dilihat di browser".
- [ ] **Step 5: Commit** `feat(laporan): tampilkan Biaya Xendit di kartu Admin Fee`.

### Task 6: Paritas finance & HR

**Files:**
- Copy byte-identik dari admin ke `apps/finance/src/` & `apps/HR/src/`: `lib/xendit/tarif.ts`, `lib/posReport/biayaXendit.ts`, `lib/posReport/laporan.ts`, `components/profit/AdminFeeBreakdownTooltip.tsx`
- Modify: `apps/finance/src/app/laporan/penjualan/ReportsView.tsx`, `apps/HR/src/app/penjualan/ReportsView.tsx` — perubahan Task 5 yang sama
- Modify: `src/lib/posReport/rangkumanPenjualan.parity.test.ts` di finance & HR — daftarkan `lib/xendit/tarif.ts` dan `lib/posReport/biayaXendit.ts`

- [ ] **Step 1:** Daftarkan dua berkas baru di kedua tes paritas → jalankan → FAIL (berkas belum ada).
- [ ] **Step 2:** Salin & terapkan.
- [ ] **Step 3:** `yarn vitest run` + `yarn type-check` lulus di `apps/finance`, `apps/HR`, dan `apps/admin-dashboard`.
- [ ] **Step 4: Commit** `chore(paritas): Biaya Xendit ke finance & HR`.

### Task 7: Verifikasi angka Oktober

- [ ] **Step 1:** Setelah migration live & kode ter-deploy (izin user), owner/admin mengunggah ulang file Oktober lalu November di `/dashboard/xendit-pembayaran`.
- [ ] **Step 2:** SQL baca saja: `SELECT count(*), sum(biaya_mdr + biaya_proses) FROM xendit_pembayaran WHERE NOT bukan_penjualan AND dibayar_at >= '2026-09-30T17:00:00Z' AND dibayar_at < '2026-10-31T17:00:00Z'` → **126 / 629.208**.
- [ ] **Step 3:** Rangkuman Penjualan, Oktober, sumber Website, semua cabang → Biaya Xendit = 629.208 dikurangi biaya pembayaran yang tak tertaut ke pesanan selesai (jelaskan per pembayaran bila ada), dengan `estimasi 0 pesanan`.
