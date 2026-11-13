# Wizard Pembukaan Outlet — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Satu jalur pembukaan outlet di admin-dashboard: wizard 4 langkah yang membuat outlet berstatus Persiapan, papan checklist yang membaca kemajuan dari data, serta tombol Go-Live dan Batalkan.

**Architecture:** Logika yang menentukan benar/salah ada di database: fungsi `status_persiapan_outlet` adalah satu-satunya sumber checklist, dan RPC `buat_outlet_persiapan` / `go_live_outlet` / `batalkan_pembukaan_outlet` (SECURITY DEFINER, cek role di dalam) menulis semuanya secara atomik. Server action admin-dashboard hanya: `requireRole`, memanggil RPC, lalu menyinkronkan DB Order Online. Sebelum itu, Tahap 0 memperbaiki dua hal yang membuat outlet baru diam-diam salah hitung, dan Task 5–6 memperbaiki visibilitas status `pending` di semua app.

**Tech Stack:** Supabase Postgres (plpgsql, RLS), Next.js app router + server actions, TypeScript, TanStack Query, Vitest, TailwindCSS + `@suka/design-system`.

**Spec:** `docs/superpowers/specs/2026-11-13-wizard-pembukaan-outlet-design.md`

## Global Constraints

- Status Persiapan = `outlets.status = 'pending'`. Trigger `trg_sync_outlet_status_active` sudah menyetel `is_active = false` untuk `pending` dan `true` untuk `active` — jangan menulis `is_active` sendiri.
- Jenis outlet hanya `internal` atau `mitra`; dikunci setelah Go-Live.
- Isi wizard, Go-Live, Batalkan, masa RAB, akun mitra: role **admin** dan **developer** saja (`requireRole(['admin'])` meloloskan developer). Owner hanya membaca papan.
- Konfirmasi Go-Live: teks ketikan cocok dengan nama outlet setelah `trim` dan tanpa beda huruf besar/kecil.
- Langkah **wajib**: `data_outlet`, `am`, `crew`, `stok_awal`, `opname_pertama`, `grand_opening`, dan khusus mitra `mitra`. Langkah **peringatan**: `leader`, `masa_rab` (mitra), `absensi`, `target_harian`. (Revisi owner 13 Nov: AM dan minimal 1 crew wajib; leader boleh kosong. Kas kecil tidak masuk checklist: pengajuan kas outlet baru tetap lewat alur top up petty cash biasa.)
- Masa RAB hanya untuk mitra. Kategori pengecualian bawaan persis: `['gas','pln','pdam','internet','wifi','utilitas','utilities','sewa','sewa_outlet']`.
- Bawaan mitra baru: `persentase_bagi_hasil = 100`, `management_fee = 3`, `is_profit_sharing_active = true` (13 dari 14 mitra hari ini).
- Go-Live: `status → 'active'`, `is_bom_enabled = true`, baris `stok_balance` saldo 0 untuk bahan aktif `peruntukan IN ('outlet','keduanya')` yang belum punya baris, `mitra_investments.tanggal_mulai = tanggal Go-Live`, Order Online `is_active = true`. `app_enabled` **tidak** disentuh.
- Batalkan: **jangan pernah mengandalkan CASCADE untuk data transaksi.** `DELETE outlets` meng-CASCADE `orders`, `ledger_stok`, `surat_jalan`, `opname`, `expenses`, dll. Hapus hanya bila semua tabel di daftar cek kosong.
- Laporan menyaring `status <> 'pending'` (**bukan** `status = 'active'`, karena laporan bulan lalu tetap butuh outlet yang sudah tutup).
- Tanpa notifikasi apa pun.
- Migration baru bertimestamp `20261113xxxxxx` (lint menolak >2 hari ke depan). Sebelum memilih timestamp, cek `supabase_migrations.schema_migrations` untuk `2026111%`; sesudah apply, verifikasi stempelnya dengan SELECT.
- Form `/pos-admin/outlets` tidak diubah selain satu baris keterangan.

## Review Focus

1. **Outlet Persiapan tertahan di langkah wajib** karena pemilih outlet di app lain menyembunyikannya (SJ distribusi, cakupan outlet stok). Diuji di Task 10 Step 3 (browser).
2. **Go-Live ditekan dua kali / dari dua tab** → harus gagal jelas pada panggilan kedua ("outlet sudah aktif"), bukan menulis ulang `tanggal_mulai`. Diuji di Task 4 (t2 kasus d).
3. **Batalkan pada outlet yang sudah punya satu surat jalan** → harus `inactive`, bukan terhapus beserta SJ-nya. Diuji di Task 4 (t3 kasus b).
4. **Mitra lama membuka outlet kedua** → `mitra_profiles.outlet_ids` bertambah satu, tidak tertimpa dan tidak dobel bila dipanggil ulang. Diuji di Task 4 (t2 kasus a2).
5. **Seed `stok_balance` saat Go-Live memicu puluhan alert "stok kritis"** ke bot Telegram/manager. Diuji di Task 4 (t2 kasus c).

---

### Task 1: Tahap 0a — Peta AM dashboard manager dari `am_outlet_assignments`

Dashboard manager (`apps/manager/src/app/page.tsx`, `getAMName`) membangun peta AM dari `staff_outlets`, lalu jatuh ke daftar nama outlet yang di-hardcode. Fungsi SQL bonus AM (`get_monthly_am_bonus`) **sudah** membaca `am_outlet_assignments` — jangan diubah.

