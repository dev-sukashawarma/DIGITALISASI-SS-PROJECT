# Wizard Penutupan Outlet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membuat outlet bisa ditutup kapan saja dengan satu tombol. Tombol ini mencatat tanggal terakhir jualan + alasan dan mematikan kanal online. Sesudahnya, papan Penutupan menampilkan checklist pembersihan yang dibaca dari data sampai outlet ditandai "Penutupan selesai".

**Architecture:** Mencerminkan Wizard Pembukaan Outlet:
- Satu RPC `status_penutupan_outlet` menjadi satu-satunya sumber checklist.
- Semua tulisan lewat RPC SECURITY DEFINER yang memeriksa role dari `auth.uid()`, dipanggil server action dengan klien **sesi**.
- Trigger penjaga dua arah memastikan status aktif↔nonaktif outlet internal/mitra hanya berubah lewat RPC (GUC `app.penutupan_outlet`).
- Riwayat ditulis ke tabel `outlet_pembukaan_log` yang sudah ada.

**Tech Stack:** Supabase Postgres (plpgsql), Next.js 16 app router (admin-dashboard), TypeScript, Vitest, TailwindCSS.

**Spec:** `docs/superpowers/specs/2026-11-13-wizard-penutupan-outlet-design.md`. Baca juga `docs/SOP-PENUTUPAN-OUTLET.md`.

## Global Constraints

- Peran tulis (tutup, buka kembali, koreksi tanggal, nolkan stok, tandai selesai): `admin`, `developer`. Baca papan: `admin`, `owner`, `developer`. Centang manual: `admin`, `owner`, `developer`, `admin_finance`.
- RPC dipanggil dengan klien SESI (`createClient` dari `@/lib/supabase/server`), **bukan** service role. Service role membuat `auth.uid()` NULL dan RPC menolak dengan 42501.
- Alasan tutup / buka kembali / koreksi tanggal / nolkan stok: wajib, minimal **10 karakter** setelah trim.
- `nonaktif_at` = tanggal terakhir jualan pukul **23:59:59 Asia/Jakarta**.
- Tanggal terakhir jualan tidak boleh di masa depan (WIB) dan tidak boleh sebelum `outlets.created_at` (WIB).
- Outlet `status='pending'` (Persiapan) tidak bisa ditutup lewat wizard ini. Pesannya: "Outlet masih Persiapan — pakai Batalkan pembukaan".
- Hanya `type IN ('internal','mitra')` yang dijaga dan bisa ditutup. Tipe lain (office, gudang, test, marketplace, system) tidak tersentuh penjaga.
- Langkah `order`: hanya order non-final yang `created_at >= nonaktif_at - interval '30 days'`.
- Stok tidak pernah di-`UPDATE stok_balance` langsung. Selalu lewat `ledger_stok` `adjustment`, dengan `set_config('app.ganti_satuan','on',true)` untuk mematikan alert.
- Catatan ledger penolan stok diawali `'Penutupan outlet: '`.
- Backfill: stempel sekali `alasan_tutup = '(ditutup sebelum wizard)'` untuk 4 outlet:
  - `550e8400-e29b-41d4-a716-446655440008` (Sawangan Internal)
  - `550e8400-e29b-41d4-a716-446655440005` (Depok Sukmajaya)
  - `550e8400-e29b-41d4-a716-446655440017` (Mitra Ciseeng)
  - `550e8400-e29b-41d4-a716-446655440012` (Jatiasih)
- Migration bertimestamp `20261113200000`, `20261113201000`, `20261113202000`. Sebelum menulis, cek `ls supabase/migrations | cut -c1-14 | sort | uniq -d` dan `schema_migrations` hari itu. Juga `grep -rn "outlets_catat_nonaktif\|outlets_jaga" supabase/migrations/` untuk memastikan tidak ada migration 2030 yang menimpanya.
- Bahasa UI & pesan galat: Indonesia.

## Review Focus

1. **Penulis massal `is_active`:** `saveGlobalConfig` di app absensi menulis `is_active=true` ke semua outlet. Outlet tutup harus tetap nonaktif, dan `nonaktif_at`/`alasan_tutup` tidak boleh hilang. Diuji di Task 1 (t1 kasus d).
2. **Tutup dua kali / klik ganda:** panggilan kedua `tutup_outlet` harus ditolak "sudah ditutup" tanpa baris log kedua. Diuji di Task 3 (t3 kasus c).
3. **Saldo minus saat nolkan:** Ciseeng pernah punya baris saldo minus. Penolan harus berakhir di 0 untuk baris positif maupun negatif. Diuji di Task 3 (t3 kasus e).
4. **Tanggal di luar batas:** besok, atau sebelum outlet dibuat, harus ditolak dengan pesan jelas, baik di tutup maupun koreksi. Diuji di Task 3 (t3 kasus b) dan Task 4 (validasi).
5. **Buka kembali lalu tutup lagi:** buka kembali mengosongkan kolom penutupan tetapi log tetap ada, dan tutup ulang bekerja normal. Diuji di Task 3 (t3 kasus g).

