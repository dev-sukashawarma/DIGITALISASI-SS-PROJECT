# Kasbon Dicairkan Finance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kasbon disetujui HR menjadi `menunggu_cair`; finance mencairkan dari Rekening Petty Cash (Bank/Tunai) lewat Hub Approval, baru kemudian kasbon `active` dan dipotong gaji.

**Architecture:** Nilai `cash_advances.status` baru `menunggu_cair` dijaga trigger `BEFORE` di DB (semua klien lama ikut terkunci). Finance hanya menulis lewat tiga RPC `SECURITY DEFINER` yang memotong saldo lewat `cash_transaction` (`source_type='kasbon'`). App HR/admin/absensi/bot hanya menyesuaikan tampilan + menutup jalur kasbon manual di slip.

**Tech Stack:** Supabase Postgres (plpgsql, RLS), Next.js app router + React Query, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-13-kasbon-pencairan-finance-design.md`

## Global Constraints

- Bekerja di branch `feat/kasbon-pencairan-finance` (worktree). Jangan commit ke `main`.
- Nilai status persis: `menunggu_cair`. Rekening: Petty Cash Bank `b0955381-0040-4c0e-9a11-5e70a0000002`, Petty Cash Tunai `b0000000-0ff1-4c0e-9a11-5e70a0000003` — tapi kode memilih lewat `grup='petty_cash' AND scope='pusat' AND is_active`, tidak meng-hardcode id.
- Peran pencair = `kas_pencatat_ok()` (admin_finance, admin, owner) **atau** developer aktif. **Jangan `is_finance()`.**
- Pencair ≠ `cash_advances.approved_by` (bila tidak NULL).
- Bukti di bucket `finance-proofs`, path `kasbon/<kasbon_id>-<Date.now()>-<nama_aman>`.
- Migration bertimestamp hari ini (`20261113…`); lint menolak 2030. Diterapkan **sebelum** app di-merge, dan hanya setelah owner mengizinkan; diterapkan lewat konektor Supabase `mcp__5f2e798c…__execute_sql` (isi berkas), lalu stempel `INSERT INTO supabase_migrations.schema_migrations(version,name)` dengan versi = nama berkas, lalu verifikasi ke katalog. Jangan `db push` polos.
- `npx` rusak di repo ini: jalankan `./node_modules/.bin/vitest` / `yarn test` per app. Jangan `yarn install` di worktree ber-junction.
- Push ke `main` = deploy otomatis; merge hanya atas perintah owner.

## Review Focus

1. **Admin/owner yang menyetujui di HR lalu membuka Hub** — tombol Cairkan nonaktif dengan alasan, dan RPC menolak walau tombolnya dilewati. (Task 2 T2e, Task 4 `bolehCairkan` test, Task 5 modal test)
2. **HR mengubah nominal saat kasbon sudah tampil di Hub (tab basi)** — yang tercatat di rekening adalah nominal terkini di DB, bukan angka di layar. (Task 2 T2c)
3. **Dua finance menekan Cairkan bersamaan** — hanya satu `cash_transaction`; panggilan kedua gagal "tidak menunggu pencairan". (Task 2 T2d)
4. **Bukti terunggah tapi RPC gagal (saldo kurang)** — kasbon tetap di antrean, nol transaksi, pesan galat RPC tampil apa adanya. (Task 2 T2b + Task 5 mutasi melempar galat RPC)
5. **Slip draft lama berisi potongan kasbon untuk staf tanpa kasbon aktif** — finalisasi menolak dengan nama staf, bukan diam-diam membuat kasbon lunas. (Task 7 test `cekPotonganKasbonSlip`)

---

### Task 1: DB — kolom, CHECK, trigger penjaga

**Files:**
- Create: `supabase/migrations/20261113140000_kasbon_cair_skema_penjaga.sql`
- Test: `supabase/verifikasi/kasbon_cair/t1_penjaga.sql`

**Interfaces:**
- Produces: kolom `cash_advances.{dicairkan_at timestamptz, dicairkan_oleh uuid, dicairkan_dari uuid REFERENCES cash_location(id), metode_cair text CHECK (metode_cair IN ('transfer','tunai')), bukti_cair text, cash_transaction_id uuid, ditolak_finance_at timestamptz, ditolak_finance_oleh uuid}`; CHECK `cash_advances_status_check` = `status IN ('active','paid_off','menunggu_cair')`; flag transaksi `app.kasbon_cair` (`set_config('app.kasbon_cair','on',true)`) yang dipakai Task 2.
- Fungsi `public.cash_advances_jaga_cair()` + trigger `trg_cash_advances_00_jaga_cair BEFORE INSERT OR UPDATE ON cash_advances`.
- Fungsi `public.cash_advance_payments_jaga_cair()` + trigger `trg_cash_advance_payments_jaga_cair BEFORE INSERT ON cash_advance_payments`.

Aturan trigger `cash_advances_jaga_cair` (`v_flag := current_setting('app.kasbon_cair', true) = 'on'`), semua pelanggaran `RAISE … USING ERRCODE='check_violation'`:
1. INSERT dari sesi user (`auth.uid() IS NOT NULL`) dengan `status IN ('active','paid_off')` dan `status_hr='approved'` → ditolak ("Kasbon disetujui harus menunggu pencairan finance"). `status_hr='pending'` + `status='active'` (default absensi) tetap boleh.
2. `status_hr` menjadi `approved` (INSERT, atau UPDATE dari selain `approved`) dan `status <> 'paid_off'` → `NEW.status := 'menunggu_cair'`; `NEW.approved_by := coalesce(NEW.approved_by, auth.uid())`; `NEW.approved_at := coalesce(NEW.approved_at, now())`.
3. UPDATE `menunggu_cair → active` atau `active → menunggu_cair` tanpa `v_flag` → ditolak. `menunggu_cair → paid_off` → ditolak. `active → paid_off` boleh.
4. `NEW.status='menunggu_cair'` → `NEW.remaining := NEW.amount`.
5. `OLD.status IN ('active','paid_off')` dan `amount` atau `installment_months` berubah → ditolak; `remaining` naik → ditolak.
6. `NEW.status_hr='rejected'` dan `OLD.status_hr='approved'` dan `OLD.status <> 'menunggu_cair'` → ditolak ("Kasbon yang sudah dicairkan tidak bisa ditolak").

`cash_advance_payments_jaga_cair`: tolak bila kasbon induk `status <> 'active'` ("Cicilan hanya untuk kasbon yang sudah dicairkan").

- [ ] **Step 1: Tulis uji `t1_penjaga.sql`** — gaya `supabase/verifikasi/kas_office/t8_top_up.sql` (`BEGIN; DO $$…$$; ROLLBACK;`, diakhiri `RAISE EXCEPTION 'KONTROL: T1 semua asersi lolos'`). Ambil id `admin_hr` aktif & satu crew di awal (sebelum ganti peran). Asersi:
  - T1a: crew INSERT `status_hr` default → baris `status='active'`, `status_hr='pending'`.
  - T1b: sebagai admin_hr UPDATE `status_hr='approved', status='active'` → baris tersimpan `status='menunggu_cair'`, `approved_by` = admin_hr, `remaining=amount`.
  - T1c: admin_hr UPDATE `status='active'` → `check_violation`.
  - T1d: INSERT `cash_advance_payments` untuk kasbon itu → `check_violation`.
  - T1e: admin_hr INSERT `status_hr='approved', status='paid_off'` → `check_violation`; dengan `request.jwt.claims` dikosongkan (`auth.uid()` NULL) → berhasil.
  - T1f: admin_hr UPDATE `amount` saat `menunggu_cair` → berhasil dan `remaining` ikut.
  - T1g: `set_config('app.kasbon_cair','on',true)` lalu UPDATE `status='active'` → berhasil; kembalikan flag `off`; UPDATE `amount` → `check_violation`; UPDATE `status_hr='rejected'` → `check_violation`.
- [ ] **Step 2: Jalankan uji sebelum migration** — via `execute_sql`. Expected: gagal di T1b (`status` masih `active`).
- [ ] **Step 3: Tulis migration** — `ALTER TABLE … ADD COLUMN IF NOT EXISTS …`; `DROP CONSTRAINT IF EXISTS cash_advances_status_check` lalu `ADD`; dua fungsi `SECURITY DEFINER SET search_path=public` (perlu `auth.uid()` saja, bukan hak tulis); `REVOKE ALL … FROM PUBLIC, anon`. Header: tulis bahwa tabel `cash_advances` tidak lahir di migration mana pun.
- [ ] **Step 4: Minta izin owner, terapkan, stempel, verifikasi** — `pg_constraint` (CHECK memuat `menunggu_cair`), `pg_trigger` (kedua trigger ada & aktif).
- [ ] **Step 5: Jalankan uji** — Expected: hanya `KONTROL: T1 semua asersi lolos`. Lalu kontrol negatif: ubah sementara T1c jadi mengharapkan sukses → harus gagal; kembalikan.
- [ ] **Step 6: Commit** `feat(kasbon): status menunggu_cair + trigger penjaga`

### Task 2: DB — RPC cair/tolak/batal, riwayat Hub, push crew

**Files:**
- Create: `supabase/migrations/20261113141000_kasbon_cair_rpc.sql`
- Test: `supabase/verifikasi/kasbon_cair/t2_rpc.sql`

**Interfaces:**
- Consumes: Task 1 (kolom, flag `app.kasbon_cair`).
- Produces (semua `SECURITY DEFINER SET search_path=public`, `REVOKE … FROM PUBLIC, anon`, `GRANT EXECUTE … TO authenticated`):
  - `finance_kasbon_menunggu() RETURNS TABLE(id uuid, staff_id uuid, staff_nama text, outlet_nama text, amount numeric, amount_requested numeric, reason text, installment_months int, approval_note text, approved_at timestamptz, approved_by uuid, penyetuju_nama text, created_at timestamptz)` — `status_hr='approved' AND status='menunggu_cair'`, urut `approved_at`. Ada karena RLS `outlet_staff` menahan nama staf untuk admin_finance.
  - `finance_cairkan_kasbon(p_id uuid, p_cash_location_id uuid, p_bukti text) RETURNS uuid` (id `cash_transaction`).
  - `finance_tolak_kasbon(p_id uuid, p_alasan text) RETURNS void`.
  - `finance_batal_cair_kasbon(p_id uuid, p_alasan text) RETURNS void`.
- Pesan galat (dipakai UI apa adanya): peran → `42501` "Hanya tim finance yang boleh memproses kasbon"; "Kasbon tidak menunggu pencairan"; "Pencairan harus oleh orang lain dari yang menyetujui di HR"; "Pilih Rekening Petty Cash aktif"; "Bukti wajib diisi"; "Saldo Rekening Petty Cash tidak mencukupi"; "Alasan wajib diisi"; "Kasbon sudah dicicil/dipotong, pencairan tidak bisa dibatalkan".

Isi RPC mengikuti spec §5.2. Detail yang mengikat:
- `cairkan`: kunci kasbon `FOR UPDATE` → cek status → cek pencair ≠ `approved_by` → lokasi `FOR SHARE` (`grup='petty_cash'`, `scope='pusat'`, `is_active`) → `metode_cair := CASE kind WHEN 'bank' THEN 'transfer' ELSE 'tunai' END` → `cash_balance FOR UPDATE`, tolak bila `saldo < amount` → `INSERT cash_transaction(cash_location_id, amount, direction='out', source_type='kasbon', source_id=p_id, status='paid', occurred_at=now(), created_by=auth.uid(), proof_url=p_bukti, category='Kasbon', note='Pencairan kasbon ' || nama staf)` → `set_config('app.kasbon_cair','on',true)` → UPDATE `status='active', remaining=amount, dicairkan_*, metode_cair, bukti_cair, cash_transaction_id` → `set_config(…,'off',true)`.
- `tolak`: `status_hr='rejected'`, `rejection_note='[Ditolak Finance] '||btrim(alasan)`, `ditolak_finance_at/oleh`.
- `batal`: wajib `status='active' AND remaining=amount AND NOT EXISTS cash_advance_payments`; UPDATE `cash_transaction SET status='void', note=concat_ws(' ',note,'[Dibatalkan: '||alasan||']')` (trigger `cash_apply_balance` mengembalikan saldo); flag on; kasbon `status='menunggu_cair'`, kolom `dicairkan_*`, `metode_cair`, `bukti_cair`, `cash_transaction_id` = NULL.
- `approval_log`: CHECK `jenis` + `'kasbon'`, `keputusan` + `'batal_cair'`. Trigger `trg_approval_log_kasbon AFTER UPDATE OF status, status_hr ON cash_advances` (pola `trg_approval_log_petty_cash`, tahan galat): `menunggu_cair→active` = `setuju`; `ditolak_finance_at` baru terisi = `tolak` (alasan = teks setelah `[Ditolak Finance] `); `active→menunggu_cair` = `batal_cair`. `judul` = nama staf, `nominal` = amount. `ON CONFLICT (jenis,keputusan,sumber_id) DO UPDATE SET pelaku, waktu, waktu_urut, nominal, alasan`.
- Push crew: `CREATE OR REPLACE trg_fn_crew_kasbon_status_push` dengan teks setuju menjadi "…telah disetujui HR dan menunggu pencairan oleh finance." (sisa isi sama persis dengan versi live). Fungsi baru `trg_fn_crew_kasbon_finance_push` + trigger `trg_crew_kasbon_finance_push AFTER UPDATE OF status, status_hr`: cair → "💸 Kasbon Dicairkan" "Kasbon Anda sebesar Rp X sudah dicairkan (transfer/tunai)."; tolak finance → "❌ Kasbon Ditolak Finance" + alasan. Pakai `crew_alert_kirim_push(staff_id, judul, isi, 'crew_kasbon', 'crew_kasbon')`, tahan galat. Header migration mencatat utang replay: `trg_fn_crew_kasbon_status_push` juga didefinisikan di `20300254010600`.

- [ ] **Step 1: Tulis uji `t2_rpc.sql`** — siapkan kasbon `menunggu_cair` (UPDATE `status_hr` sebagai admin_hr; ambil id admin_hr, admin_finance aktif `7fa90a19-3951-426f-b088-30cc536cffad`, crew), simpan saldo awal Petty Cash Bank. Asersi:
  - T2a crew → `cairkan` `insufficient_privilege`.
  - T2b saldo kurang: buat kasbon nominal = saldo + 1 → "tidak mencukupi"; tak ada `cash_transaction` baru.
  - T2c admin_hr ubah `amount` jadi 750000, lalu admin_finance `cairkan` → `cash_transaction.amount=750000`, saldo turun 750000, kasbon `active`, `remaining=750000`, `metode_cair='transfer'`, baris `approval_log` jenis `kasbon` keputusan `setuju` dengan `pelaku_nama` terisi.
  - T2d `cairkan` kedua kali → "tidak menunggu pencairan".
  - T2e kasbon lain yang `approved_by` = admin_finance (setujui dengan klaim admin_finance… atau set `approved_by` langsung sebagai postgres) → `cairkan` oleh admin_finance → "orang lain".
  - T2f bukti `''` → "Bukti wajib"; lokasi Rekening Bahan Baku → "Rekening Petty Cash".
  - T2g `batal` → `cash_transaction.status='void'`, saldo kembali ke awal, kasbon `menunggu_cair`, kolom cair NULL, `approval_log` `batal_cair`.
  - T2h cair ulang dari Petty Cash Tunai (isi saldo dulu bila perlu via `record_top_up_saldo`) → `metode_cair='tunai'`; insert cicilan (sebagai admin_hr) lalu `batal` → "sudah dicicil".
  - T2i `tolak` tanpa alasan → "Alasan"; dengan alasan → `status_hr='rejected'`, `rejection_note LIKE '[Ditolak Finance]%'`, `approval_log` `tolak`.
  - T2j `finance_kasbon_menunggu()` sebagai admin_finance memuat kasbon menunggu dengan `staff_nama` tidak NULL; sebagai crew → `insufficient_privilege`.
- [ ] **Step 2: Jalankan uji sebelum migration** — Expected: gagal "function finance_cairkan_kasbon … does not exist".
- [ ] **Step 3: Tulis migration** sesuai Interfaces.
- [ ] **Step 4: Izin owner → terapkan → stempel → verifikasi** (`pg_proc` keempat fungsi `prosecdef=true`, `proacl` tanpa anon; CHECK `approval_log`; kedua trigger).
- [ ] **Step 5: Jalankan uji** — Expected: hanya `KONTROL: T2 …`; ulangi `t1_penjaga.sql` (tetap lolos). Kontrol negatif: balik satu asersi, harus gagal.
- [ ] **Step 6: Commit** `feat(kasbon): RPC pencairan finance + riwayat + push crew`

### Task 3: DB — ringkasan & daftar HR mengenal `menunggu_cair`

**Files:**
- Create: `supabase/migrations/20261113142000_kasbon_cair_ringkasan_hr.sql`
- Test: `supabase/verifikasi/kasbon_cair/t3_ringkasan.sql`

**Interfaces:**
- Produces: `hr_kasbon_daftar(p_status …)` menerima `'menunggu_cair'` (`status_hr='approved' AND status='menunggu_cair'`); `hr_perizinan_ringkasan` → objek `kasbon` mendapat `menunggu_cair` (count) dan `menunggu_cair_amount` (sum `amount`). Signature tidak berubah.

- [ ] **Step 1: Tulis uji** — sebagai admin_hr, buat 1 kasbon `menunggu_cair` (500000); `hr_kasbon_daftar('menunggu_cair')` memuatnya; `hr_kasbon_daftar('active')` tidak; `hr_perizinan_ringkasan()->'kasbon'->>'menunggu_cair'` naik 1 dan `menunggu_cair_amount` naik 500000 dari baseline.
- [ ] **Step 2: Jalankan** — Expected: gagal (filter belum dikenal → 0 baris).
- [ ] **Step 3: Tulis migration** — salin definisi **terakhir** dari `20300254001100` (`hr_kasbon_daftar`, termasuk pencarian `approval_note`) dan `20260930191000` (`hr_perizinan_ringkasan`), tambah cabang saja. Ambil `pg_get_functiondef` live dan bandingkan sebelum menulis. Catat utang replay 2030 di header.
- [ ] **Step 4: Izin owner → terapkan → stempel → verifikasi.**
- [ ] **Step 5: Jalankan uji** — Expected: `KONTROL: T3 …`.
- [ ] **Step 6: Commit** `feat(kasbon): ringkasan HR hitung menunggu pencairan`

### Task 4: Finance — model Hub & riwayat (fungsi murni)

**Files:**
- Modify: `apps/finance/src/lib/approval/hub.ts`, `apps/finance/src/lib/approval/riwayat.ts`, `apps/finance/src/lib/kas/mutasiRekening.ts`
- Create: `apps/finance/src/lib/approval/kasbon.ts`
- Test: `apps/finance/src/lib/approval/hub.test.ts`, `riwayat.test.ts`, `kasbon.test.ts`

**Interfaces:**
- Produces:
  - `type KasbonMenunggu` = baris `finance_kasbon_menunggu()` (camel tidak dipakai; kolom snake_case persis).
  - `HubJenis` + `'kasbon'`; `URUTAN_JENIS` menaruh `'kasbon'` setelah `'pengeluaran_petty_cash'`; `JENIS_LABEL.kasbon = 'Kasbon'`; varian `HubItem` `{ jenis: 'kasbon'; data: KasbonMenunggu }`.
  - `itemDariKasbon(k: KasbonMenunggu): HubItem` — `judul = staff_nama`, `keterangan = gabungKeterangan(outlet_nama, potong(reason), cicilan>1 ? '<n>x cicilan' : null)`, `nominal = amount`, `menungguSejak = approved_at ?? created_at`.
  - `bolehCairkan(k: Pick<KasbonMenunggu,'approved_by'>, userId: string | null): { boleh: boolean; alasan: string | null }` — `alasan = 'Anda menyetujui kasbon ini di HR, pencairan harus oleh orang lain'` bila sama.
  - `JenisRiwayat` + `'kasbon'` (label `'Kasbon'`), `KeputusanRiwayat` + `'batal_cair'` (label `'Pencairan dibatalkan'`); kasbon `setuju` dilabel `'Dicairkan'`.
  - `bolehBatalCair(k: { status: string; amount: number; remaining: number | null }): boolean` = `status==='active' && Number(remaining) === Number(amount)`.
  - `mutasiRekening`: `source_type` `'kasbon'` berlabel `'Kasbon'` (ikut pola `refund_dana` di semua `switch`).

- [ ] **Step 1: Tulis test gagal**
  - `itemDariKasbon` → `jenis:'kasbon'`, `key:'kasbon:<id>'`, `menungguSejak` = `approved_at`; tanpa `approved_at` → `created_at`.
  - `bolehCairkan({approved_by:'u1'},'u1')` → `{boleh:false, alasan:'Anda menyetujui kasbon ini di HR, pencairan harus oleh orang lain'}`; `('u2')` → `{boleh:true, alasan:null}`; `approved_by:null` → boleh.
  - `labelRiwayat({jenis:'kasbon',keputusan:'setuju'})` → `{jenis:'Kasbon', keputusan:'Dicairkan'}`; `batal_cair` → `'Pencairan dibatalkan'`.
  - `bolehBatalCair({status:'active',amount:500000,remaining:500000})` true; `remaining:300000` false; `status:'menunggu_cair'` false.
  - Label mutasi `'kasbon'` → `'Kasbon'`.
- [ ] **Step 2:** `cd apps/finance && yarn test src/lib/approval src/lib/kas` → FAIL.
- [ ] **Step 3: Implementasi** sesuai Interfaces.
- [ ] **Step 4:** test → PASS; `yarn type-check` → error hanya di konsumen `HubItem` yang belum menangani `'kasbon'` (diselesaikan Task 5).
- [ ] **Step 5: Commit** `feat(finance): model hub & riwayat kasbon`

### Task 5: Finance — hook, modal Cairkan, wiring Hub, batal di riwayat

**Files:**
- Create: `apps/finance/src/hooks/useKasbonPencairan.ts`, `apps/finance/src/components/approval/CairkanKasbonModal.tsx`
- Modify: `apps/finance/src/hooks/useHubApproval.ts`, `apps/finance/src/app/approval/HubApprovalView.tsx`, `apps/finance/src/app/approval/BarisRiwayat.tsx` (+ `RiwayatApprovalPanel.tsx` bila props perlu diteruskan)
- Test: `apps/finance/src/components/approval/CairkanKasbonModal.test.tsx`, `apps/finance/src/app/approval/BarisRiwayat.test.tsx`

**Interfaces:**
- Consumes: Task 2 RPC, Task 4 fungsi murni.
- Produces (`useKasbonPencairan.ts`):
  - `useKasbonMenunggu(enabled: boolean)` → React Query key `['kasbon_menunggu']`, `rpc('finance_kasbon_menunggu')`.
  - `useKasbonMenungguCount(enabled)` → `data?.length`.
  - `useCairkanKasbon()` mutation `{ id: string; cashLocationId: string; proofFile: File }` → unggah ke `finance-proofs` path Global Constraints → `rpc('finance_cairkan_kasbon', {p_id, p_cash_location_id, p_bukti: path})`; lempar `error` RPC apa adanya.
  - `useTolakKasbon()` `{ id, alasan }`; `useBatalCairKasbon()` `{ id, alasan }`.
  - Semua `onSuccess` invalidasi `['kasbon_menunggu']`, `['approval_log']` (key riwayat yang ada), `['cash_balance']`, `['cash_transaction']`, `['mutasi_rekening']`.
  - `useStatusKasbon(ids: string[])` → `select id,status,amount,remaining from cash_advances in ids` (finance boleh baca via `can_read_payroll`) untuk tombol batal.
- `CairkanKasbonModal` props: `{ isOpen; onClose; kasbon: KasbonMenunggu; userId: string | null; onCairkan: (cashLocationId: string, proofFile: File) => Promise<void> }`. Pilihan rekening = lokasi `grup='petty_cash'`, `scope='pusat'`, aktif, beserta saldo (pakai `useCashOverview` seperti `HubApprovalView`). Label bukti: bank → "Bukti transfer", tunai → "Foto tanda terima bertanda tangan karyawan". Nominal read-only. Tombol Cairkan nonaktif bila belum ada rekening/bukti, atau `!bolehCairkan(...).boleh` (alasan ditampilkan).

- [ ] **Step 1: Tulis test gagal**
  - Modal: tombol "Cairkan" disabled sebelum rekening & file dipilih; setelah keduanya → memanggil `onCairkan(lokasiId, file)`; `userId === approved_by` → tombol disabled + teks alasan; nominal tampil `Rp 500.000` tanpa input yang bisa diubah.
  - `BarisRiwayat`: baris `jenis:'kasbon', keputusan:'setuju'` dengan `bisaBatal:true` menampilkan tombol "Batalkan pencairan"; `bisaBatal:false` tidak.
- [ ] **Step 2:** `yarn test src/components/approval src/app/approval` → FAIL.
- [ ] **Step 3: Implementasi** hook + modal; tambah sumber `{ jenis:['kasbon'], items: data.map(itemDariKasbon) }` di `useHubApproval` dan `useKasbonMenungguCount` di `useHubApprovalCount` (ikut `adaGalat`); `HubApprovalView` menangani `case 'kasbon'` (Setujui → modal Cairkan; Tolak → `AlasanTolakModal` → `useTolakKasbon`); riwayat meneruskan `bisaBatal = bolehBatalCair(status)` untuk baris kasbon `setuju` terbaru dan tombolnya membuka `AlasanTolakModal` berjudul "Batalkan pencairan kasbon" → `useBatalCairKasbon`. Id user aktif dari hook auth/peran yang sudah ada di finance.
- [ ] **Step 4:** test → PASS; `yarn type-check` → 0 error; `yarn test` seluruh app → tidak ada kegagalan baru dibanding baseline sebelum Task 4.
- [ ] **Step 5: Commit** `feat(finance): cairkan & tolak kasbon di Hub Approval`

### Task 6: HR — status `menunggu_cair` di tabel, tab, dan mutasi

**Files:**
- Create: `apps/HR/src/lib/kasbon/statusKasbon.ts`
- Modify: `apps/HR/src/lib/types.ts:290`, `apps/HR/src/components/modules/CashAdvanceTable.tsx:35-55,111-142`, `apps/HR/src/components/modules/PerizinanModule.tsx:58-64` (+ ringkasan ±232, CSV ±442), `apps/HR/src/hooks/useCashAdvanceMutations.ts` (create/approve/addPayment), `apps/HR/src/hooks/useCashAdvances.ts` (tipe filter)
- Test: `apps/HR/src/lib/kasbon/statusKasbon.test.ts`

**Interfaces:**
- Produces:
  - `CashAdvanceStatus` = `'active' | 'paid_off' | 'pending' | 'rejected' | 'menunggu_cair'`.
  - `statusEfektifKasbon(row: { status: string | null; status_hr: string | null; ditolak_finance_at?: string | null }): CashAdvanceStatus` — urutan: rejected → pending → paid_off → menunggu_cair → active → pending.
  - `labelStatusKasbon(s: CashAdvanceStatus, ditolakFinance: boolean): string` — `menunggu_cair` → `'Menunggu pencairan'`; rejected + ditolakFinance → `'Ditolak (Finance)'`.
  - `bolehCatatCicilan(s: CashAdvanceStatus): boolean` = `s === 'active'`.

- [ ] **Step 1: Tulis test gagal** — `statusEfektifKasbon({status:'menunggu_cair',status_hr:'approved'})` → `'menunggu_cair'`; `{status:'active',status_hr:'approved'}` → `'active'`; `{status:'menunggu_cair',status_hr:'rejected',ditolak_finance_at:'x'}` → `'rejected'`; `labelStatusKasbon('rejected', true)` → `'Ditolak (Finance)'`; `bolehCatatCicilan('menunggu_cair')` → false.
- [ ] **Step 2:** `cd apps/HR && yarn test src/lib/kasbon` → FAIL.
- [ ] **Step 3: Implementasi** — `CashAdvanceTable` memakai `statusEfektifKasbon` (hapus `getEffectiveStatus`), `statusConfig.menunggu_cair` (amber), tombol "Bayar Cicilan" hanya bila `bolehCatatCicilan`, baris tolak finance menampilkan `rejection_note`, baris cair menampilkan "Dicairkan <tanggal> · <transfer/tunai>" atau "Dicairkan sebelum alur finance" bila `status==='active' && !dicairkan_at`. `PerizinanModule`: tab `{ key:'menunggu_cair', label:'Menunggu Pencairan' }` setelah "Menunggu Persetujuan", kartu ringkasan memakai `menunggu_cair`/`menunggu_cair_amount`, CSV memakai `labelStatusKasbon`. Mutasi `create` & `approve` mengirim `status:'menunggu_cair'` (bukan `'active'`), `create` tidak lagi mengirim `approved_at`; `addPayment` melempar `Error('Cicilan hanya untuk kasbon yang sudah dicairkan')` bila status kasbon bukan `active` (terima `status` di payload).
- [ ] **Step 4:** test → PASS; `yarn type-check` → 0 error.
- [ ] **Step 5: Commit** `feat(hr): status kasbon menunggu pencairan`

### Task 7: HR — tutup kasbon manual di slip payroll

**Files:**
- Create: `apps/HR/src/lib/kasbon/potonganSlip.ts`
- Modify: `apps/HR/src/hooks/usePayrollMutations.ts` (finalizeAll ±650–730, finalizeSlip ±765–835), `apps/HR/src/components/modules/PayrollSlipForm.tsx` (±238–300, input potongan kasbon)
- Test: `apps/HR/src/lib/kasbon/potonganSlip.test.ts`

**Interfaces:**
- Produces:
  - `potonganKasbonSlip(slip: { deduction_kasbon: number | null; deduction_note: string | null }): number` — ekstraksi yang sekarang inline (angka `deduction_kasbon`, atau regex `/kasbon[:\s]*rp?\s*([0-9.,]+)/i` di catatan).
  - `cekPotonganKasbonSlip(diminta: number, sisaAktif: number, namaStaf: string): string | null` — `null` bila `diminta <= sisaAktif`; selain itu `` `Potongan kasbon ${namaStaf} (${rupiah(diminta)}) melebihi sisa kasbon yang sudah dicairkan (${rupiah(sisaAktif)}). Kasbon di luar sistem harus diajukan dan dicairkan finance dulu.` ``.

- [ ] **Step 1: Tulis test gagal** — `potonganKasbonSlip({deduction_kasbon:0, deduction_note:'Kasbon: Rp 250.000'})` → 250000; `cekPotonganKasbonSlip(300000, 0, 'Budi')` → pesan yang memuat `'Budi'` dan `'Rp 300.000'` dan `'dicairkan finance'`; `cekPotonganKasbonSlip(200000, 200000, 'Budi')` → null.
- [ ] **Step 2:** `yarn test src/lib/kasbon` → FAIL.
- [ ] **Step 3: Implementasi** — finalize (kedua jalur): hitung `sisaAktif` dari kasbon `active`+`approved` staf; sebelum menulis apa pun untuk seluruh batch, kumpulkan `cekPotonganKasbonSlip` yang tidak null → lempar satu `Error` berisi semua pesan (finalisasi batal utuh). **Hapus** cabang `else` yang meng-insert kasbon `paid_off` (±699–711 & ±809–820). `PayrollSlipForm`: input potongan kasbon dibatasi `max = sisa kasbon aktif`, tampilkan pesan `cekPotonganKasbonSlip` saat melebihi dan blok simpan; tampilkan info "N kasbon menunggu pencairan (Rp X) — belum dipotong" dari kasbon `menunggu_cair` staf (ubah query ±242 dari `.eq('status','active')` menjadi `.in('status',['active','menunggu_cair'])`, hitung keduanya terpisah).
- [ ] **Step 4:** test → PASS; `yarn type-check`; `yarn test` seluruh HR → tak ada kegagalan baru.
- [ ] **Step 5: Commit** `fix(hr): potongan kasbon slip hanya dari kasbon yang sudah dicairkan`

### Task 8: admin-dashboard — samakan kasbon dengan HR + Hermes

**Files:**
- Modify: `apps/admin-dashboard/src/hooks/useCashAdvanceMutations.ts`, `apps/admin-dashboard/src/components/CashAdvanceTable.tsx:39-48,105-134`, `apps/admin-dashboard/src/lib/types.ts:298`, `apps/admin-dashboard/src/hooks/usePayrollMutations.ts:184-192`, `apps/admin-dashboard/src/lib/hermes/server/hrRinciSumber.ts:24-48`, `apps/admin-dashboard/src/lib/hermes/absensi/tipe.ts:11`
- Create: `apps/admin-dashboard/src/lib/kasbon/statusKasbon.ts` (salinan identik HR Task 6)
- Test: `apps/admin-dashboard/src/lib/kasbon/statusKasbon.test.ts`, `apps/admin-dashboard/src/lib/hermes/server/hrRinciSumber.test.ts` (buat bila belum ada)

**Interfaces:**
- Consumes: kontrak `statusEfektifKasbon`/`labelStatusKasbon`/`bolehCatatCicilan` dari Task 6 (salin isi persis, test sama).
- `statusKasbon` Hermes mengembalikan `'menunggu_cair'` untuk `approved + menunggu_cair` (tipe status Hermes ditambah nilai itu) — baris tidak lagi dibuang.

- [ ] **Step 1: Tulis test gagal** — salin test Task 6; `statusKasbon({status:'menunggu_cair',status_hr:'approved'})` → `'menunggu_cair'`.
- [ ] **Step 2:** `cd apps/admin-dashboard && yarn test src/lib/kasbon src/lib/hermes` → FAIL.
- [ ] **Step 3: Implementasi** — mutasi: `create` → `status_hr:'approved', status:'menunggu_cair'`; `approve` → `status_hr:'approved', status:'menunggu_cair'`; `reject` → `status_hr:'rejected'` (bukan `status:'rejected'`); `addPayment` tolak bila bukan `active`. Tabel memakai `statusEfektifKasbon` + aksi per status (approve/reject untuk `pending`, Bayar Cicilan hanya `active`). Payroll generate: tambah `.eq('status_hr','approved')`.
- [ ] **Step 4:** test → PASS; `yarn type-check` → 0 error.
- [ ] **Step 5: Commit** `fix(admin): kasbon ikut alur pencairan finance`

### Task 9: absensi & bot

**Files:**
- Modify: `apps/absensi/src/features/kasbon/api.ts:6,16`, `apps/absensi/src/features/kasbon/KasbonView.tsx:20-23,102-110,246`, `apps/bot/src/lib/server/telemetriNyata.ts:1637-1641,2666-2681`
- Create: `apps/absensi/src/features/kasbon/tahapKasbon.ts`
- Test: `apps/absensi/src/features/kasbon/tahapKasbon.test.ts`

**Interfaces:**
- Produces: `tahapKasbon(k: { status: string; status_hr: string; dicairkan_at: string | null; rejection_note: string | null }): { label: string; nada: 'menunggu' | 'proses' | 'sukses' | 'lunas' | 'tolak'; catatan: string | null }` — pending → `'Menunggu persetujuan HR'`; approved+menunggu_cair → `'Menunggu pencairan'`; approved+active → `'Dicairkan'` (catatan tanggal cair bila ada); paid_off → `'Lunas'`; rejected → `'Ditolak'` (catatan = `rejection_note` tanpa awalan `[Ditolak Finance] `).

- [ ] **Step 1: Tulis test gagal** untuk kelima tahap, termasuk pembersihan awalan.
- [ ] **Step 2:** `cd apps/absensi && yarn test src/features/kasbon` → FAIL.
- [ ] **Step 3: Implementasi** — `KasbonDisbursementStatus` + `'menunggu_cair'`; `select` di api menambah `dicairkan_at`; `KasbonView` memakai `tahapKasbon` untuk badge. Bot: `.in('status',['pending','active','menunggu_cair'])`; agregat menambah hitungan `menunggu_cair` (label "menunggu pencairan") tanpa mengubah definisi `aktif`.
- [ ] **Step 4:** test absensi → PASS; `yarn type-check` di absensi & bot → 0 error; `yarn test` bot → tak ada kegagalan baru.
- [ ] **Step 5: Commit** `feat(absensi,bot): tampilkan tahap pencairan kasbon`

### Task 10: Verifikasi akhir & catatan

**Files:**
- Create: `supabase/verifikasi/kasbon_cair/pemantau.sql`
- Modify: `CLAUDE.md` (entri Session 2026-11-13)

- [ ] **Step 1: Tulis `pemantau.sql`** (satu kueri per giliran): Q1 kasbon `active` dengan `dicairkan_at` NULL dan `created_at >= tanggal migration` (harus 0); Q2 kasbon `menunggu_cair` > 24 jam (antrean); Q3 `cash_transaction` `source_type='kasbon'` non-void yang kasbonnya bukan `active/paid_off` (harus 0); Q4 cicilan pada kasbon non-active sejak migration (harus 0).
- [ ] **Step 2: Jalankan pemantau** — Q1, Q3, Q4 = 0 baris.
- [ ] **Step 3: Ulangi t1, t2, t3** — semua `KONTROL`.
- [ ] **Step 4: type-check + test** finance, HR, admin-dashboard, absensi, bot — tak ada kegagalan baru dibanding baseline.
- [ ] **Step 5: Entri CLAUDE.md** — status, migration (applied/terstempel), keputusan owner 1a/2a/3a, gotcha: trigger penjaga memaksa `menunggu_cair` pada setiap persetujuan; tolak finance = `status_hr='rejected'` + `ditolak_finance_at`; utang replay `trg_fn_crew_kasbon_status_push` & `hr_kasbon_daftar` (2030); perlu merge untuk deploy otomatis HR/admin/finance/absensi/bot.
- [ ] **Step 6: Commit** `docs: catat kasbon dicairkan finance`