**Prasyarat data (dicek 2026-11-13):** semua outlet aktif internal/mitra punya penugasan AM aktif **kecuali** `MITRA SUKMAJAYA` (hari ini hanya tertolong hardcode `SUKMAJAYA → Tri Rizky`), `SUKA SHAWARMA BNR`, `SS BACKUP`, `Tes outlet`. Sebelum merge, minta HR menambahkan penugasan AM untuk MITRA SUKMAJAYA di app HR `/staff` (AMOutletRotationModal). Task ini tidak menulis data.

**Files:**
- Create: `apps/manager/src/lib/petaAm.ts`, `apps/manager/src/lib/petaAm.test.ts`
- Modify: `apps/manager/src/app/page.tsx` (query `qStaffOutlets` ±baris 261, pembangun `amMap` ±baris 904, `getAMName` ±baris 64–109)

**Interfaces:**
- Produces: `petaAmAktif(baris: { outlet_id: string; effective_from: string; effective_to: string | null; outlet_staff: { name: string | null; role: string; status: string } | null }[], tanggal: string): Map<string, string>`

- [ ] **Step 1: Tulis test** `petaAm.test.ts`:
  - `'memakai penugasan yang berlaku pada tanggal'`: dua baris outlet sama (lama `effective_to='2026-10-31'`, baru `effective_from='2026-11-01'`), `tanggal='2026-11-13'` → map berisi nama AM baru.
  - `'mengabaikan staf nonaktif dan role selain area_manager'` → outlet tidak ada di map.
  - `'mengabaikan nama AM dummy'` → memakai `isIgnoredAMStaffName` yang sudah ada (pindahkan ke `petaAm.ts` dan ekspor).
- [ ] **Step 2:** `cd apps/manager && yarn vitest run src/lib/petaAm.test.ts` → FAIL (modul tidak ada).
- [ ] **Step 3: Implementasi** `petaAmAktif` + ganti query `qStaffOutlets` dengan `am_outlet_assignments` (`select('outlet_id, effective_from, effective_to, outlet_staff!am_outlet_assignments_staff_id_fkey(name, role, status)')` — sesuaikan nama FK dengan yang ada di DB), tetap lewat `applyOutletFilter`. Tanggal = hari ini WIB. Di `getAMName`, hapus seluruh blok `name.includes(...)` dan `name.startsWith('MITRA')`; urutan sisa: role AM sendiri → `amMap` → `region` → `'Lainnya'`.
- [ ] **Step 4:** test lulus; `yarn type-check` di `apps/manager` 0 error baru.
- [ ] **Step 5: Commit** `fix(manager): peta AM dari am_outlet_assignments, buang hardcode nama outlet`

### Task 2: Tahap 0b — Status mitra hanya dari `outlets.type`

Hari ini tiga penanda (type / punya `mitra_investments` / nama mengandung "mitra"). Data dicek 2026-11-13: **nol** outlet yang hasilnya berbeda antara aturan lama dan aturan type-saja, jadi angka tidak boleh bergeser.

**Files:**
- Modify: `apps/admin-dashboard/src/lib/outletOwnership.ts` (+ `.test.ts`), salinan identik `apps/finance/src/lib/outletOwnership.ts`, `apps/manager/src/lib/outletOwnership.ts`
- Modify: `apps/finance/src/components/OutletCombobox.tsx:25`, `apps/finance/src/app/api/eom-closing/kasir-live/route.ts:174`, `apps/admin-dashboard/src/components/profit/DownloadProfitDataModal.tsx:710`, `apps/stok/src/app/stok/laporan-penjualan/page.tsx:87` (pastikan query di file itu memilih kolom `type`)
- Create: `supabase/migrations/20261113100000_status_mitra_dari_type.sql`, `supabase/verifikasi/pembukaan_outlet/t0_status_mitra.sql`

**Interfaces:**
- Produces: `isMitraOutlet(outlet: { id: string; name?: string | null; type?: string | null }, mitraInvestmentIds?: Set<string>): boolean` — parameter kedua dipertahankan (diabaikan) agar pemanggil tidak berubah; `true` hanya bila `type === 'mitra'`.

- [ ] **Step 1: Ubah test** `outletOwnership.test.ts`: kasus `'nama mengandung mitra tapi type internal → bukan mitra'` dan `'punya baris investasi tapi type internal → bukan mitra'` mengharapkan `false`; `'type mitra → mitra'` tetap `true`.
- [ ] **Step 2:** `cd apps/admin-dashboard && yarn vitest run src/lib/outletOwnership.test.ts` → FAIL.
- [ ] **Step 3:** Ubah ketiga salinan `outletOwnership.ts` identik byte-per-byte (cek `diff` antar app = kosong), lalu 4 titik UI di atas jadi `type === 'mitra'`.
- [ ] **Step 4: Migration** `20261113100000`:
  - (a) `get_owner_dashboard_summary`: patch terarah lewat `pg_get_functiondef` + `regexp_replace`, mengikuti pola `20261111101413` — buang tepat baris `OR EXISTS (SELECT 1 FROM public.mitra_investments mi WHERE mi.outlet_id = o.id)` dan `OR COALESCE(o.name, '') ILIKE '%mitra%'`. Penjaga: tiap pola harus ketemu tepat 1×; sesudahnya `proconfig` masih memuat `plan_cache_mode=force_custom_plan` dan `search_path`. Idempoten.
  - (b) Trigger `trg_mitra_investments_wajib_outlet_mitra` (BEFORE INSERT OR UPDATE OF outlet_id ON `mitra_investments`): tolak bila `outlets.type <> 'mitra'` dengan pesan `'Data investasi hanya untuk outlet berjenis Mitra'`. Tanpa ini, investasi yang ditambahkan ke outlet internal lewat Kelola Mitra akan diam-diam tidak terhitung.