---

### Task 1: Fondasi DB — kolom, tabel centang, log, penjaga dua arah, backfill

**Files:**
- Create: `supabase/migrations/20261113200000_penutupan_outlet_fondasi.sql`
- Create: `supabase/verifikasi/penutupan_outlet/t1_fondasi_penjaga.sql`

**Interfaces:**
- Produces:
  - Kolom `outlets.alasan_tutup text`, `ditutup_by uuid`, `penutupan_selesai_at timestamptz`, `penutupan_selesai_by uuid`.
  - Tabel `outlet_penutupan_centang (outlet_id uuid, kunci text, oleh uuid, oleh_nama text, catatan text, dibuat_at timestamptz default now(), PRIMARY KEY (outlet_id, kunci))`. RLS aktif, SELECT untuk admin/owner/developer/admin_finance aktif, tanpa hak tulis klien.
  - CHECK `outlet_pembukaan_log.aksi` diperluas dengan `'ditutup','penutupan_selesai','tanggal_tutup_dikoreksi','dibuka_kembali','stok_dinolkan','centang','centang_dibatalkan'`. Nama constraint lama diambil dari `pg_constraint`.
  - Fungsi `public.penutupan_outlet_cek_peran(p_lingkup text)` dengan `p_lingkup` ∈ `'tulis'|'baca'|'centang'`. Melempar 42501 bila peran tidak sesuai Global Constraints.

- [ ] **Step 1: Tulis uji `t1_fondasi_penjaga.sql`** (pola `supabase/verifikasi/pembukaan_outlet/t4_jaga_status_dan_jenis.sql`: `BEGIN` … `DO $$` … `ROLLBACK`, klaim JWT Admin Dev `6440a568-d9f3-45d3-b7d7-16e4b3166ab2`). Kasus:
  - (a) Outlet internal aktif uji, lalu `UPDATE outlets SET status='inactive', is_active=false` tanpa GUC → status tetap `active`, `nonaktif_at` tetap NULL.
  - (b) Sama, dengan `set_config('app.penutupan_outlet','on',true)` dan `nonaktif_at` diisi `'2026-11-01 23:59:59+07'` → status `inactive`, dan `nonaktif_at` = nilai yang diberikan, bukan `now()`.
  - (c) Outlet nonaktif uji + `UPDATE outlets SET is_active=true` tanpa GUC → tetap `inactive`, `nonaktif_at` & `alasan_tutup` utuh.
  - (d) Meniru absensi: `UPDATE outlets SET is_active = true WHERE type IN ('internal','mitra')` → keempat outlet backfill tetap `inactive`.
  - (e) Outlet `type='office'` tetap bisa dinonaktifkan tanpa GUC.
  - (f) Keempat outlet backfill punya `alasan_tutup = '(ditutup sebelum wizard)'` dan masing-masing tepat 1 baris log `ditutup`.
  - (g) `penutupan_outlet_cek_peran('tulis')` dengan klaim crew aktif → 42501.
  - Diakhiri `RAISE NOTICE 't1: LULUS'`.

- [ ] **Step 2: Jalankan uji sebelum migration** (konektor Supabase `execute_sql`, project `khpkoreaaucvyqfhynfq`). Expected: GAGAL (fungsi/kolom tidak ada).

- [ ] **Step 3: Tulis migration `20261113200000_penutupan_outlet_fondasi.sql`**
  - `ALTER TABLE outlets ADD COLUMN IF NOT EXISTS …` (4 kolom).
  - Tabel centang + RLS + `REVOKE ALL … FROM anon, authenticated; GRANT SELECT … TO authenticated`.
  - Perluas CHECK log.
  - `penutupan_outlet_cek_peran`: STABLE SECURITY DEFINER `SET search_path=public`, REVOKE dari PUBLIC/anon, GRANT ke authenticated.
  - Ubah `public.outlets_catat_nonaktif()`: bila `current_setting('app.penutupan_outlet', true) = 'on'` dan `NEW.nonaktif_at IS NOT NULL`, pertahankan `NEW.nonaktif_at`. Sisanya sama seperti `20261113190000`.
  - Fungsi `public.outlets_jaga_penutupan()` + trigger `trg_zz_outlets_jaga_penutupan BEFORE UPDATE ON outlets`. Untuk `OLD.type IN ('internal','mitra')`, `OLD.status IN ('active','inactive')`, dan GUC ≠ `'on'`: bila status berubah, kembalikan `NEW.status := OLD.status; NEW.is_active := OLD.is_active; NEW.nonaktif_at := OLD.nonaktif_at;` + `RAISE NOTICE`. Diam, tidak RAISE EXCEPTION. Komentar wajib menjelaskan `saveGlobalConfig` absensi. Trigger diberi nama `trg_zz_*` supaya berjalan sesudah `trg_sync_outlet_status_active` dan `trg_outlets_catat_nonaktif`.
  - Backfill: `UPDATE outlets SET alasan_tutup='(ditutup sebelum wizard)' WHERE id IN (4 id) AND alasan_tutup IS NULL` lalu INSERT log `ditutup` (pelaku NULL, `pelaku_nama='sistem (backfill)'`) dengan `WHERE NOT EXISTS` supaya idempoten.

