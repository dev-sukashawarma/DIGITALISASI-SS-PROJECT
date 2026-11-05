# Kas Setoran Outlet & Kas Office — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pisahkan kas pusat jadi dua grup (Kas Setoran Outlet & Kas Office), tambah alur Setor ke Bank dengan receh otomatis ke Kas Office, dan fitur Income Lainnya sebagai pendapatan pusat.

**Architecture:** Kolom `cash_location.grup` jadi satu-satunya penanda grup. Semua tulis uang lewat RPC `SECURITY DEFINER` yang memeriksa role + grup sendiri; saldo tetap diurus trigger `cash_apply_balance` (tulis `cash_transaction` ber-status `reconciled`). UI finance hanya menyaring lokasi berdasarkan `grup`. Laba Perusahaan di admin-dashboard menambah baris Pendapatan Lain-lain.

**Tech Stack:** Supabase Postgres (plpgsql), Next.js app router, React Query, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-05-finance-kas-setoran-office-design.md`

## Global Constraints

- Rekening setoran baru: `0955193763`, pemegang `PT SUKA PROFIT BERKAH`. Rekening office: `0955381004`. `bank_name` dibiarkan NULL (diisi finance di halaman Lokasi).
- Rekening lama `0c116d5f-f147-4eff-9bc2-ce9d549e2869` (BCA 48523399425) → `is_active = false`, riwayat tak disentuh.
  Akibatnya saldo sistem Rp 602,5 jt hilang dari total dashboard (`summarizeBalances` melewati lokasi nonaktif) — itu disengaja (K3: mulai bersih, finance rekonsiliasi manual). Sejak Task 1 + Task 4 ter-apply, setoran baru otomatis hanya bisa ke lokasi baru, bahkan sebelum app di-redeploy.
- Lokasi `a64f9484-70e9-4bf7-b62d-2643835a1874` (Kas Setoran) → label `Kas Setoran Tunai`, grup `setoran_outlet`. Saldonya (Rp 110,9 jt) TIDAK diubah sistem.
- Lokasi baru: `opening_balance = 0`, `opening_date = '2026-11-01'`, `scope = 'pusat'`.
- Nilai `grup`: `'setoran_outlet' | 'office'` (NULL untuk Kas Kecil outlet & lokasi nonaktif).
- Role pencatat Setor ke Bank & Income Lainnya: `admin_finance`, `admin`, `owner` dengan `outlet_staff.status = 'active'`. Jangan pakai `is_finance()` (memuat spv/leader/area_manager) atau `is_finance_checker()` (tanpa cek status).
- Nominal ke bank wajib kelipatan Rp 50.000.
- Kategori Income Lainnya (kunci → label): `minyak_jelantah` Minyak Jelantah · `kardus_bekas` Kardus Bekas · `kompan_bekas` Kompan/Jerigen Bekas · `equipment_bekas` Equipment Bekas · `lainnya` Lainnya.
- Income Lainnya = pendapatan pusat; tak boleh masuk laba outlet / bagi hasil mitra.
- Tanggal WIB (`Asia/Jakarta`) untuk semua filter periode.
- Migration: cek `SELECT version FROM supabase_migrations.schema_migrations WHERE version LIKE '20261105%'` sebelum memilih timestamp; verifikasi stempel dengan SELECT setelah apply. Verifikasi objek ke katalog, bukan exit code.
- Jangan `yarn install` di root (lihat CLAUDE.md "Menambah dependency").

## Review Focus

1. Saldo Kas Setoran Tunai lebih kecil dari yang diambil (dua finance setor bersamaan) → RPC menolak, saldo tak pernah minus. Test di Task 2 (kunci baris `FOR UPDATE` pada `cash_balance`).
2. Lokasi bergrup salah dipilih lewat panggilan langsung RPC (setoran outlet ke Kas Office, top-up petty cash dari rekening setoran) → ditolak di DB, bukan hanya disembunyikan di UI. Test di Task 4.
3. Income Lainnya dibatalkan → saldo Kas Office kembali, baris hilang dari Pendapatan Lain-lain, tapi jejaknya tetap (siapa/kapan). Test di Task 3.
4. Input nominal format Indonesia (`"1.250.000"`) dibaca 1.250 → semua input rupiah lewat parser format Indonesia yang ada (`CurrencyInput`/helper existing), bukan `Number()`. Test di Task 5.
5. Laba Perusahaan periode lama (Agustus/September closing) tak bergeser → Pendapatan Lain-lain hanya dari baris yang ada (mulai Nov). Test di Task 9.

---

### Task 1: Skema grup kas, lokasi baru, tabel Setor Bank & Income Lainnya

**Files:**
- Create: `supabase/migrations/20261105100000_kas_grup_setoran_office.sql`
- Test: `supabase/verifikasi/kas_office/t1_skema.sql`

**Interfaces:**
- Produces: `cash_location.grup text NULL CHECK (grup IN ('setoran_outlet','office'))`; `cash_transaction_source_type_check` + `'setor_bank'`, `'income_lain'`; tabel `setor_bank (id uuid pk, occurred_at timestamptz, total_diambil numeric >0, nominal_bank numeric >0, receh numeric >=0, proof_url text not null, note text, created_by uuid → outlet_staff, created_at)`; tabel `income_lainnya (id uuid pk, occurred_at timestamptz, kategori text CHECK 5 kunci, keterangan text, pembeli text not null, asal_outlet_id uuid null → outlets, amount numeric >0, cash_location_id uuid → cash_location, proof_url text not null, cash_transaction_id uuid → cash_transaction, status text 'aktif'|'batal' default 'aktif', batal_by uuid, batal_at timestamptz, batal_alasan text, created_by uuid, created_at)` dengan CHECK `kategori <> 'lainnya' OR btrim(keterangan) <> ''`.
- Lokasi baru (UUID tetap, tulis eksplisit di migration agar Task 10 bisa merujuk): Rekening Setoran `0955193763` (bank, grup setoran_outlet), Rekening Office `0955381004` (bank, grup office), `Kas Office Tunai` (cash, grup office).
- RLS: kedua tabel baru `ENABLE ROW LEVEL SECURITY`; `REVOKE ALL FROM anon, authenticated`; `GRANT SELECT TO authenticated` + policy SELECT `is_finance_checker()`. Tulis hanya lewat RPC.

- [ ] **Step 1:** Tulis `t1_skema.sql` (transaksi + ROLLBACK, `DO` blok RAISE bila gagal): 4 lokasi aktif ber-grup (2 `setoran_outlet`, 2 `office`); lokasi lama `is_active=false`; insert `cash_transaction` ber-`source_type='setor_bank'` lolos; insert `income_lainnya` kategori `lainnya` keterangan kosong DITOLAK; `anon` tak bisa SELECT `income_lainnya`. Kontrol negatif: blok terakhir sengaja `RAISE` untuk membuktikan kanal bisa gagal.
- [ ] **Step 2:** Jalankan t1 sebelum migration → gagal (kolom `grup` tak ada).
- [ ] **Step 3:** Tulis migration (idempoten: `IF NOT EXISTS`, `ON CONFLICT (id) DO NOTHING`, `DROP CONSTRAINT IF EXISTS` lalu buat ulang CHECK source_type dengan daftar lama + 2 nilai baru).
- [ ] **Step 4:** Apply, verifikasi katalog (`information_schema.columns`, `pg_constraint`), jalankan t1 → LULUS, stempel `schema_migrations`.
- [ ] **Step 5:** Commit.

### Task 2: RPC `record_setor_bank`

**Files:**
- Create: `supabase/migrations/20261105101000_rpc_setor_bank.sql`
- Test: `supabase/verifikasi/kas_office/t2_setor_bank.sql`

**Interfaces:**
- Consumes: Task 1.
- Produces: `record_setor_bank(p_total_diambil numeric, p_nominal_bank numeric, p_proof_url text, p_note text DEFAULT NULL) RETURNS uuid` (id `setor_bank`). Sumber = satu-satunya lokasi aktif `grup='setoran_outlet' AND kind='cash'`; tujuan bank = lokasi aktif `grup='setoran_outlet' AND kind='bank'`; tujuan receh = lokasi aktif `grup='office' AND kind='cash'`. Tulis 3 baris `cash_transaction` (`source_type='setor_bank'`, `source_id` = id setor_bank, status `reconciled`): out sumber `total_diambil` (kategori `Setor ke Bank`), in bank `nominal_bank`, in Kas Office Tunai `receh` (hanya bila `receh > 0`, kategori `Receh Setoran`).

Validasi (urut, pesan Bahasa Indonesia): role (Global Constraints) → `proof_url` wajib → `nominal_bank > 0` dan `mod(nominal_bank, 50000) = 0` → `nominal_bank <= total_diambil` → kunci `cash_balance` sumber `FOR UPDATE`, `total_diambil <= saldo` → lokasi tujuan masing-masing tepat satu (selain itu raise).

- [ ] **Step 1:** t2 (ROLLBACK, simulasi admin_finance via `request.jwt.claims` + `SET LOCAL ROLE authenticated`; ambil semua id fixture SEBELUM ganti peran): (a) total 1.237.500 / bank 1.200.000 → saldo tunai −1.237.500, bank +1.200.000, office tunai +37.500; (b) bank 1.225.000 ditolak (bukan kelipatan); (c) total > saldo ditolak; (d) bank > total ditolak; (e) proof kosong ditolak; (f) role `spv` ditolak; (g) total = bank → tanpa baris receh.
- [ ] **Step 2:** Jalankan → gagal (fungsi tak ada).
- [ ] **Step 3:** Tulis migration (`SECURITY DEFINER SET search_path = public`, `REVOKE EXECUTE FROM PUBLIC, anon`, `GRANT EXECUTE TO authenticated`).
- [ ] **Step 4:** Apply, jalankan t2 → LULUS, stempel.
- [ ] **Step 5:** Commit.

### Task 3: RPC Income Lainnya

**Files:**
- Create: `supabase/migrations/20261105102000_rpc_income_lainnya.sql`
- Test: `supabase/verifikasi/kas_office/t3_income_lainnya.sql`

**Interfaces:**
- Consumes: Task 1.
- Produces: `record_income_lainnya(p_occurred_at timestamptz, p_kategori text, p_keterangan text, p_pembeli text, p_asal_outlet uuid, p_amount numeric, p_cash_location uuid, p_proof_url text) RETURNS uuid`; `batal_income_lainnya(p_id uuid, p_alasan text) RETURNS void`.
- `record_*`: lokasi wajib aktif `grup='office'`; tulis `cash_transaction` in (`source_type='income_lain'`, `category` = label kategori, `source_id` = id income) lalu isi `income_lainnya.cash_transaction_id`.
- `batal_*`: hanya baris `status='aktif'`; alasan wajib; set `status='batal'`, `batal_by/at/alasan`; ubah `cash_transaction` pasangannya ke `void` (trigger membalik saldo). Tak pernah DELETE.

- [ ] **Step 1:** t3: catat Rp 150.000 kardus ke Kas Office Tunai → saldo +150.000; ke rekening setoran ditolak; kategori `lainnya` tanpa keterangan ditolak; proof kosong ditolak; role crew ditolak; batal → saldo kembali, baris tetap ada `status='batal'`, `batal_by` terisi; batal kedua kali ditolak.
- [ ] **Step 2:** Jalankan → gagal.
- [ ] **Step 3:** Tulis migration (pola hak akses sama Task 2).
- [ ] **Step 4:** Apply, t3 LULUS, stempel.
- [ ] **Step 5:** Commit.

### Task 4: Penjaga grup di setoran outlet & top-up petty cash

**Files:**
- Create: `supabase/migrations/20261105103000_penjaga_grup_kas.sql`
- Test: `supabase/verifikasi/kas_office/t4_penjaga_grup.sql`

**Interfaces:**
- Modifies (CREATE OR REPLACE dari `pg_get_functiondef` live, hanya menambah satu cek; ambil definisi live dulu, jangan dari file migration lama): `record_cash_deposit` — lokasi wajib `grup='setoran_outlet'` (pesan: `setoran outlet harus ke Kas Setoran Outlet`); `finance_process_petty_cash` dan `finance_process_petty_cash_custom` — bila `p_cash_location_id` diisi, wajib `grup='office'` (pesan: `top-up petty cash harus dari Kas Office`).
- Pastikan `SECURITY DEFINER` + `SET search_path` + grant tetap sama sebelum & sesudah (bandingkan `prosecdef`, `proconfig`, `proacl`).

- [ ] **Step 1:** t4: setoran ke Kas Office Tunai ditolak, ke Rekening Setoran lolos; proses petty cash dengan lokasi Rekening Setoran ditolak, dengan Rekening Office lolos (pakai topup fixture dalam transaksi ROLLBACK).
- [ ] **Step 2:** Jalankan → gagal (setoran ke Kas Office masih lolos).
- [ ] **Step 3:** Tulis migration.
- [ ] **Step 4:** Apply, t4 LULUS, cek `proacl/proconfig` identik, stempel.
- [ ] **Step 5:** Commit.

### Task 5: Logika murni kas (finance)

**Files:**
- Create: `apps/finance/src/lib/kas/grupKas.ts`, `apps/finance/src/lib/kas/setorBank.ts`, `apps/finance/src/lib/kas/incomeLainnya.ts`
- Test: `apps/finance/src/lib/kas/grupKas.test.ts`, `setorBank.test.ts`, `incomeLainnya.test.ts`
- Modify: `apps/finance/src/lib/types.ts` (`CashLocation.grup: 'setoran_outlet' | 'office' | null`)

**Interfaces:**
- Produces:
  - `type GrupKas = 'setoran_outlet' | 'office'`; `GRUP_LABEL: Record<GrupKas,string>` = `{ setoran_outlet: 'Kas Setoran Outlet', office: 'Kas Office' }`
  - `lokasiGrup(locs: LocationWithBalance[], grup: GrupKas, kind?: CashKind): LocationWithBalance[]` (hanya aktif)
  - `ringkasGrup(locs): Record<GrupKas, { bank: number; tunai: number; total: number }>`
  - `hitungSetorBank(i: { saldoTunai: number; diambil: number; keBank: number }): { receh: number; galat: string | null }`
  - `INCOME_KATEGORI` (5 kunci + label, Global Constraints), `validasiIncome(i): string | null`

- [ ] **Step 1:** Test: `hitungSetorBank({saldoTunai: 6_287_500, diambil: 6_287_500, keBank: 6_250_000})` → `{receh: 37_500, galat: null}`; keBank 6_225_000 → galat kelipatan; diambil > saldo → galat; keBank > diambil → galat; keBank 0 → galat. `ringkasGrup` mengabaikan lokasi nonaktif & `grup=null`. `lokasiGrup(.., 'office', 'cash')` hanya Kas Office Tunai. `validasiIncome` menolak `lainnya` tanpa keterangan, amount ≤ 0, pembeli kosong, tanpa bukti.
- [ ] **Step 2:** `cd apps/finance && ./node_modules/.bin/vitest run src/lib/kas` → FAIL.
- [ ] **Step 3:** Implement. Pesan galat sama persis dengan RPC (Task 2/3) agar UI & DB bicara sama.
- [ ] **Step 4:** Test PASS; `yarn type-check` (finance) 0 error baru.
- [ ] **Step 5:** Commit.

### Task 6: Buang lokasi hardcode & saring tujuan setoran

**Files:**
- Modify: `apps/finance/src/hooks/useCashData.ts` (hapus `DEFAULT_LOCATIONS`; data kosong = kosong + pesan), `apps/finance/src/app/petty-cash/components/FinanceApprovalModal.tsx` (hapus `HARDCODED_LOCATIONS`; pilihan = `lokasiGrup(locations,'office', method==='transfer'?'bank':'cash')`, tanpa fallback ke semua lokasi), `apps/finance/src/app/setoran/components/SetoranView.tsx:53-59,90` (filter = `lokasiGrup(locations,'setoran_outlet',kind)`), `apps/finance/src/app/actions/setoran.ts` (`updateCashDepositMethodAction` tolak lokasi tujuan `grup !== 'setoran_outlet'`).
- Test: `apps/finance/src/app/actions/setoran.test.ts` (baru; mock service client) — pindah ke lokasi grup office → throw.

**Interfaces:** Consumes Task 5 `lokasiGrup`; select `cash_location` harus memuat `grup`.

- [ ] **Step 1:** Tulis test action → FAIL.
- [ ] **Step 2:** Implement keempat perubahan.
- [ ] **Step 3:** Test PASS, type-check bersih, `grep -rn "0c116d5f\|48523399425" apps/finance/src` → 0 hasil.
- [ ] **Step 4:** Commit.

### Task 7: Modal Setor ke Bank di halaman Setoran

**Files:**
- Create: `apps/finance/src/app/setoran/components/SetorBankModal.tsx`, `apps/finance/src/hooks/useSetorBank.ts`
- Modify: `apps/finance/src/app/setoran/components/SetoranView.tsx` (tombol "Setor ke Bank" di kartu Kas Setoran Tunai)

**Interfaces:**
- Consumes: `record_setor_bank` (Task 2), `hitungSetorBank` (Task 5).
- Produces: `useSetorBank()` → mutation `{ diambil, keBank, proofFile, note }`; unggah bukti ke bucket `finance-proofs` path `setor-bank/<ts>-<nama>`; invalidate `cash_transaction`, `cash_balance`, `cash_location`.

Form: "Uang diambil dari Kas Setoran Tunai" (default = saldo), "Disetor ke bank (kelipatan Rp 50.000)", baris turunan "Receh ke Kas Office Tunai: Rp X" langsung dihitung, bukti wajib, tombol mati selama `galat` ada.

- [ ] **Step 1:** Implement hook + modal.
- [ ] **Step 2:** type-check + build `--webpack` finance sukses.
- [ ] **Step 3:** Commit.

### Task 8: Halaman Income Lainnya + grup kas di dashboard

**Files:**
- Create: `apps/finance/src/app/income-lainnya/page.tsx`, `apps/finance/src/app/income-lainnya/components/IncomeLainnyaView.tsx`, `apps/finance/src/hooks/useIncomeLainnya.ts`
- Modify: `apps/finance/src/components/CashLayout.tsx` (entri nav "Income Lainnya" di grup kas), `apps/finance/src/app/DashboardClient.tsx` (kartu saldo dikelompokkan via `ringkasGrup`: Kas Setoran Outlet [Rekening · Tunai] dan Kas Office [Rekening · Tunai]; lokasi nonaktif disembunyikan)

**Interfaces:**
- Consumes: `record_income_lainnya`, `batal_income_lainnya` (Task 3); `INCOME_KATEGORI`, `validasiIncome`, `ringkasGrup`, `GRUP_LABEL` (Task 5).
- Produces: `useIncomeLainnya({ from, to })` (filter `occurred_at` WIB, urut terbaru, `.range()` berhalaman), `useCatatIncome()`, `useBatalIncome()`.

Daftar: tanggal, kategori, pembeli, asal outlet, nominal, masuk ke, bukti, status; baris batal tampil dicoret + alasan. Tombol Batal hanya untuk baris aktif. Total periode hanya baris aktif.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** type-check + build `--webpack` sukses; route `/income-lainnya` muncul.
- [ ] **Step 3:** Commit.

### Task 9: Pendapatan Lain-lain di Laba Perusahaan (admin-dashboard)

**Files:**
- Modify: `apps/admin-dashboard/src/lib/profit.ts:41` → `computeCompanyProfit(sumLabaOutlet: number, pengeluaranPusat: number, pendapatanLain = 0)` = `sumLabaOutlet - pengeluaranPusat + pendapatanLain`
- Create: `apps/admin-dashboard/src/hooks/usePendapatanLain.ts` (SUM `income_lainnya.amount` `status='aktif'` dalam periode WIB)
- Modify: `apps/admin-dashboard/src/app/dashboard/owner/profit/ProfitView.tsx:647` (teruskan pendapatanLain hanya saat `isAllOutlets`; tampilkan baris "Pendapatan Lain-lain" bila > 0), `apps/admin-dashboard/src/lib/export/profitExportFetcher.ts` (ikut kolom yang sama)
- Test: `apps/admin-dashboard/src/lib/profit.test.ts` (tambah kasus)

**Interfaces:** Consumes tabel `income_lainnya` (Task 1). RLS SELECT `is_finance_checker()` sudah meloloskan owner/admin.

- [ ] **Step 1:** Test: `computeCompanyProfit(1_000_000, 300_000)` = 700_000 (perilaku lama); `computeCompanyProfit(1_000_000, 300_000, 150_000)` = 850_000.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** Pastikan mode laba outlet/mitra (`!isAllOutlets`, `scope==='mitra'`) tak menerima pendapatanLain (cek manual di diff + test bila ada helper).
- [ ] **Step 4:** type-check + build admin-dashboard sukses. Laba Perusahaan Agustus & September sebelum/sesudah identik (tak ada baris income sebelum Nov).
- [ ] **Step 5:** Commit.

### Task 10: Pindahkan transaksi November ke lokasi baru (data, setelah deploy)

**Files:**
- Create: `SS COGS SET/pindah-kas-november-2026-11-05.sql` (arsip, bukan migration)

**Prasyarat:** Task 1–8 sudah ter-deploy dan rekening lama nonaktif (tak ada tulisan baru ke sana). Izin owner sebelum dijalankan.

Isi (satu transaksi):
1. Hitung dan cetak jumlah target: `cash_transaction` di lokasi lama dengan `occurred_at >= '2026-11-01 00:00+07'`, per `source_type`. Asersi: hanya `cash_deposit` & `petty_cash_topup`; jumlah ≥ 74 / ≥ 16 (nilai saat grilling); hentikan bila ada `source_type` lain.
2. `cash_deposit` → Rekening Setoran baru; `petty_cash_topup` → Rekening Office. Pola per baris: `status='void'` → ganti `cash_location_id` (+ `category` tetap) → status semula (trigger memindah saldo).
3. `petty_cash_topups.disbursed_from_cash_location_id` untuk topup yang bersangkutan (via `cash_transaction.source_id`) → Rekening Office.
4. Asersi akhir: 0 baris November tersisa di lokasi lama; jumlah & total nominal per lokasi baru = angka langkah 1; total saldo `cash_balance` seluruh lokasi sebelum = sesudah.

- [ ] **Step 1:** Tulis skrip; uji dulu dengan `ROLLBACK` di akhir, catat angka.
- [ ] **Step 2:** Minta OK owner dengan angka langkah 1.
- [ ] **Step 3:** Jalankan dengan `COMMIT`, verifikasi asersi.
- [ ] **Step 4:** Commit arsip.

### Task 11: Dokumentasi & redeploy

**Files:**
- Modify: `CLAUDE.md` (entri sesi: grup kas, RPC baru, `is_finance()` jangan dipakai untuk uang, "⚠️ Perlu redeploy finance + admin-dashboard")

- [ ] **Step 1:** Tulis entri.
- [ ] **Step 2:** Commit.
- [ ] **Step 3:** Smoke test setelah redeploy (manual, akun admin_finance): setoran tunai outlet → Setor ke Bank 1 transaksi dengan receh → saldo tiga kas berubah benar; catat Income Lainnya → batal; top-up petty cash hanya menawarkan Kas Office.