- [ ] **Step 5: Uji SQL** `t0_status_mitra.sql`: (i) ringkasan owner Agustus, September, Oktober, 1–12 November **identik** sebelum dan sesudah (klaim JWT Admin Dev dipasang **sebelum** pengukuran "sebelum" — tanpa itu COGS terbaca 0); (ii) INSERT `mitra_investments` ke outlet internal ditolak; (iii) kontrol negatif: blok asersi dengan angka sengaja salah benar-benar melempar.
- [ ] **Step 6:** Apply migration (izin owner), verifikasi stempel; jalankan t0.
- [ ] **Step 7:** type-check admin-dashboard, finance, manager, stok; test `outletOwnership` lulus.
- [ ] **Step 8: Commit** `fix: status mitra hanya dari outlets.type (TS + owner summary + penjaga investasi)`

### Task 3: DB fondasi — kolom, log, dan fungsi status checklist

**Files:**
- Create: `supabase/migrations/20261113110000_pembukaan_outlet_fondasi.sql`, `supabase/verifikasi/pembukaan_outlet/t1_status_persiapan.sql`

**Interfaces:**
- Produces (DB):
  - Kolom `outlets.tanggal_grand_opening date`, `outlets.go_live_at timestamptz`, `outlets.go_live_by uuid`.
  - Tabel `outlet_pembukaan_log(id uuid pk, outlet_id uuid NOT NULL /* sengaja tanpa FK: log bertahan setelah outlet dihapus */, nama_outlet text NOT NULL, aksi text CHECK (aksi IN ('dibuat','go_live','dinonaktifkan','dihapus')), alasan text, detail jsonb, pelaku uuid, pelaku_nama text, dibuat_at timestamptz DEFAULT now())`. RLS: SELECT untuk admin/owner/developer aktif; tanpa policy tulis; `REVOKE ALL FROM anon, authenticated` lalu `GRANT SELECT TO authenticated`.
  - `status_persiapan_outlet(p_outlet_id uuid) RETURNS jsonb`, SECURITY DEFINER, `SET search_path = public`. Penjaga: pemanggil admin/owner/developer aktif, selain itu `RAISE ... USING ERRCODE='42501'`. Bentuk keluaran:
    `{ outlet_id, nama, jenis, status, tanggal_grand_opening, siap_go_live: bool, langkah: [{ kunci, label, penanggung_jawab, wajib: bool, selesai: bool, info: text }] }`
    `siap_go_live` = `status = 'pending'` dan semua langkah wajib selesai.
  - Ulang definisi `outlet_ids_terhitung()` dengan filter `status <> 'pending'` (salin badan live via `pg_get_functiondef`, jangan dari berkas 2030) — menutup risiko replay `20300132000000`.

Aturan tiap `kunci` (urutan keluaran sama dengan urutan ini):

| kunci | label | penanggung jawab | wajib | selesai bila | info |
|---|---|---|---|---|---|
| `data_outlet` | Data outlet, peta, jam buka | Admin | ya | `name`, `address`, `lat`, `lng`, `open_hour`, `close_hour` tidak kosong | kolom yang masih kosong |
| `am` | AM ditautkan | Admin | ya | ada `am_outlet_assignments` berlaku hari ini ke staf `area_manager` aktif | nama AM |
| `crew` | Crew terdaftar | HR | ya | ≥1 `outlet_staff` `role='crew'` `status='active'` `outlet_id` = outlet | "N terdaftar, M enroll wajah" (`enrolled_at` atau `mobile_enrolled_at` terisi) |
| `stok_awal` | Stok awal dikirim & diverifikasi | Kitchen | ya | ada `surat_jalan` ke outlet ber-`status IN ('diterima_sebagian','diterima_lengkap','selesai')` | jumlah SJ per status |
| `opname_pertama` | Opname pertama | Leader | ya | ada `opname` outlet ber-`status = 'finalized'` | tanggal opname |
| `grand_opening` | Tanggal grand opening | Admin | ya | `outlets.tanggal_grand_opening` terisi | tanggal, atau "belum ditentukan" |
| `mitra` (mitra saja) | Data investasi + akun mitra | Admin | ya | ada `mitra_investments` outlet **dan** ada `mitra_profiles` dengan outlet di `outlet_ids` | — |
| `masa_rab` (mitra saja) | Masa RAB | Admin | tidak | ada `rab_outlet_otomatis` outlet | "s.d. <tanggal>" |
| `leader` | Leader ditautkan | Admin / HR | tidak | ada `staff_outlets` ke staf `role='leader'` `status='active'` | nama leader |
| `absensi` | Jadwal absensi & checklist harian | Leader | tidak | ada baris `outlet_attendance_config` | "masih bawaan pusat" bila belum |
| `target_harian` | Target harian | Owner | tidak | ada `daily_sales_targets` | nominal |