- [ ] **Step 4: Apply migration** (`apply_migration` konektor 5f2e798c). Verifikasi ke katalog: trigger ada, CHECK berisi aksi baru, 4 outlet terstempel. Pastikan `schema_migrations` berisi `20261113200000`; bila konektor menstempel versi lain, rename berkas mengikuti stempel (gotcha Hermes 7 Okt).

- [ ] **Step 5: Jalankan t1** → `NOTICE t1: LULUS`. Lalu kontrol negatif: hapus sementara (di dalam transaksi uji) baris `NEW.nonaktif_at := OLD.nonaktif_at` lewat `CREATE OR REPLACE` di dalam BEGIN…ROLLBACK, dan pastikan kasus (c) GAGAL.

- [ ] **Step 6: Commit**
```bash
git add supabase/migrations/20261113200000_penutupan_outlet_fondasi.sql supabase/verifikasi/penutupan_outlet/t1_fondasi_penjaga.sql
git commit -m "feat(db): fondasi penutupan outlet — kolom, centang, penjaga status dua arah, backfill"
```

---

### Task 2: RPC `status_penutupan_outlet` — satu sumber checklist

**Files:**
- Create: `supabase/migrations/20261113201000_penutupan_outlet_status.sql`
- Create: `supabase/verifikasi/penutupan_outlet/t2_status.sql`

**Interfaces:**
- Consumes: kolom & tabel centang dari Task 1, `penutupan_outlet_cek_peran('baca')`.
- Produces: `public.status_penutupan_outlet(p_outlet_id uuid) RETURNS jsonb`:
  ```
  { outlet_id, nama, jenis, status, nonaktif_at (text 'YYYY-MM-DD', WIB),
    alasan_tutup, penutupan_selesai_at, siap_selesai boolean,
    langkah: [{ kunci, label, penanggung_jawab, wajib, selesai, info, manual boolean,
                dicentang_oleh text|null, dicentang_at text|null }] }
  ```
  `siap_selesai` = semua langkah `wajib` selesai.

Langkah dan aturan `selesai` (urutan = urutan tampil):

| kunci | wajib | manual | selesai bila |
|---|---|---|---|
| `crew` | ✓ | | 0 `outlet_staff` `status='active'` ber-`outlet_id` ini |
| `penugasan` | ✓ | | 0 `am_outlet_assignments` dengan `effective_to IS NULL OR effective_to > nonaktif_at::date`; 0 `staff_outlets` milik staff `role='leader'` aktif |
| `order` | ✓ | | 0 `orders` status ∉ (completed, cancelled) dan `created_at >= nonaktif_at - 30 hari` |
| `pesanan_nyasar` | ✗ | | 0 `orders` `created_at > nonaktif_at`. `info`: `"N pesanan: <sales_source> (YYYY-MM), …"` |
| `sj` | ✓ | | 0 `surat_jalan` ke outlet ini berstatus `draft`/`dikirim`; 0 `mutasi_antar_outlet` asal/tujuan outlet ini berstatus `menunggu_persetujuan`/`menunggu_pengiriman`/`dikirim` |
| `stok` | ✓ | | `coalesce(sum(abs(saldo)),0) = 0` di `stok_balance`. `info`: `"N bahan, Rp X"` (nilai dari `nilai_persediaan_spv`) |
| `kas_kecil` | ✓ | | 0 `petty_cash_expenses` `status='pending'` (`deleted_at IS NULL`); 0 `petty_cash_topups` berstatus `forwarded_to_finance`/`approved_by_finance` (sama dengan Hub Approval, `apps/finance/src/lib/approval/hub.ts`) |
| `kanal_online` | ✓ | ✓ | `app_enabled = false` **dan** ada centang `kanal_online` (dicentang otomatis oleh server action setelah sinkron Order Online berhasil) |
| `merchant_ojol` | ✓ | ✓ | ada centang |
| `mitra` (hanya `type='mitra'`) | ✓ | ✓ | ada centang |
| `aset` | ✗ | ✓ | ada centang |
| `biaya_rutin` | ✗ | ✓ | ada centang |

Penanggung jawab mengikuti spec §5 (`stok` → "Admin").

- [ ] **Step 1: Tulis `t2_status.sql`.** Outlet internal uji nonaktif (lewat GUC) dengan `nonaktif_at` 3 hari lalu. Kasus:
  - (a) awal → `siap_selesai=false`
  - (b) crew aktif → `crew` belum selesai; pindahkan → selesai
  - (c) order `preparing` 40 hari sebelum tutup → `order` tetap selesai; order `preparing` 2 hari sebelum → belum
  - (d) order completed sesudah `nonaktif_at` → `pesanan_nyasar.selesai=false`, `info` memuat `sales_source`, dan `siap_selesai` tidak terpengaruh
  - (e) saldo stok 5 → `stok` belum selesai, `info` diawali `"1 bahan"`
  - (f) semua beres + centang langkah manual wajib → `siap_selesai=true`; outlet mitra butuh centang `mitra` tambahan
  - (g) klaim crew → 42501
  - Diakhiri `NOTICE 't2: LULUS'`.
- [ ] **Step 2: Jalankan → GAGAL** (fungsi tidak ada).
- [ ] **Step 3: Tulis migration** (STABLE SECURITY DEFINER `SET search_path=public`, REVOKE PUBLIC/anon, GRANT authenticated).
- [ ] **Step 4: Apply + verifikasi stempel; jalankan t2 → LULUS.** Kontrol negatif: ubah sementara jendela 30 hari jadi 60 hari di dalam BEGIN…ROLLBACK → kasus (c) GAGAL.
- [ ] **Step 5: Commit**
```bash
git add supabase/migrations/20261113201000_penutupan_outlet_status.sql supabase/verifikasi/penutupan_outlet/t2_status.sql
git commit -m "feat(db): status_penutupan_outlet — checklist penutupan dari data"
```

---

### Task 3: RPC tulis — tutup, buka kembali, koreksi tanggal, nolkan stok, centang, tandai selesai

**Files:**
- Create: `supabase/migrations/20261113202000_penutupan_outlet_rpc.sql`
- Create: `supabase/verifikasi/penutupan_outlet/t3_rpc.sql`

**Interfaces:**
- Consumes: Task 1 & 2; `public._pembukaan_outlet_log(uuid, text, text, text, jsonb)` (sudah ada, internal).
- Produces (semua SECURITY DEFINER, `SET search_path=public`, REVOKE PUBLIC/anon, GRANT authenticated, melempar pesan Indonesia):
  - `tutup_outlet(p_outlet_id uuid, p_tanggal_terakhir date, p_alasan text) RETURNS void` — peran `tulis`. Menolak bila outlet bukan internal/mitra, `status='pending'`, sudah `inactive`, alasan < 10, atau tanggal di luar batas. Dalam satu transaksi, dengan GUC `app.penutupan_outlet='on'`:
    - `status='inactive', is_active=false, nonaktif_at=(p_tanggal_terakhir + time '23:59:59') AT TIME ZONE 'Asia/Jakarta', alasan_tutup, ditutup_by=auth.uid(), app_enabled=false, penutupan_selesai_at=NULL`
    - `UPDATE outlet_promos SET is_active=false WHERE outlet_id=…`
    - `UPDATE rab_outlet_otomatis SET berlaku_sampai = least(berlaku_sampai, p_tanggal_terakhir)`
    - log `ditutup` dengan detail `{tanggal_terakhir, jumlah_promo_dimatikan}`
  - `buka_kembali_outlet(p_outlet_id uuid, p_alasan text) RETURNS void` — peran `tulis`; hanya outlet internal/mitra `inactive`. Dengan GUC: `status='active', is_active=true, alasan_tutup=NULL, ditutup_by=NULL, penutupan_selesai_at=NULL, penutupan_selesai_by=NULL`. `nonaktif_at` dikosongkan oleh trigger lama. `app_enabled` & promo **tidak** dinyalakan. Centang outlet dihapus. Log `dibuka_kembali`.
  - `koreksi_tanggal_tutup(p_outlet_id uuid, p_tanggal date, p_alasan text) RETURNS void` — peran `tulis`; outlet harus `inactive`. Batas tanggal sama. Dengan GUC, set `nonaktif_at`. Log `tanggal_tutup_dikoreksi` dengan detail `{dari, ke}`.
  - `nolkan_sisa_stok_outlet(p_outlet_id uuid, p_alasan text) RETURNS jsonb` — peran `tulis`; outlet harus `inactive` dan `alasan_tutup IS NOT NULL`. `set_config('app.ganti_satuan','on',true)`. INSERT `ledger_stok(outlet_id, bahan_baku_id, tipe='adjustment', qty=-saldo, catatan='Penutupan outlet: ' || p_alasan, created_by=auth.uid())` untuk setiap `stok_balance.saldo <> 0`. Asersi `sum(abs(saldo))=0` sesudahnya. Mengembalikan `{jumlah_bahan, nilai}` (nilai dari `nilai_persediaan_spv` sebelum insert). Log `stok_dinolkan`. Tidak ada saldo → galat "Tidak ada sisa stok".
  - `centang_langkah_penutupan(p_outlet_id uuid, p_kunci text, p_catatan text, p_batal boolean DEFAULT false) RETURNS void` — peran `centang`; `p_kunci` ∈ (`kanal_online`,`merchant_ojol`,`mitra`,`aset`,`biaya_rutin`). Upsert/hapus baris centang, log `centang`/`centang_dibatalkan`.
  - `tandai_penutupan_selesai(p_outlet_id uuid) RETURNS void` — peran `tulis`; ditolak bila `status_penutupan_outlet(...)->>'siap_selesai'` false (pesan menyebut langkah yang belum). Set `penutupan_selesai_at=now(), penutupan_selesai_by=auth.uid()`; log `penutupan_selesai`.