- [ ] **Step 1: Uji SQL dulu** `t1_status_persiapan.sql`, dalam `BEGIN … ROLLBACK`: buat outlet `pending` jenis mitra tanpa apa pun → `siap_go_live = false`, langkah `data_outlet` selesai hanya bila semua kolom diisi; tambahkan AM + 1 crew aktif + SJ `diterima_lengkap` + opname `finalized` + investasi + profil + tanggal grand opening (tanpa leader) → `siap_go_live = true`; tanggal grand opening dikosongkan → `false` dan langkah `leader` tetap `selesai=false`; crew dinonaktifkan → kembali `false`; outlet internal tidak punya kunci `mitra`/`masa_rab`; panggil sebagai staf `crew` (klaim JWT + `SET LOCAL ROLE authenticated`) → 42501; outlet `active` → `siap_go_live = false`. Kontrol negatif: satu asersi yang sengaja salah benar-benar melempar.
- [ ] **Step 2:** Jalankan t1 sebelum migration → gagal (fungsi tidak ada).
- [ ] **Step 3:** Tulis migration sesuai Interfaces.
- [ ] **Step 4:** Apply (izin owner), verifikasi stempel + katalog (`prosecdef`, `proconfig`), jalankan t1 → LULUS. Cek `outlet_ids_terhitung()` tidak memuat outlet `pending` dan hasilnya untuk data hari ini sama dengan sebelum migration.
- [ ] **Step 5: Commit** `feat(db): fondasi pembukaan outlet — log, status checklist`

### Task 4: DB — RPC buat, Go-Live, Batalkan, masa RAB, tautkan mitra

**Files:**
- Create: `supabase/migrations/20261113120000_pembukaan_outlet_rpc.sql`, `supabase/verifikasi/pembukaan_outlet/t2_buat_dan_go_live.sql`, `t3_batalkan.sql`

**Interfaces:**
- Consumes: `status_persiapan_outlet` (Task 3).
- Produces (DB, semua SECURITY DEFINER, `SET search_path = public`, penjaga role admin/developer aktif → 42501):
  - `buat_outlet_persiapan(p jsonb) RETURNS uuid`. Kunci `p`: `nama, jenis ('internal'|'mitra'), alamat, lat, lng, telepon, region, jam_buka 'HH:MM', jam_tutup, tanggal_grand_opening (date|null), am_staff_id, leader_staff_id (uuid|null, opsional), mitra {nilai_investasi, persentase_bagi_hasil, management_fee, mitra_user_id (uuid|null), nama_mitra}, rab {berlaku_sampai, kategori_kecuali text[]} | null`. Atomik: INSERT outlet `status='pending'`; `staff_outlets` untuk AM dan, bila diisi, leader (`ON CONFLICT DO NOTHING`); `am_outlet_assignments` (`effective_from` = hari ini WIB, `reason='Pembukaan outlet'`); bila mitra: `mitra_investments` (`tanggal_mulai = COALESCE(tanggal_grand_opening, hari ini)`, `is_profit_sharing_active = true`); bila `mitra_user_id` diisi panggil `tautkan_akun_mitra_outlet`; bila `rab` diisi panggil `simpan_masa_rab_outlet`. Tolak `rab` untuk jenis internal, AM kosong atau bukan `area_manager` aktif, leader yang diisi tapi bukan `leader` aktif. Log `'dibuat'`.
  - `tautkan_akun_mitra_outlet(p_outlet_id uuid, p_user_id uuid, p_nama_mitra text) RETURNS void`: upsert `mitra_profiles` per `user_id`; tambahkan outlet ke `outlet_ids` hanya bila belum ada (`array_append` + cek `= ANY`). Tolak bila outlet bukan mitra.
  - `simpan_masa_rab_outlet(p_outlet_id uuid, p_berlaku_sampai date, p_kategori_kecuali text[]) RETURNS void`: upsert `rab_outlet_otomatis` (`berlaku_mulai` = tanggal outlet dibuat). Tolak outlet non-mitra.
  - `simpan_tanggal_grand_opening(p_outlet_id uuid, p_tanggal date) RETURNS void`: hanya outlet `pending`; tolak tanggal sebelum hari ini WIB. Bila mitra, ikut perbarui `mitra_investments.tanggal_mulai` (nilai sementara; Go-Live yang menetapkan final).
  - `go_live_outlet(p_outlet_id uuid, p_konfirmasi_nama text, p_tanggal date) RETURNS jsonb` → `{ outlet_id, stok_balance_dibuat int }`. Kunci baris outlet `FOR UPDATE`. Tolak bila: bukan `pending` (`'Outlet sudah tidak berstatus Persiapan'`), nama tidak cocok (`lower(btrim())`), `status_persiapan_outlet(...)->>'siap_go_live'` bukan true (sebut langkah wajib yang kurang), `p_tanggal` di luar rentang hari ini ±7 hari WIB (grand opening yang mundur/maju dari rencana tetap boleh, asal Go-Live ditekan di sekitar hari pembukaan sebenarnya). `tanggal_grand_opening` ikut disetel ke `p_tanggal` agar tercatat tanggal pembukaan sebenarnya. Lalu: `status='active'`, `is_bom_enabled=true`, `go_live_at=now()`, `go_live_by=auth.uid()`; `mitra_investments.tanggal_mulai = p_tanggal`; seed `stok_balance(outlet, bahan, saldo 0)` untuk bahan aktif `peruntukan IN ('outlet','keduanya')` dengan `ON CONFLICT (outlet_id, bahan_baku_id) DO NOTHING`, dibungkus `set_config('app.ganti_satuan','on',true)` lalu dikembalikan ke `''` — semua trigger alert stok di `stok_balance` sudah menghormati GUC itu (beri komentar bahwa GUC dipakai di sini sebagai "tanpa efek samping", bukan karena ganti satuan). Log `'go_live'`.
  - `batalkan_pembukaan_outlet(p_outlet_id uuid, p_alasan text) RETURNS jsonb` → `{ aksi: 'dihapus'|'dinonaktifkan', sisa: [{ jenis, jumlah }] }`. Hanya untuk `pending`; alasan wajib (≥5 karakter). Hitung baris yang merujuk outlet di: `orders, ledger_stok, surat_jalan, opname, expenses, petty_cash_expenses, petty_cash_topups, cash_transaction, stok_waste_reports, permintaan_bahan, shifts, attendance, outlet_staff (outlet_id)`. Semua 0 → hapus `outlet_id` dari `mitra_profiles.outlet_ids`, `DELETE outlets` (CASCADE hanya menghapus baris konfigurasi buatan wizard), log `'dihapus'`. Ada yang >0 → `status='inactive'`, `inactive_reason = 'Pembukaan dibatalkan: ' || alasan`, log `'dinonaktifkan'`, `sisa` = tabel yang >0.