- [ ] **Step 1: Tulis `t3_rpc.sql`.** Kasus:
  - (a) tutup outlet uji internal aktif → inactive, `nonaktif_at` = tanggal 23:59:59 WIB, `app_enabled=false`, promo outlet mati, 1 log `ditutup`
  - (b) tanggal besok → galat; tanggal sebelum `created_at` → galat
  - (c) tutup kedua kali → galat "sudah ditutup", log `ditutup` tetap 1
  - (d) tutup outlet `pending` → galat menyebut "Batalkan pembukaan"
  - (e) stok uji: satu baris +5, satu baris −3 (lewat ledger adjustment) → `nolkan_sisa_stok_outlet` → saldo semua 0, 2 baris ledger berawalan `'Penutupan outlet: '`, hasil `jumlah_bahan=2`; panggil lagi → galat "Tidak ada sisa stok"
  - (f) `tandai_penutupan_selesai` saat belum siap → galat; sesudah semua beres + centang → `penutupan_selesai_at` terisi
  - (g) `buka_kembali_outlet` → active, kolom penutupan NULL, centang terhapus, log lama tetap; tutup lagi → berhasil
  - (h) klaim admin_finance: `centang_langkah_penutupan` boleh, `tutup_outlet` → 42501
  - Diakhiri `NOTICE 't3: LULUS'`.
- [ ] **Step 2: Jalankan → GAGAL.**
- [ ] **Step 3: Tulis migration.**
- [ ] **Step 4: Apply + verifikasi stempel; jalankan t1, t2, t3 → LULUS.** Kontrol negatif: hapus sementara cek "sudah inactive" di dalam BEGIN…ROLLBACK → kasus (c) GAGAL.
- [ ] **Step 5: Commit**
```bash
git add supabase/migrations/20261113202000_penutupan_outlet_rpc.sql supabase/verifikasi/penutupan_outlet/t3_rpc.sql
git commit -m "feat(db): RPC penutupan outlet — tutup, buka kembali, koreksi tanggal, nolkan stok, centang, selesai"
```

---

### Task 4: Lib TS — tipe, pemetaan, validasi, tautan langkah

**Files:**
- Create: `apps/admin-dashboard/src/lib/penutupanOutlet/types.ts`, `petakan.ts`, `validasi.ts`, `tautanLangkah.ts`
- Test: `apps/admin-dashboard/src/lib/penutupanOutlet/petakan.test.ts`, `validasi.test.ts`, `tautanLangkah.test.ts`

**Interfaces:**
- Consumes: bentuk JSON `status_penutupan_outlet` (Task 2).
- Produces:
  - `types.ts`: `LangkahPenutupan { kunci; label; penanggungJawab; wajib; selesai; info: string|null; manual: boolean; dicentangOleh: string|null; dicentangAt: string|null }`, `StatusPenutupan { outletId; nama; jenis: 'internal'|'mitra'; status: 'active'|'inactive'; nonaktifAt: string|null; alasanTutup: string|null; penutupanSelesaiAt: string|null; siapSelesai: boolean; langkah: LangkahPenutupan[] }`, `KunciManual = 'kanal_online'|'merchant_ojol'|'mitra'|'aset'|'biaya_rutin'`. `HasilAksi` di-reuse dari `@/lib/pembukaanOutlet/types`.
  - `petakan.ts`: `petakanStatusPenutupan(raw: Record<string, unknown>): StatusPenutupan`; `ringkasPenutupan(langkah): { selesai: number; total: number; tertahan: string | null }`. Hanya langkah wajib; `tertahan` = label wajib pertama yang belum selesai.
  - `validasi.ts`: `validasiTutup(input: { tanggalTerakhir: string; alasan: string; konfirmasiNama: string }, ctx: { namaOutlet: string; hariIni: string; tanggalDibuat: string }): string | null` (pesan galat atau null); `validasiAlasan(alasan: string): string | null` (≥10 karakter setelah trim).
  - `tautanLangkah.ts`: `tautanLangkahPenutupan(kunci: string): { href: string; eksternal: boolean } | null`. Pola & `urlApp` sama dengan `@/lib/pembukaanOutlet/tautanLangkah.ts`. Peta: `crew`/`penugasan` → hr `/staff`; `sj` → distribusi `/distribusi/surat-jalan`; `order` → `/dashboard/pos-admin/orders`, atau halaman order yang ada (cek dengan `ls app/dashboard`); `kas_kecil` → finance `/approval` (tambahkan app `finance` ke `ENV_APP` dengan `NEXT_PUBLIC_APP_URL_FINANCE`); `kanal_online` → `/dashboard/app-retail/outlet`; `mitra` → `/dashboard/owner/kelola-mitra`; `stok`/`merchant_ojol`/`aset`/`biaya_rutin`/`pesanan_nyasar` → `null`.

- [ ] **Step 1: Tulis test gagal.**
  - `petakan.test.ts`: snake_case → camelCase termasuk `manual` & `dicentang_oleh`; `ringkasPenutupan` mengabaikan langkah non-wajib (`pesanan_nyasar` belum selesai tetap `tertahan=null` bila wajib beres).
  - `validasi.test.ts`:
    - `validasiTutup` menolak tanggal > `hariIni` ("tidak boleh di masa depan") dan < `tanggalDibuat`
    - menolak alasan `'   pendek  '`
    - konfirmasi nama dibandingkan setelah `trim()` + `toUpperCase()`: `'  sawangan '` lolos untuk outlet `'SAWANGAN'`, sedangkan `'SAWANGAN X'` ditolak
    - lolos untuk input sah
  - `tautanLangkah.test.ts`: `kas_kecil` eksternal ke finance, `stok` null, kunci tak dikenal null.
- [ ] **Step 2: Jalankan** `cd apps/admin-dashboard && yarn vitest run src/lib/penutupanOutlet` → FAIL.
- [ ] **Step 3: Implementasi keempat berkas.**
- [ ] **Step 4: Jalankan lagi → PASS.**
- [ ] **Step 5: Commit**
```bash
git add apps/admin-dashboard/src/lib/penutupanOutlet
git commit -m "feat(admin): lib penutupan outlet — tipe, pemetaan, validasi, tautan langkah"
```

---

### Task 5: Server actions penutupan

**Files:**
- Create: `apps/admin-dashboard/src/app/dashboard/penutupan-outlet/actions.ts`

**Interfaces:**
- Consumes: RPC Task 3; lib Task 4; `sinkronOutletKeOrderOnline` (`@/lib/outlets/orderOnlineSync`); `requireRole` (`@/lib/authz`); `createClient` (`@/lib/supabase/server`).
- Produces (`'use server'`; jangan me-re-export tipe dari berkas ini, gotcha Session 2026-10-07):
  - `ambilStatusPenutupan(outletId: string): Promise<StatusPenutupan>` — peran baca `['admin','owner']`.
  - `ambilDaftarPenutupan(): Promise<Array<{ outletId; nama; jenis; nonaktifAt; ringkas: ReturnType<typeof ringkasPenutupan> }>>` — outlet `alasan_tutup IS NOT NULL AND penutupan_selesai_at IS NULL`, urut `nonaktif_at desc`; panggil `ambilStatusPenutupan` per outlet.
  - `tutupOutlet(input: { outletId: string; tanggalTerakhir: string; alasan: string }): Promise<HasilAksi>` — peran tulis `['admin']`. Memanggil RPC, lalu sinkron Order Online (`is_active=false`, kolom dibaca ulang dari DB seperti `sinkronDariDb` di pembukaan). Bila sinkron berhasil: `centang_langkah_penutupan(…, 'kanal_online', 'Otomatis: aplikasi & Order Online dimatikan saat tutup')`. Bila sinkron gagal: `{ ok: true, peringatan: 'Order Online gagal dimatikan — cek manual lalu centang' }`.
  - `bukaKembaliOutlet(outletId: string, alasan: string)`, `koreksiTanggalTutup(outletId: string, tanggal: string, alasan: string)`, `nolkanSisaStok(outletId: string, alasan: string): Promise<HasilAksi<{ jumlahBahan: number; nilai: number }>>`, `centangLangkah(outletId: string, kunci: KunciManual, catatan: string, batal?: boolean)`, `tandaiPenutupanSelesai(outletId: string)`. Semuanya `HasilAksi`. Galat RPC diteruskan sebagai `pesan`, pola `pesanGalat` di `pembukaan-outlet/actions.ts`. `bukaKembaliOutlet` juga menyinkronkan Order Online (`is_active` mengikuti DB).
  - Setiap aksi tulis memanggil `revalidatePath('/dashboard/penutupan-outlet')`, `revalidatePath('/dashboard/penutupan-outlet/' + id)`, `revalidatePath('/dashboard/outlets')`.