- [ ] **Step 1: Uji SQL** dalam `BEGIN … ROLLBACK`, bertindak sebagai Admin Dev via klaim JWT:
  - `t2` (a) buat outlet mitra lengkap → outlet `pending`, AM ada di `am_outlet_assignments` & `staff_outlets`, investasi ada, RAB ada dengan kategori bawaan; (a2) outlet mitra kedua dengan `mitra_user_id` yang sama → `outlet_ids` berisi keduanya, memanggil `tautkan_akun_mitra_outlet` lagi tidak menambah duplikat; (b) Go-Live saat SJ belum ada → ditolak dan pesan menyebut `stok_awal`; (c) lengkapi langkah wajib → Go-Live berhasil: `is_active=true`, `is_bom_enabled=true`, `tanggal_mulai = p_tanggal`, baris `stok_balance` = jumlah bahan aktif outlet/keduanya, dan **nol** baris baru di tabel antrean alert bot (`bot_manager_*` / tabel tujuan trigger telegram — cari nama tabelnya dari badan `bot_manager_alert_stok_kritis` dan `bot_telegram_alert_stok_kritis`); (d) Go-Live kedua kali → ditolak `'Outlet sudah tidak berstatus Persiapan'`, `tanggal_mulai` tidak berubah; (e) konfirmasi nama salah → ditolak; (f) role crew → 42501; (g) `rab` untuk outlet internal → ditolak.
  - `t3` (a) outlet tanpa data → `aksi='dihapus'`, baris outlet hilang, baris log tetap ada; (b) outlet dengan satu `surat_jalan` → `aksi='dinonaktifkan'`, SJ **masih ada**, `sisa` memuat `surat_jalan: 1`; (c) outlet `active` → ditolak.
  - Kontrol negatif di tiap berkas: satu asersi sengaja salah melempar.
- [ ] **Step 2:** Jalankan t2/t3 sebelum migration → gagal.
- [ ] **Step 3:** Tulis migration.
- [ ] **Step 4:** Apply (izin owner), verifikasi stempel dan `prosecdef`; t2 & t3 LULUS; tidak ada baris tertinggal (`SELECT count(*) FROM outlets WHERE name LIKE 'UJI WIZARD%'` = 0).
- [ ] **Step 5: Commit** `feat(db): RPC buat, go-live, batalkan pembukaan outlet`

### Task 5: Visibilitas — laporan menyembunyikan outlet Persiapan

Semua perubahan memakai `.neq('status', 'pending')` (atau filter klien `o.status !== 'pending'`), **bukan** `.eq('status','active')`.

**Files (Modify):**
- `apps/admin-dashboard/src/hooks/useOutlets.ts`: tanda tangan jadi `useOutlets(initialData?: Outlet[], opsi?: { termasukPersiapan?: boolean })`; bawaan menyaring pending; `queryKey: ['outlets', opsi?.termasukPersiapan ?? false]`. Pemanggil yang **harus** `termasukPersiapan: true`: `app/dashboard/outlets/OutletsView.tsx`, `app/dashboard/owner/targets/TargetsView.tsx` (atau sumber outlet halaman targets), komponen halaman pembukaan outlet (Task 8–9).
- `apps/admin-dashboard/src/app/dashboard/owner/page.tsx` (±baris 52, 80)
- `apps/admin-dashboard/src/lib/queries/monitoring.ts` (±baris 440) dan `apps/stok/src/lib/queries/monitoring.ts` (±baris 649): `fetchOutletsList(opsi?: { termasukPersiapan?: boolean })`; LiveMonitoringPage memakai bawaan (sembunyi); OpnameForm dan ThresholdPage memakai `termasukPersiapan: true`.
- `apps/finance/src/hooks/useOutlets.ts` (tambah kolom `status` di select, saring pending), `apps/finance/src/lib/eom/loadKasirData.ts:80`
- `apps/owner-dashboard/src/lib/outletNames.ts:23`
- `apps/HR/src/app/.../InventarisReportView.tsx` (penanda "belum lapor" melewati outlet pending) — HR `useOutlets` **tidak** diubah: HR adalah tempat crew outlet Persiapan didaftarkan.
- `apps/inventori/src/app/dashboard/reports/InventarisReportView.tsx:72`
- `apps/admin-dashboard/src/app/dashboard/pos-admin/outlets/OutletsView.tsx`: satu baris keterangan "Untuk outlet baru, pakai Wizard Pembukaan Outlet" dengan tautan `/dashboard/pembukaan-outlet/baru`. Form tidak diubah.

**Interfaces:**
- Produces: `useOutlets(initialData?, opsi?)` dan `fetchOutletsList(opsi?)` seperti di atas.