- [ ] **Step 1: Implementasi.** Peran: `centangLangkah` → `requireRole(['admin','owner','admin_finance'])`; sisanya sesuai di atas.
- [ ] **Step 2: Type-check** `cd apps/admin-dashboard && yarn type-check` → 0 error baru (bandingkan dengan baseline yang dicatat sebelum mulai).
- [ ] **Step 3: Commit**
```bash
git add apps/admin-dashboard/src/app/dashboard/penutupan-outlet/actions.ts
git commit -m "feat(admin): server actions penutupan outlet"
```

---

### Task 6: UI — daftar, papan, dialog tutup, tab Penutupan

**Files:**
- Create: `apps/admin-dashboard/src/app/dashboard/penutupan-outlet/page.tsx`, `[id]/page.tsx`
- Create: `apps/admin-dashboard/src/components/penutupan-outlet/PapanPenutupan.tsx`, `DialogTutupOutlet.tsx`, `DialogAlasan.tsx`
- Modify: `apps/admin-dashboard/src/components/outlet/OutletTabs.tsx` (tab `'penutupan'`, href `/dashboard/penutupan-outlet`, prop `jumlahPenutupan?: number`)
- Modify: halaman yang merender `OutletTabs` (`dashboard/outlets`, `dashboard/pembukaan-outlet`) supaya mengirim `jumlahPenutupan`
- Modify: `apps/admin-dashboard/src/components/layout/navConfig.ts` → `isItemActive` ikut menyalakan menu Outlet di path `/dashboard/penutupan-outlet`. Owner: tambah entri "Penutupan Outlet" di grup yang sama dengan "Pembukaan Outlet". ⚠️ Berkas nav sedang diubah sesi lain (uncommitted saat plan ditulis); rebase/merge dulu dan jaga `navConfig.test.ts` tetap hijau.

**Interfaces:**
- Consumes: actions Task 5; lib Task 4.
- Produces:
  - `DialogTutupOutlet({ outlet: { id; name; createdAt: string }, onClose, onSelesai? })`. Field: tanggal terakhir jualan (default hari ini WIB, `max` = hari ini), alasan, ketik nama. Tombol "Tutup Outlet" baru aktif bila `validasiTutup` null. Teks penjelas: aplikasi pelanggan, Order Online, dan promo outlet akan dimatikan; crew, stok, dan pesanan dibereskan di papan Penutupan. Setelah sukses → `router.push('/dashboard/penutupan-outlet/' + id)`.
  - `DialogAlasan({ judul, deskripsi, labelTombol, onKirim(alasan) })` — dipakai buka kembali, koreksi tanggal (plus input tanggal), dan nolkan stok. Nolkan stok menampilkan "N bahan, Rp X" dari `info` langkah `stok` sebelum dikonfirmasi.
  - `PapanPenutupan({ status, bolehTulis, bolehCentang })` — tata letak meniru `PapanPersiapan`:
    - kepala: nama, jenis, tanggal tutup, alasan
    - daftar langkah dengan badge Wajib/Peringatan, PJ, info, tautan (`tautanLangkahPenutupan`)
    - tombol "Nolkan sisa stok" pada langkah `stok` bila belum selesai & `bolehTulis`
    - checkbox untuk langkah `manual` (bila `bolehCentang`) beserta siapa/kapan dicentang
    - tombol "Tandai Penutupan Selesai" (aktif hanya bila `siapSelesai`), "Koreksi tanggal tutup", dan "Buka kembali outlet" (bolehTulis)
  - Daftar `/dashboard/penutupan-outlet`: kartu per outlet + `ringkasPenutupan` ("4/8 langkah wajib, tertahan: …"). `requireRole(['admin','owner'])`. Judul & tab mengikuti pola `pembukaan-outlet/page.tsx` (admin: judul "Outlet" + `OutletTabs aktif="penutupan"`; owner: judul "Penutupan Outlet" tanpa tab).

- [ ] **Step 1: Implementasi komponen & halaman.**
- [ ] **Step 2: Test unit tab** — `OutletTabs` merender 3 tautan dengan href benar (tambahkan ke test komponen yang ada bila ada; kalau tidak, buat `components/outlet/OutletTabs.test.tsx`).
- [ ] **Step 3: `yarn type-check` & `yarn vitest run`** → 0 error baru, suite tetap pada baseline.
- [ ] **Step 4: Commit**
```bash
git add apps/admin-dashboard/src/app/dashboard/penutupan-outlet apps/admin-dashboard/src/components/penutupan-outlet apps/admin-dashboard/src/components/outlet apps/admin-dashboard/src/components/layout/navConfig.ts apps/admin-dashboard/src/app/dashboard/outlets apps/admin-dashboard/src/app/dashboard/pembukaan-outlet/page.tsx
git commit -m "feat(admin): papan & dialog Penutupan Outlet + tab Penutupan"
```

---

### Task 7: Alihkan jalur nonaktif/aktifkan lama ke wizard

**Files:**
- Modify: `apps/admin-dashboard/src/app/dashboard/outlets/OutletsView.tsx` (`handleToggleActive` sekitar baris 194)
- Modify: `apps/admin-dashboard/src/components/OutletTable.tsx` (tombol Nonaktif/Aktifkan sekitar baris 309 & 497; tombol hapus 323 & 512)
- Modify: `apps/admin-dashboard/src/lib/outlets/aturanEdit.ts` + test-nya
- Modify: `apps/admin-dashboard/src/app/dashboard/outlets/actions.ts` (`softDeleteOutlet`, `updateOutlet`)
- Modify: `apps/admin-dashboard/src/app/dashboard/pos-admin/outlets/OutletsView.tsx` (pilihan "Nonaktif" sekitar baris 337–373)

**Interfaces:**
- Consumes: `DialogTutupOutlet` & `bukaKembaliOutlet` (Task 5/6).

- [ ] **Step 1: Test gagal di `aturanEdit.test.ts`.** Untuk `type` internal/mitra, `cekPerubahanOutlet({status:'active',type:'internal'}, {status:'inactive',type:'internal'})` mengembalikan pesan berisi `"Tutup Outlet"`, dan `inactive → active` berisi `"Buka kembali"`. Untuk `type:'office'` keduanya `null`. Aturan Persiapan lama tetap lolos.
- [ ] **Step 2: Jalankan → FAIL.**
- [ ] **Step 3: Ubah `cekPerubahanOutlet`.** Signature tetap; aturan baru hanya untuk `lama.type ∈ {internal, mitra}`.
- [ ] **Step 4: Ubah UI & actions:**
  - Untuk outlet internal/mitra aktif, tombol Nonaktif di OutletTable membuka `DialogTutupOutlet`.
  - Untuk outlet internal/mitra nonaktif, "Aktifkan" diganti tautan "Papan Penutupan" (buka kembali dilakukan di papan).
  - Tipe lain tetap memakai toggle lama.
  - `softDeleteOutlet` menolak outlet internal/mitra yang masih aktif ("Tutup outlet dulu lewat Tutup Outlet").
  - Tombol hapus disembunyikan untuk outlet internal/mitra aktif.
  - Form POS Admin tidak menawarkan "Nonaktif" untuk outlet internal/mitra; diganti teks yang mengarahkan ke Outlet › Tutup Outlet.
- [ ] **Step 5: `yarn vitest run src/lib/outlets` → PASS; `yarn type-check` → 0 error baru.**
- [ ] **Step 6: Commit**
```bash
git add apps/admin-dashboard/src/app/dashboard/outlets apps/admin-dashboard/src/components/OutletTable.tsx apps/admin-dashboard/src/lib/outlets apps/admin-dashboard/src/app/dashboard/pos-admin/outlets
git commit -m "feat(admin): nonaktif/aktifkan outlet internal & mitra lewat Tutup Outlet / Buka kembali"
```

---

### Task 8: Verifikasi menyeluruh & dokumentasi

**Files:**
- Modify: `docs/SOP-PENUTUPAN-OUTLET.md` (Hari H langkah 6 → "Admin menekan Tutup Outlet"; tabel "belum didukung sistem" ditandai yang sudah tertutup)
- Modify: `CLAUDE.md` (entri Session 2026-11-13 Wizard Penutupan Outlet: ringkas, gotcha penjaga dua arah & GUC `app.penutupan_outlet`)

- [ ] **Step 1:** Jalankan ulang t1–t3 + `supabase/verifikasi/pembukaan_outlet/t1..t7` (penjaga Persiapan tidak boleh rusak) → semua LULUS.
- [ ] **Step 2:** `cd apps/admin-dashboard && yarn type-check && yarn vitest run && yarn build` → type-check 0 error baru, test = baseline + test baru, build sukses dengan rute `/dashboard/penutupan-outlet` dan `/dashboard/penutupan-outlet/[id]`.
- [ ] **Step 3:** Cek data live (read-only): `status_penutupan_outlet` untuk 4 outlet backfill (dengan klaim Admin Dev) → langkah `stok` selesai (sudah dinolkan 13 Nov), `kanal_online` belum (belum dicentang).
- [ ] **Step 4:** Update SOP & CLAUDE.md, commit.
```bash
git add docs/SOP-PENUTUPAN-OUTLET.md CLAUDE.md
git commit -m "docs: SOP & catatan sesi Wizard Penutupan Outlet"
```