- [ ] **Step 1: Test** `apps/admin-dashboard/src/hooks/useOutlets.test.ts` (pola mock Supabase yang sudah ada di repo): bawaan memanggil `.neq('status','pending')`; `termasukPersiapan: true` tidak.
- [ ] **Step 2:** FAIL → implementasi → PASS.
- [ ] **Step 3:** Terapkan perubahan per berkas di daftar. Untuk tiap konsumen `useOutlets` admin (22 berkas), pastikan hanya `OutletsView`, `TargetsView`, dan halaman pembukaan yang memakai `termasukPersiapan: true`.
- [ ] **Step 4:** type-check admin-dashboard, finance, stok, HR, inventori, owner-dashboard.
- [ ] **Step 5: Commit** `fix: laporan & papan menyembunyikan outlet berstatus Persiapan`

### Task 6: Visibilitas — tempat kerja persiapan menampilkan outlet Persiapan

Tanpa ini dua langkah wajib mustahil diselesaikan.

**Files (Modify):**
- `apps/distribusi/src/hooks/useOutlets.ts:19`: `.in('status', ['active','pending'])`; label outlet pending diberi akhiran `' (Persiapan)'` di `SuratJalanForm.tsx`.
- `apps/stok/src/hooks/useOutletScope.tsx:53`: `.in('status', ['active','pending'])` agar leader outlet Persiapan bisa opname.
- `apps/admin-dashboard/src/app/dashboard/owner/kelola-mitra/page.tsx:29`: tetap semua status (sudah), pastikan dialog investasi tidak menyaring `is_active`.
- `apps/pos-kasir/lib/useMyOutlet.ts` / `GlobalBlockerMount.tsx`: bila `status === 'pending'`, pesan pemblokir berbunyi `'Outlet ini belum dibuka (status Persiapan). Kasir aktif setelah Go-Live.'` (perilaku memblokir tetap).

- [ ] **Step 1:** Ubah tiap berkas; tambah test kecil bila berkas sudah punya test di sebelahnya.
- [ ] **Step 2:** type-check distribusi, stok, admin-dashboard, pos-kasir. (Verifikasi browser ada di Task 10 Step 3.)
- [ ] **Step 3: Commit** `fix: outlet Persiapan muncul di form SJ dan opname`

### Task 7: Server action & logika murni wizard

**Files:**
- Create: `apps/admin-dashboard/src/lib/pembukaanOutlet/types.ts`, `validasi.ts`, `validasi.test.ts`, `konstanta.ts`
- Create: `apps/admin-dashboard/src/lib/outlets/orderOnlineSync.ts`, `orderOnlineSync.test.ts`
- Create: `apps/admin-dashboard/src/app/dashboard/pembukaan-outlet/actions.ts`
- Modify: `apps/admin-dashboard/src/app/dashboard/outlets/actions.ts` (pakai helper sinkron; perbaiki pemetaan `type` Order Online)

**Interfaces:**
- Produces:
  - `type JenisOutlet = 'internal' | 'mitra'`
  - `interface InputWizard { jenis: JenisOutlet; nama: string; alamat: string; lat: number | null; lng: number | null; telepon: string; region: string; jamBuka: string; jamTutup: string; tanggalGrandOpening: string | null; amStaffId: string; leaderStaffId: string | null; mitra: null | { nilaiInvestasi: number; persentaseBagiHasil: number; managementFee: number; akun: { mode: 'baru'; nama: string; username: string; password: string } | { mode: 'lama'; userId: string }; namaMitra: string }; rab: null | { berlakuSampai: string; kategoriKecuali: string[] } }`
  - `interface LangkahPersiapan { kunci: string; label: string; penanggungJawab: string; wajib: boolean; selesai: boolean; info: string | null }` dan `interface StatusPersiapan { outletId: string; nama: string; jenis: JenisOutlet; status: 'pending' | 'active' | 'inactive'; tanggalGrandOpening: string | null; siapGoLive: boolean; langkah: LangkahPersiapan[] }`
  - `KATEGORI_KECUALI_RAB_BAWAAN` (nilai persis di Global Constraints), `BAWAAN_MITRA = { persentaseBagiHasil: 100, managementFee: 3 }`
  - `validasiInputWizard(input: InputWizard): { ok: true } | { ok: false; galat: Partial<Record<keyof InputWizard | 'mitra.akun' | 'rab', string>> }`
  - `namaKonfirmasiCocok(ketik: string, nama: string): boolean`
  - `tipeOrderOnline(jenis: string): 'owned' | 'partner'` (`mitra → 'partner'`, lainnya `'owned'`) dan `sinkronOutletKeOrderOnline(o: { id; slug; name; address; lat; lng; type; is_active; open_hour; close_hour }): Promise<void>` (update bila ada, insert bila belum), `hapusOutletDiOrderOnline(id: string): Promise<void>`. Bila Order Online tidak dikonfigurasi: no-op dengan `console.warn` (perilaku sekarang).
  - Server actions (semua diawali `await requireRole(['admin'])`, lalu RPC lewat service client; balikan tidak pernah melempar ke UI):
    - `buatOutletBaru(input: InputWizard): Promise<{ ok: true; outletId: string; peringatan: string[] } | { ok: false; pesan: string }>` — validasi → bila akun mitra `baru`: buat dulu RPC outlet tanpa `mitra_user_id`, lalu `createStaffSync({ role: 'mitra', outlet_id, outlet_ids: [outletId], name, username, password })`, lalu `tautkan_akun_mitra_outlet`; gagal di langkah akun → outlet tetap Persiapan, `peringatan` berisi pesan, papan menampilkan langkah `mitra` belum selesai. Sinkron Order Online (`is_active: false`); gagal → `batalkan_pembukaan_outlet(outletId, 'Gagal sinkron Order Online')` dan `ok: false`.
    - `ambilStatusPersiapan(outletId: string): Promise<StatusPersiapan>`
    - `ambilDaftarPersiapan(): Promise<StatusPersiapan[]>` (semua outlet `pending`, urut `created_at`)
    - `goLiveOutlet(outletId: string, konfirmasiNama: string, tanggal: string): Promise<{ ok: true } | { ok: false; pesan: string }>` — RPC lalu sinkron Order Online `is_active: true`; gagal sinkron tidak membatalkan Go-Live, dikembalikan sebagai `ok: true` + toast peringatan di UI (tambahkan field `peringatan?: string`).
    - `batalkanPembukaan(outletId: string, alasan: string): Promise<{ ok: true; aksi: 'dihapus' | 'dinonaktifkan'; sisa: { jenis: string; jumlah: number }[] } | { ok: false; pesan: string }>` — sesudah RPC: `dihapus` → `hapusOutletDiOrderOnline`.
    - `simpanMasaRab(outletId: string, berlakuSampai: string, kategoriKecuali: string[])`, `simpanTanggalGrandOpening(outletId: string, tanggal: string)`, `buatAkunMitraSusulan(outletId: string, akun: InputWizard['mitra']['akun'], namaMitra: string)` — bentuk balikan sama `{ ok, pesan? }`.

- [ ] **Step 1: Test** `validasi.test.ts`: nama kosong; jam tutup ≤ jam buka; `jenis='internal'` dengan `mitra` atau `rab` terisi → galat; `jenis='mitra'` tanpa `mitra` → galat `mitra`; `rab.berlakuSampai` sebelum hari ini → galat; password akun baru <8 karakter → galat `mitra.akun`; `namaKonfirmasiCocok('  mitra bekasi ', 'MITRA BEKASI')` → true, `'MITRA BEKAS'` → false. `orderOnlineSync.test.ts`: `tipeOrderOnline('mitra') === 'partner'`, `('internal') === 'owned'`.
- [ ] **Step 2:** FAIL → implementasi lib → PASS.
- [ ] **Step 3:** Implementasi actions + ganti dua blok sinkron di `outlets/actions.ts` dengan helper (perilaku rollback `createOutlet` dipertahankan).
- [ ] **Step 4:** `yarn type-check` admin-dashboard; `yarn vitest run src/lib/pembukaanOutlet src/lib/outlets`.
- [ ] **Step 5: Commit** `feat(admin): server action & validasi wizard pembukaan outlet`

### Task 8: UI — daftar Persiapan dan wizard 4 langkah

**Files:**
- Create: `apps/admin-dashboard/src/app/dashboard/pembukaan-outlet/page.tsx` (daftar), `baru/page.tsx`, `components/pembukaan-outlet/WizardPembukaan.tsx`, `LangkahJenis.tsx`, `LangkahData.tsx`, `LangkahStaf.tsx`, `LangkahMitra.tsx`
- Modify: `apps/admin-dashboard/src/components/layout/navConfig.ts` (+ `navConfig.test.ts` snapshot), `RoleContext.tsx` bila allowlist perlu
- Modify: `apps/admin-dashboard/src/app/dashboard/outlets/OutletsView.tsx`: tombol "Tambah Outlet" → `/dashboard/pembukaan-outlet/baru`

**Interfaces:**
- Consumes: actions Task 7; `useOutlets` Task 5; `OutletForm` isian lokasi (reuse quick-fill Google Maps `outlets/lokasiActions.ts`).

- [ ] **Step 1:** Nav: entri `{ href: '/dashboard/pembukaan-outlet', label: 'Pembukaan Outlet', roles: ['ADMIN'] }` di grup yang sama dengan Manajemen Outlet; OWNER mendapat entri baca di grup yang memuat Kelola Mitra. Perbarui snapshot route per role di `navConfig.test.ts`; test lulus (termasuk cek `page.tsx` ada).
- [ ] **Step 2:** Daftar: tiap outlet Persiapan = baris nama, jenis, tanggal grand opening + hitung mundur ("H-5", "lewat 2 hari", atau "belum ditentukan"), "x/y wajib selesai", langkah wajib pertama yang belum selesai; tombol "Buka Outlet Baru" (hanya admin/developer). Kosong → teks "Tidak ada outlet yang sedang dipersiapkan."
- [ ] **Step 3:** Wizard: 3 langkah untuk internal, 4 untuk mitra; tombol Kembali/Lanjut; galat dari `validasiInputWizard` tampil di bawah isian; dropdown AM (wajib) = staf `role='area_manager'` aktif, Leader (opsional, bisa "Belum ada") = `role='leader'` aktif; teks bantu di langkah 3: "Minimal 1 crew wajib didaftarkan di HR sebelum Go-Live"; langkah mitra: nilai investasi, % bagi hasil (bawaan 100), fee (bawaan 3), akun (baru / pilih mitra yang ada dari `mitra_profiles`), masa RAB (centang, tanggal, kategori bawaan tercentang). Simpan → `buatOutletBaru` → arahkan ke papan; tampilkan `peringatan` bila ada.
- [ ] **Step 4:** type-check + build admin-dashboard (`next build --webpack` bila Turbopack menolak junction).
- [ ] **Step 5: Commit** `feat(admin): menu Pembukaan Outlet dan wizard 4 langkah`

### Task 9: UI — papan checklist, Go-Live, Batalkan

**Files:**
- Create: `apps/admin-dashboard/src/app/dashboard/pembukaan-outlet/[id]/page.tsx`, `components/pembukaan-outlet/PapanPersiapan.tsx`, `DialogGoLive.tsx`, `DialogBatalkan.tsx`, `EditorMasaRab.tsx`, `lib/pembukaanOutlet/tautanLangkah.ts` (+ test)

**Interfaces:**
- Produces: `tautanLangkah(kunci: string, outletId: string): { href: string; eksternal: boolean } | null` — peta: `data_outlet → /dashboard/outlets`, `am → app HR /staff`, `leader → app HR /staff`, `stok_awal → app distribusi (form SJ)`, `opname_pertama → app stok /stok/opname`, `mitra → /dashboard/owner/kelola-mitra`, `masa_rab → null` (editor di papan), `grand_opening → null` (isian di papan), `crew → app HR /staff`, `absensi → app absensi /dashboard/pengaturan`, `target_harian → /dashboard/owner/targets`. URL lintas app lewat helper `getCrossAppUrl` yang sudah ada.

- [ ] **Step 1: Test** `tautanLangkah.test.ts`: tiap kunci di tabel Task 3 punya entri; `masa_rab` → `null`; kunci tak dikenal → `null`.
- [ ] **Step 2:** FAIL → implementasi → PASS.
- [ ] **Step 3:** Papan: kepala (nama, jenis, tanggal grand opening + hitung mundur, x/y; bila kosong tampil spanduk kuning "Tanggal grand opening belum ditentukan" dengan isian tanggal langsung — `simpanTanggalGrandOpening`), tabel langkah persis kolom checklist spec (ikon selesai/menunggu, label, penanggung jawab, badge Wajib/Peringatan, info, tautan). Data dari `ambilStatusPersiapan`, refetch saat jendela kembali fokus. Langkah `mitra` belum selesai dan akun belum ada → tombol "Buat akun mitra" (`buatAkunMitraSusulan`). Tombol aksi hanya untuk admin/developer; owner melihat papan tanpa tombol.
- [ ] **Step 4:** DialogGoLive: tombol aktif hanya bila `siapGoLive`; dialog menampilkan langkah peringatan yang belum selesai, isian tanggal Go-Live (bawaan = tanggal grand opening bila hari ini masih dalam ±7 hari darinya, selain itu hari ini), isian ketik nama (tombol konfirmasi aktif saat `namaKonfirmasiCocok`). Sukses → toast + arahkan ke `/dashboard/outlets`.
- [ ] **Step 5:** DialogBatalkan: alasan wajib; hasil `dinonaktifkan` menampilkan daftar `sisa` sebagai hal yang perlu dibereskan manual (SJ → kembalikan stok ke gudang, crew → pindahkan di HR, biaya → cek Buku Kas).
- [ ] **Step 6:** type-check + build; commit `feat(admin): papan persiapan, Go-Live, batalkan pembukaan`

### Task 10: Form edit outlet + verifikasi menyeluruh

**Files:**
- Modify: `apps/admin-dashboard/src/components/OutletForm.tsx`, `lib/types.ts` (`OutletFormValues`), `app/dashboard/outlets/actions.ts` (`updateOutlet`)

- [ ] **Step 1:** Tambah isian `phone`, `region`, `bank_name`, `bank_account_number`, `bank_account_name`, `requires_korlap_review` ke `OutletFormValues`, `OutletForm`, dan `updateOutlet`. Isian `type` dikunci (read-only) bila outlet `active`/`inactive`.
- [ ] **Step 2:** type-check + test seluruh admin-dashboard: jumlah gagal sama dengan baseline sebelum branch (catat baseline di awal Task 1).
- [ ] **Step 3: Smoke test browser** (preview admin-dashboard, akun admin): buka wizard → buat outlet mitra "UJI WIZARD" → buat tanpa tanggal grand opening → papan menampilkan 7 wajib, 5 belum selesai (grand opening, crew, stok awal, opname, akun mitra bila belum dibuat) dan spanduk kuning; isi tanggal dari spanduk → langkah grand opening selesai. Selama Persiapan, outlet uji **muncul** di form SJ distribusi (berlabel "(Persiapan)"), crew outlet uji bisa membuka halaman Terima distribusi untuk SJ ke outletnya (urutan H-1) dan membuat opname di app stok (urutan hari H), tetapi **tidak** muncul di Rangkuman Penjualan, dropdown Buku Kas, dan papan monitoring stok. Lalu Batalkan dengan alasan → hasil `dihapus`, outlet hilang dari daftar dan dari Order Online.
- [ ] **Step 4:** Perbarui `CLAUDE.md` (entri sesi singkat: menu Pembukaan Outlet, RPC, aturan `status <> 'pending'` untuk laporan, larangan CASCADE) dan memory proyek.
- [ ] **Step 5: Commit** `feat(admin): form outlet lengkap + catatan sesi pembukaan outlet`

## Di luar lingkup (dicatat, tidak dikerjakan)

- Fallback outlet `limit(1)` tanpa urutan di `apps/pos-kasir` route `api/orders/walk-in` & `manual`.
- Bocor yang belum terkonfirmasi: manager `app/page.tsx:218`, finance `laporan/penjualan:51`, marcom `actions/outlets.ts:25`, sumber data SUKA Bot/Hermes.
- `"Tes outlet"` (type `internal`, aktif) ikut terhitung sebagai outlet operasional — temuan terpisah, tanyakan owner.
- Kiosk absensi menyembunyikan outlet Persiapan (crew tidak bisa latihan absen sebelum Go-Live) — sesuai keputusan "tersembunyi sampai Go-Live".
