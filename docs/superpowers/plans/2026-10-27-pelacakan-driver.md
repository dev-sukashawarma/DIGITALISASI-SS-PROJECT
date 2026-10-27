# Pelacakan Driver Distribusi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pusat melihat posisi live driver & status tiba tiap SJ di web distribusi; driver mengirim posisi dari app native selama perjalanan; outlet melihat status antar ringkas.

**Architecture:** Empat tabel pelacakan baru di Supabase, ditulis hanya lewat RPC `SECURITY DEFINER` milik driver, dibaca pusat lewat RLS + realtime, dibaca outlet lewat RPC tanpa koordinat. App native menjalankan foreground service lokasi yang mengantre titik ke berkas lalu mengirim batch. Web distribusi menambah halaman peta Leaflet, satu baris di detail SJ, kartu dashboard, dan status di halaman Terima.

**Tech Stack:** Postgres/Supabase (plpgsql, pg_cron, realtime), Next.js 16 + React Query + `@suka/realtime` + Leaflet/react-leaflet + Vitest, Kotlin + Jetpack Compose + supabase-kt 3.0.3 + play-services-location + Robolectric.

**Spec:** `docs/superpowers/specs/2026-10-27-pelacakan-driver-design.md`

## Global Constraints

- Peran pelacak (baca semua data pelacakan): `kitchen, admin, purchasing, owner, developer`, `outlet_staff.status = 'active'`.
- Peran penulis: hanya `driver` aktif, `id = auth.uid()`, lewat RPC; tabel pelacakan `REVOKE ALL FROM anon, authenticated` lalu `GRANT SELECT TO authenticated`.
- Outlet tidak pernah menerima koordinat (lat/lng/akurasi/jarak) dari API mana pun.
- Pelacakan tidak menulis `ledger_stok`, `stok_balance`, `surat_jalan.status`, atau `surat_jalan_item`.
- Pengaturan `global_settings.key = 'driver_tracking'` (value jsonb): `{"interval_detik":30,"jarak_min_m":100,"batas_tutup_wib":"21:00","retensi_hari":60}`; bawaan sama bila baris tak ada.
- Jarak tiba "jauh" di UI: `> 500` m. Kesegaran pin: normal `< 120` dtk, kuning `120–600` dtk, merah `> 600` dtk.
- Maks 500 titik per panggilan `driver_kirim_lokasi`.
- Timestamp migration: tanggal 2026-10-27, **bukan 2030** (lint CI `scripts/migration-timestamp-lint.mjs`). Sebelum memilih, cek `SELECT version FROM supabase_migrations.schema_migrations WHERE version LIKE '20261027%'` dan `ls supabase/migrations | cut -c1-14 | sort | uniq -d`.
- Migration DB bersama: terapkan, verifikasi ke katalog (`pg_proc`, `pg_policy`, `pg_publication_tables`), lalu stempel; jangan percaya exit code.
- Tiap uji SQL di dalam `BEGIN … ROLLBACK`, simulasi user lewat `set_config('request.jwt.claims', …, true)` + `SET LOCAL ROLE authenticated`; ambil id fixture **sebelum** ganti peran; tiap asersi punya kontrol negatif yang benar-benar gagal.
- Copy UI Bahasa Indonesia, sesuai spec §7–§8.
- Native: jalankan gradle dengan `JAVA_HOME="C:\Program Files\Android\Android Studio1\jbr"` dan `TEMP=C:\t TMP=C:\t`; cek `git branch --show-current` sebelum tiap commit.
- Dependency web baru di `apps/distribusi/package.json`: `"leaflet": "^1.9.4"`, `"react-leaflet": "^5.0.0"`, `"@types/leaflet": "^1.9.21"` — range ini sudah ada di `yarn.lock`, jadi `git diff --stat yarn.lock` harus 0. Jangan `yarn install` polos di root.

## Review Focus

1. **SJ yang sudah dibawa perjalanan lain dipilih lagi** (dua HP / tombol ganda) → harus ditolak dengan nomor SJ, bukan stop ganda. Uji di Task 2 (`t2` kasus "SJ ganda").
2. **Antrean offline terkirim telat setelah perjalanan ditutup otomatis** → titik ≤ `selesai_at` masuk jejak, sesudahnya dibuang, pin terkini tidak mundur. Uji di Task 2 (`t2` kasus "titik telat") dan Task 8 (`AntreanTitikTest`).
3. **Outlet memverifikasi SJ sebelum driver menekan Tiba, lalu driver menekan Tiba** → RPC tiba menolak dengan pesan "sudah tiba (verifikasi outlet)", tidak menimpa sumber. Uji di Task 3 (`t3`).
4. **Proses app dimatikan di tengah perjalanan** → dibuka lagi kembali ke layar perjalanan & service menyala ulang dari `driver_perjalanan_aktif()`. Uji di Task 10 (`PengantaranViewModelTest`).
5. **Outlet tanpa koordinat** (1 dari 23) → tiba tercatat dengan `tiba_jarak_m = NULL`, UI menulis "jarak tidak diketahui", bukan 0 m. Uji di Task 2 (`t2`) dan Task 5 (`statusStop.test.ts`).

---

## File Structure

**DB**
- `supabase/migrations/20261027130000_allow_driver_role_accessible_outlets.sql` — rename berkas WIP 2030 (isi tak diubah).
- `supabase/migrations/20261027140000_pelacakan_driver_skema.sql` — tabel, RLS, helper `is_pelacak_driver()`, setting, realtime, pengetatan policy SJ.
- `supabase/migrations/20261027141000_pelacakan_driver_rpc.sql` — RPC driver.
- `supabase/migrations/20261027142000_pelacakan_driver_sinkron_jadwal.sql` — trigger SJ, `status_antar_sj`, fungsi tutup & retensi, cron.
- `supabase/verifikasi/pelacakan_driver/t1_skema.sql`, `t2_rpc.sql`, `t3_sinkron_jadwal.sql`, `pemantau.sql`.

**Web (`apps/distribusi/src`)**
- `lib/peran.ts` — daftar peran + predikat (satu sumber).
- `lib/pelacakan/statusStop.ts` — label/warna stop, kesegaran lokasi, kalimat outlet (murni).
- `lib/pelacakan/types.ts` — tipe baris.
- `hooks/usePelacakanDriver.ts` — perjalanan aktif + terkini + realtime; `useRiwayatPerjalanan`, `useJejakPerjalanan`.
- `hooks/useStatusAntarSj.ts` — RPC outlet.
- `components/pelacakan/PetaDriver.tsx` (Leaflet, ssr:false), `PanelPerjalanan.tsx`, `RiwayatPerjalanan.tsx`, `BarisPelacakanSj.tsx`, `KartuDriverDashboard.tsx`.
- `app/distribusi/driver/page.tsx`.
- Modifikasi: `app/dashboard/page.tsx`, `components/distribusi/SuratJalanDetail.tsx`, `SuratJalanList.tsx`, `PengirimanList.tsx`, `BottomNav.tsx`, `hooks/useSuratJalanList.ts`, `components/distribusi/SignatureFlow.tsx`, halaman Terima (`app/distribusi/terima`), `package.json`.

**Native (`mobile/native-superapp/app/src/main/java/com/sukashawarma/superapp/`)**
- `data/Roles.kt`, `ui/navigation/Screen.kt`, `NavigationManager.kt`, `ui/features/dashboard/DashboardMenu.kt`, `DashboardScreen.kt`, `ui/MainShell.kt` — gating.
- `ui/features/pengantaran/` — `PengantaranRepository.kt`, `PengantaranModels.kt`, `UsulanUrutan.kt`, `FilterTitik.kt`, `AntreanTitik.kt`, `PengantaranLocationService.kt`, `PengantaranViewModel.kt`, `PengantaranScreen.kt`, `PanduanIzinScreen.kt`.
- `app/src/main/AndroidManifest.xml`, `app/build.gradle.kts` (versionCode/versionName).
- Test: `app/src/test/java/com/sukashawarma/superapp/ui/features/pengantaran/*Test.kt`, `ui/features/dashboard/DashboardMenuTest.kt`, `e2e/NavigationFlowTest.kt`.

---

### Task 1: DB — skema, RLS, pengaturan, pengetatan akses SJ

**Files:**
- Rename: `supabase/migrations/20300254010700_allow_driver_role_accessible_outlets.sql` → `20261027130000_allow_driver_role_accessible_outlets.sql`
- Create: `supabase/migrations/20261027140000_pelacakan_driver_skema.sql`
- Test: `supabase/verifikasi/pelacakan_driver/t1_skema.sql`

**Interfaces:**
- Produces: tabel `driver_perjalanan`, `driver_perjalanan_stop`, `driver_lokasi_terkini`, `driver_lokasi_jejak` (kolom persis spec §5.1–5.4); `is_pelacak_driver() RETURNS boolean` (STABLE, SECURITY DEFINER); `is_driver_aktif() RETURNS boolean`; baris `global_settings('driver_tracking')`.

- [ ] **Step 1: Rename berkas WIP.** `git mv` tidak berlaku (untracked) — `mv` lalu `git add`. Bandingkan isi fungsi live dengan berkas: `SELECT pg_get_functiondef('public.accessible_outlet_ids'::regproc)` vs berkas (abaikan CRLF). Bila identik, stempel `20261027130000`. Bila beda, berhenti dan laporkan.

- [ ] **Step 2: Tulis `t1_skema.sql` (gagal dulu).** Asersi (masing-masing dengan kontrol negatif):
  - keempat tabel ada; `driver_lokasi_terkini`, `driver_perjalanan`, `driver_perjalanan_stop` ada di `pg_publication_tables` `supabase_realtime`, `driver_lokasi_jejak` tidak.
  - sebagai kitchen aktif: `SELECT` keempat tabel tidak error; `INSERT INTO driver_perjalanan` → `42501`.
  - sebagai driver Adam: hanya melihat baris `driver_id = Adam` (sisipkan fixture 2 perjalanan beda driver sebagai postgres sebelum ganti peran → driver melihat 1).
  - sebagai crew outlet: `SELECT count(*)` dari keempat tabel = 0.
  - sebagai anon: `SELECT` → `42501`.
  - **pengetatan SJ:** sebagai driver, `UPDATE surat_jalan SET notes = notes WHERE id = <SJ dikirim>` mengubah 0 baris; sebagai kitchen mengubah 1. Sama untuk `surat_jalan_item` (policy `surat_jalan_item_update_scoped` dan `sj_item_update` — driver ber-`outlet_id` BNR).
  - `global_settings` `driver_tracking` berisi `interval_detik = 30`.

- [ ] **Step 3: Jalankan t1** — Expected: gagal "relation driver_perjalanan does not exist".

- [ ] **Step 4: Tulis migration skema** sesuai spec §5 & §6.1/§6.6: CHECK status, unique parsial (`driver_perjalanan(driver_id) WHERE status='berjalan'`, `driver_perjalanan_stop(surat_jalan_id) WHERE status<>'dibatalkan'`, `driver_lokasi_jejak(driver_id, direkam_at)`), index `(perjalanan_id, direkam_at)`, RLS SELECT `is_pelacak_driver() OR driver_id = auth.uid()` (stop: lewat EXISTS ke perjalanan), `REVOKE`/`GRANT SELECT`, `ALTER PUBLICATION supabase_realtime ADD TABLE driver_lokasi_terkini, driver_perjalanan, driver_perjalanan_stop` + `REPLICA IDENTITY FULL` ketiganya (jejak tidak), `INSERT … ON CONFLICT DO NOTHING` setting. Pengetatan: `ALTER POLICY` ketiga policy UPDATE SJ (`surat_jalan_update_scoped`, `surat_jalan_item_update_scoped`, `sj_item_update`) menambah `AND NOT is_driver_aktif()` di USING (dan WITH CHECK bila ada) — ekspresi lama disalin persis dari `pg_policy`.

- [ ] **Step 5: Terapkan, verifikasi katalog, stempel, jalankan t1** — Expected: semua asersi lulus; kontrol negatif melempar error yang diharapkan.

- [ ] **Step 6: Commit**
```bash
git add supabase/migrations/20261027130000_allow_driver_role_accessible_outlets.sql supabase/migrations/20261027140000_pelacakan_driver_skema.sql supabase/verifikasi/pelacakan_driver/t1_skema.sql
git commit -m "feat(db): skema pelacakan driver + tutup update SJ oleh driver"
```

### Task 2: DB — RPC driver

**Files:**
- Create: `supabase/migrations/20261027141000_pelacakan_driver_rpc.sql`
- Test: `supabase/verifikasi/pelacakan_driver/t2_rpc.sql`

**Interfaces:**
- Consumes: Task 1 tabel & `is_driver_aktif()`.
- Produces (semua `SECURITY DEFINER SET search_path = public`, GRANT EXECUTE ke `authenticated` saja):
  - `driver_sj_siap_dibawa() RETURNS TABLE(surat_jalan_id uuid, document_number text, outlet_id uuid, outlet_name text, lat numeric, lng numeric, jumlah_item int, created_at timestamptz)`
  - `driver_mulai_perjalanan(p_sj_ids uuid[], p_lat numeric, p_lng numeric) RETURNS jsonb` → `{perjalanan_id, pengaturan}`
  - `driver_ubah_urutan(p_perjalanan_id uuid, p_stop_ids uuid[]) RETURNS void`
  - `driver_tandai_tiba(p_stop_id uuid, p_lat numeric, p_lng numeric, p_akurasi_m numeric) RETURNS jsonb` → `{tiba_jarak_m, perjalanan_status}`
  - `driver_kirim_lokasi(p_titik jsonb) RETURNS jsonb` → `{status_perjalanan, pengaturan, diterima int}`
  - `driver_selesaikan_perjalanan(p_perjalanan_id uuid) RETURNS jsonb` → `{total_km, durasi_detik}`
  - `driver_perjalanan_aktif() RETURNS jsonb` → `null` atau `{perjalanan, stops:[…urutan]}`
  - internal (tanpa GRANT): `_pelacakan_haversine_m(lat1,lng1,lat2,lng2) RETURNS numeric`, `_pelacakan_tutup_perjalanan(p_id uuid, p_status text)` (isi stop menunggu → `tidak_ditandai`, `selesai_at`, `total_km` dari jejak berurutan, `durasi_detik`), `_pelacakan_pengaturan() RETURNS jsonb`.

- [ ] **Step 1: Tulis `t2_rpc.sql`.** Fixture: 3 SJ `dikirim` ke 3 outlet (salah satunya outlet ber-`lat` NULL), 1 SJ `draft`. Kasus:
  - crew memanggil `driver_mulai_perjalanan` → error `'hanya driver'`.
  - driver: `driver_sj_siap_dibawa()` memuat 3 SJ dikirim, bukan draft.
  - mulai dengan 2 SJ → 2 stop urutan 1,2; panggil lagi saat berjalan → error `'masih ada perjalanan berjalan'`.
  - **SJ ganda:** driver kedua (fixture) mulai dengan SJ yang sudah di stop → error memuat `document_number`.
  - `driver_ubah_urutan` menukar urutan; stop tuntas tak boleh ada di array → error.
  - `driver_tandai_tiba` 30 m dari outlet → `tiba_jarak_m` antara 25 dan 35, sumber `driver`; outlet tanpa koordinat → `tiba_jarak_m IS NULL`; tiba stop kedua (lompat urutan dibolehkan) → bila semua tuntas perjalanan `selesai`.
  - `driver_kirim_lokasi` 3 titik → `diterima = 3`; kirim ulang sama → `diterima = 0`; titik dengan `direkam_at` lebih lama tidak mengubah `driver_lokasi_terkini.direkam_at`; 501 titik → error.
  - **titik telat:** tutup perjalanan, kirim titik `direkam_at` sebelum dan sesudah `selesai_at` → hanya yang sebelum masuk; respons `status_perjalanan = 'selesai'`.
  - `driver_selesaikan_perjalanan` dengan 1 stop menunggu → stop `tidak_ditandai`, `total_km` > 0 dari jejak.
  - `driver_perjalanan_aktif()` → null setelah selesai.

- [ ] **Step 2: Jalankan** — Expected: gagal "function driver_mulai_perjalanan does not exist".
- [ ] **Step 3: Tulis migration RPC.** Kunci baris perjalanan `FOR UPDATE` di tiba/ubah/selesaikan/kirim; `driver_mulai_perjalanan` mengunci SJ terpilih `FOR UPDATE` sebelum cek ganda. Waktu WIB dari `now() AT TIME ZONE 'Asia/Jakarta'` (jangan `current_date`).
- [ ] **Step 4: Terapkan, verifikasi katalog (`prosecdef = true`, ACL tanpa anon/PUBLIC), stempel, jalankan t2** — Expected: semua lulus.
- [ ] **Step 5: Commit** `feat(db): RPC pelacakan driver`.

### Task 3: DB — sinkron SJ, status untuk outlet, jadwal

**Files:**
- Create: `supabase/migrations/20261027142000_pelacakan_driver_sinkron_jadwal.sql`
- Test: `supabase/verifikasi/pelacakan_driver/t3_sinkron_jadwal.sql`, `supabase/verifikasi/pelacakan_driver/pemantau.sql`

**Interfaces:**
- Consumes: `_pelacakan_tutup_perjalanan`, `_pelacakan_pengaturan` (Task 2).
- Produces: trigger `trg_pelacakan_sinkron_sj` AFTER UPDATE OF status ON `surat_jalan`; `status_antar_sj(p_sj_id uuid) RETURNS TABLE(dilacak boolean, nama_driver text, berangkat_at timestamptz, status_stop text, tiba_at timestamptz, tiba_sumber text, outlet_sebelum int)`; `pelacakan_tutup_otomatis() RETURNS int`; `pelacakan_retensi_jejak() RETURNS int`; cron `driver-tutup-perjalanan` `*/15 * * * *`, `driver-retensi-jejak` `40 20 * * *`.

- [ ] **Step 1: Tulis t3.** Kasus:
  - SJ di stop menunggu → `UPDATE surat_jalan SET status='diterima_lengkap'` (sebagai postgres) → stop `tiba`, sumber `verifikasi_outlet`, `tiba_lat IS NULL`; ledger_stok count untuk SJ itu tidak berubah karena trigger ini (bandingkan sebelum/sesudah dengan trigger lain di-skip: hitung baris ledger ber-`ref_shipment_id` sebelum & sesudah, selisih harus sama dengan perilaku tanpa pelacakan — cukup asersi trigger tidak menulis `ledger_stok` lewat `pg_get_functiondef NOT LIKE '%ledger_stok%'`).
  - setelah itu driver `driver_tandai_tiba` stop itu → error `'sudah tiba (verifikasi outlet)'`.
  - stop terakhir terverifikasi outlet → perjalanan `selesai`.
  - SJ `dibatalkan` → stop `dibatalkan`; stop `tidak_ditandai` tidak diubah oleh verifikasi belakangan.
  - `status_antar_sj` sebagai crew outlet tujuan: 1 baris, `outlet_sebelum` benar, dan hasil `row_to_json` tidak memuat kunci `lat`/`lng`/`jarak`; sebagai crew outlet lain: 0 baris; SJ tanpa stop: `dilacak = false`.
  - `pelacakan_tutup_otomatis()`: set `batas_tutup_wib` fixture ke `'00:00'` → perjalanan berjalan jadi `ditutup_otomatis`, stop menunggu `tidak_ditandai`; dengan `'23:59'` → tidak berubah (kecuali dijalankan tepat 23:59; pakai jam fixture via parameter internal bila perlu).
  - `pelacakan_retensi_jejak()`: jejak `direkam_at = now() - 61 days` terhapus, `- 59 days` tetap; ringkasan perjalanan tetap.
- [ ] **Step 2: Jalankan** — Expected gagal.
- [ ] **Step 3: Tulis migration**; `pemantau.sql` berisi: Q1 perjalanan berjalan > 12 jam (harus 0), Q2 stop menunggu milik perjalanan tertutup (harus 0), Q3 porsi SJ `dikirim` 7 hari tanpa stop ("tidak dilacak"), Q4 tiba dengan jarak > 500 m 7 hari, Q5 jumlah jejak > retensi (harus 0).
- [ ] **Step 4: Terapkan, verifikasi `cron.job` (jadwal persis), stempel, jalankan t3 + pemantau** — Expected lulus.
- [ ] **Step 5: Commit** `feat(db): sinkron SJ, status antar outlet, tutup & retensi pelacakan`.

### Task 4: Web — peran driver tersendiri + tanda tangan Supir

**Files:**
- Create: `apps/distribusi/src/lib/peran.ts`, `apps/distribusi/src/lib/peran.test.ts`
- Modify: `app/dashboard/page.tsx`, `components/distribusi/SuratJalanDetail.tsx`, `SuratJalanList.tsx`, `PengirimanList.tsx`, `BottomNav.tsx`, `hooks/useSuratJalanList.ts`, `components/distribusi/SignatureFlow.tsx`

**Interfaces:**
- Produces: `PERAN_PUSAT: readonly string[]` (= `['kitchen','admin','admin_hr','spv','regional_manager','owner','developer']`), `PERAN_PELACAK` (= `['kitchen','admin','purchasing','owner','developer']`), `isPusat(role?: string|null): boolean`, `isDriver(role?: string|null): boolean`, `bisaLihatSemuaSj(role?: string|null): boolean` (pusat ∪ driver ∪ purchasing sesuai daftar `isGlobalPusat` lama + driver), `bisaLacakDriver(role?: string|null): boolean`.

- [ ] **Step 1: Tes** `peran.test.ts`: `isPusat('driver') === false`; `isDriver('driver') === true`; `bisaLihatSemuaSj('driver') === true`; `bisaLacakDriver('purchasing') === true`, `bisaLacakDriver('driver') === false`, `bisaLacakDriver('spv') === false`.
- [ ] **Step 2: Jalankan** `cd apps/distribusi && yarn vitest run src/lib/peran.test.ts` — Expected FAIL.
- [ ] **Step 3: Implement `peran.ts`; ganti semua daftar literal di file yang dimodifikasi dengan predikat.** Hasil yang diharapkan: driver bisa melihat daftar & detail SJ, PDF, cetak; **tidak** ada tombol buat SJ, validasi pusat (`handleVerifyPusat`), batal PO; BottomNav driver: Dashboard · Pengiriman · (tanpa Buat SJ). `useSuratJalanList` memakai `bisaLihatSemuaSj`.
- [ ] **Step 4: SignatureFlow:** query `outlet_staff` juga mengambil `role`; opsi "Supir Internal" hanya staf `role === 'driver'`; bila tepat satu dan `signedBy` kosong saat opsi internal aktif → terisi otomatis.
- [ ] **Step 5: Jalankan** `yarn vitest run` dan `yarn type-check` di `apps/distribusi` — Expected: lulus, 0 error baru.
- [ ] **Step 6: Commit** `feat(distribusi): role driver tersendiri, tanda tangan supir dari akun driver`.

### Task 5: Web — fungsi murni & hook pelacakan

**Files:**
- Create: `apps/distribusi/src/lib/pelacakan/types.ts`, `statusStop.ts`, `statusStop.test.ts`, `hooks/usePelacakanDriver.ts`, `hooks/useStatusAntarSj.ts`
- Modify: `apps/distribusi/package.json` (leaflet deps, lihat Global Constraints)

**Interfaces:**
- Consumes: tabel/RPC Task 1–3.
- Produces:
  - `type StopRow`, `PerjalananRow`, `LokasiTerkiniRow`, `StatusAntarSj` (kolom = spec §5 / RPC Task 3).
  - `labelStop(stop: StopRow): { teks: string; nada: 'ok'|'peringatan'|'buruk'|'netral' }` — `tiba`+`driver` → `"✓ 10:12 · 35 m"` (`peringatan` bila > 500 m, teks `"⚠ ditekan 4,2 km dari outlet"`); jarak NULL → `"✓ 10:12 · jarak tidak diketahui"`; `verifikasi_outlet` → `"✓ dari verifikasi outlet"`; `menunggu` → `"○ menunggu"`; `tidak_ditandai` → `"✗ tidak ditandai tiba"` (`buruk`); `dibatalkan` → `"— dibatalkan"`. Jam WIB `HH:mm`; jarak < 1000 m dalam "m", selebihnya "x,y km".
  - `kesegaranLokasi(diterimaAt: string, now: Date): { detik: number; nada: 'ok'|'peringatan'|'buruk'; teks: string }` (ambang Global Constraints; teks `"diperbarui 20 dtk lalu"` / `"… 5 mnt lalu"`).
  - `kalimatOutlet(s: StatusAntarSj): string | null` — `dilacak=false` → `null`; menunggu → `"Sedang diantar oleh Adam · berangkat 09:40 · 2 outlet lagi sebelum outletmu"` (0 → `"outletmu berikutnya"`); tiba → `"Tiba 10:12"` (+ `" (dicatat dari verifikasi)"` untuk sumber outlet); tidak_ditandai/dibatalkan → `null`.
  - `usePerjalananAktif()` → `{ perjalanan: (PerjalananRow & { stops: StopRow[]; driver_name: string; terkini: LokasiTerkiniRow|null })[], loading }` dengan `useRealtimeInvalidate` channel `distribusi-pelacakan` untuk `driver_lokasi_terkini` + `driver_perjalanan` + `driver_perjalanan_stop`; `useRiwayatPerjalanan(tanggal: string)`; `useJejakPerjalanan(perjalananId: string|null)`; `useStatusAntarSj(sjId: string|null)` (refetchInterval 60 000).

- [ ] **Step 1: Tes** `statusStop.test.ts` untuk setiap cabang di atas, termasuk jarak NULL (Review Focus 5), 499 m vs 501 m, kesegaran 119/120/600/601 dtk, `outlet_sebelum` 0 dan 2.
- [ ] **Step 2: Jalankan** — FAIL.
- [ ] **Step 3: Implement** `statusStop.ts`, tipe, hook.
- [ ] **Step 4: Jalankan** vitest + type-check — PASS; `git diff --stat yarn.lock` kosong.
- [ ] **Step 5: Commit** `feat(distribusi): logika & hook pelacakan driver`.

### Task 6: Web — halaman Pelacakan Driver

**Files:**
- Create: `apps/distribusi/src/app/distribusi/driver/page.tsx`, `components/pelacakan/PetaDriver.tsx`, `PanelPerjalanan.tsx`, `RiwayatPerjalanan.tsx`

**Interfaces:**
- Consumes: Task 4 `bisaLacakDriver`, Task 5 hook & label.
- Produces: rute `/distribusi/driver` (dipakai tautan Task 7).

- [ ] **Step 1:** `page.tsx` client: bukan `bisaLacakDriver` → layar "Halaman ini hanya untuk tim pusat". Tab **Live** | **Riwayat**.
- [ ] **Step 2:** `PetaDriver` lewat `next/dynamic({ ssr:false })`, pola `apps/monitoring/src/components/LiveLocationMap.tsx` (divIcon, tanpa ikon default, `escapeHtml` untuk nama): pin driver + label kesegaran, polyline jejak perjalanan terpilih, penanda outlet per stop berwarna sesuai `labelStop().nada` (outlet tanpa koordinat tidak digambar), auto-fit bounds sekali saat perjalanan berganti.
- [ ] **Step 3:** `PanelPerjalanan`: driver, jam berangkat, km berjalan (dari jejak), daftar stop berurutan dengan `labelStop`, nomor SJ tertaut ke `/distribusi/surat-jalan/[id]`. Tidak ada perjalanan → "Tidak ada driver yang sedang mengantar".
- [ ] **Step 4:** `RiwayatPerjalanan`: pemilih tanggal (default hari ini WIB), daftar ringkasan (berangkat, selesai, status, km, durasi, jumlah stop per status); "lihat rute" hanya bila `berangkat_at` ≤ 60 hari.
- [ ] **Step 5:** `yarn type-check` + `yarn build --webpack` di `apps/distribusi` — Expected sukses, rute `/distribusi/driver` muncul.
- [ ] **Step 6: Commit** `feat(distribusi): halaman pelacakan driver`.

### Task 7: Web — baris di detail SJ, kartu dashboard, status di Terima

**Files:**
- Create: `components/pelacakan/BarisPelacakanSj.tsx`, `KartuDriverDashboard.tsx`
- Modify: `components/distribusi/SuratJalanDetail.tsx`, `app/dashboard/page.tsx`, halaman/komponen Terima outlet di `app/distribusi/terima`

**Interfaces:**
- Consumes: `usePerjalananAktif`, `useStatusAntarSj`, `labelStop`, `kalimatOutlet`, `bisaLacakDriver`.

- [ ] **Step 1:** `BarisPelacakanSj({ sjId, outletView })`: pelacak → baca stop SJ (query `driver_perjalanan_stop` + perjalanan + nama driver) → `"Dibawa Adam · berangkat 09:40 · " + labelStop` + tautan `/distribusi/driver`; tanpa stop dan status `dikirim*` → "Tidak dilacak". Outlet → `kalimatOutlet(useStatusAntarSj)`, `null` → tidak merender apa pun.
- [ ] **Step 2:** pasang di `SuratJalanDetail` di bawah status; di kartu SJ `dikirim` halaman Terima (outletView).
- [ ] **Step 3:** `KartuDriverDashboard` (hanya `bisaLacakDriver`): "N driver sedang antar · M SJ menunggu tiba → Buka peta"; N=0 → "Tidak ada pengantaran berjalan · Buka riwayat".
- [ ] **Step 4:** type-check + build + uji manual lokal dengan data dari Task 2 fixture (atau perjalanan uji outlet tes): detail SJ, Terima, dashboard.
- [ ] **Step 5: Commit** `feat(distribusi): status pelacakan di detail SJ, terima, dashboard`.

### Task 8: Native — gating menu, izin manifest, logika murni

**Files:**
- Modify: `data/Roles.kt`, `ui/navigation/Screen.kt`, `ui/navigation/NavigationManager.kt`, `ui/features/dashboard/DashboardMenu.kt`, `ui/features/dashboard/DashboardScreen.kt`, `ui/MainShell.kt`, `app/src/main/AndroidManifest.xml`
- Create: `ui/features/pengantaran/PengantaranModels.kt`, `UsulanUrutan.kt`, `FilterTitik.kt`, `AntreanTitik.kt`
- Test: `ui/features/dashboard/DashboardMenuTest.kt`, `e2e/NavigationFlowTest.kt`, `ui/features/pengantaran/UsulanUrutanTest.kt`, `FilterTitikTest.kt`, `AntreanTitikTest.kt`

**Interfaces:**
- Produces:
  - `Roles.PENGANTARAN = setOf("driver")`; `"driver"` ditambahkan ke `Roles.ATTENDANCE`; `Screen.Pengantaran` route `"pengantaran"`; tile `"Pengantaran"`.
  - `@Serializable data class Titik(val lat: Double, val lng: Double, val akurasiM: Float?, val kecepatanMps: Float?, val arahDerajat: Float?, val bateraiPersen: Int?, val direkamAt: String /* ISO-8601 UTC */)` (nama JSON snake_case sesuai RPC: `akurasi_m`, `kecepatan_mps`, `arah_derajat`, `baterai_persen`, `direkam_at`).
  - `data class Pengaturan(val intervalDetik: Int = 30, val jarakMinM: Int = 100, val batasTutupWib: String = "21:00")`.
  - `data class SjSiap(...)`, `data class StopUi(...)`, `data class PerjalananUi(...)` sesuai RPC Task 2.
  - `object UsulanUrutan { fun susun(mulaiLat: Double, mulaiLng: Double, sj: List<SjSiap>): List<SjSiap> }` — nearest-neighbor berantai; SJ tanpa koordinat di akhir dengan urutan asli; SJ outlet sama berdampingan.
  - `class FilterTitik(var pengaturan: Pengaturan) { fun perluKirim(baru: Titik, terakhir: Titik?): Boolean }` — true bila `terakhir == null`, atau selisih waktu ≥ interval, atau jarak ≥ jarakMin; false bila jarak < 15 m dan waktu < interval.
  - `class AntreanTitik(file: File) { fun tambah(t: Titik); fun ambil(maks: Int = 500): List<Titik>; fun hapus(n: Int); fun jumlah(): Int }` — JSON lines, tahan berkas rusak (baris tak terbaca dilewati).

- [ ] **Step 1: Tes** (Robolectric/JUnit sesuai pola repo):
  - `DashboardMenuTest`: `driverAbsensiDanPengantaran()` → menu = `["Absensi","Pengantaran"]`; `crewTanpaPengantaran()`.
  - `NavigationFlowTest`: driver boleh `Screen.Pengantaran`, kitchen ditolak.
  - `UsulanUrutanTest`: 3 SJ di garis lurus dari titik mulai → urut terdekat; outlet tanpa koordinat terakhir; dua SJ outlet sama berdampingan.
  - `FilterTitikTest`: titik pertama true; 31 dtk & 5 m → true; 10 dtk & 120 m → true; 10 dtk & 10 m → false; ganti pengaturan interval 60 → 31 dtk & 5 m → false.
  - `AntreanTitikTest`: tambah 3 → ambil(2) dua tertua → hapus(2) → jumlah 1; berkas berisi baris rusak → dilewati; instance baru pada berkas sama membaca sisa (bertahan proses mati); urutan `direkam_at` terjaga.
- [ ] **Step 2: Jalankan** `./gradlew :app:testDebugUnitTest` — Expected FAIL (kompilasi).
- [ ] **Step 3: Implement** + manifest: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `POST_NOTIFICATIONS`, `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`. Layar Pengantaran sementara placeholder composable (diisi Task 10).
- [ ] **Step 4: Jalankan** — PASS seluruh unit test (termasuk yang lama).
- [ ] **Step 5: Commit** `feat(superapp): menu pengantaran driver, izin lokasi, logika urutan & antrean`.

### Task 9: Native — repository RPC & foreground service

**Files:**
- Create: `ui/features/pengantaran/PengantaranRepository.kt`, `PengantaranLocationService.kt`
- Modify: `data/SupabaseClient.kt` (bila perlu akses `postgrest.rpc` dari delegate & mock), `AndroidManifest.xml` (`<service android:name=".ui.features.pengantaran.PengantaranLocationService" android:foregroundServiceType="location" android:exported="false"/>`)
- Test: `ui/features/pengantaran/PengantaranRepositoryTest.kt`, `PengantaranLocationServiceTest.kt`

**Interfaces:**
- Consumes: Task 8 model, `AntreanTitik`, `FilterTitik`; RPC Task 2.
- Produces:
  - `interface PengantaranApi { suspend fun sjSiap(): List<SjSiap>; suspend fun mulai(sjIds: List<String>, lat: Double, lng: Double): Pair<String, Pengaturan>; suspend fun ubahUrutan(perjalananId: String, stopIds: List<String>); suspend fun tandaiTiba(stopId: String, lat: Double, lng: Double, akurasiM: Float?): Double?; suspend fun kirimLokasi(titik: List<Titik>): HasilKirim; suspend fun selesaikan(perjalananId: String): RingkasanPerjalanan; suspend fun perjalananAktif(): PerjalananUi? }`
  - `data class HasilKirim(val statusPerjalanan: String, val pengaturan: Pengaturan, val diterima: Int)`; `class PengantaranRepository(client) : PengantaranApi` memakai `postgrest.rpc(...)`.
  - `PengantaranLocationService`: `companion object { fun mulai(context: Context, perjalananId: String, pengaturan: Pengaturan); fun hentikan(context: Context) }`; `StateFlow<StatusKirim>` publik `(terakhirTerkirim: Instant?, menunggu: Int)`.
  - `class PengirimAntrean(api: PengantaranApi, antrean: AntreanTitik) { suspend fun kirimSemua(): HasilKirim? }` — kirim batch 500 sampai habis atau gagal jaringan; hapus hanya setelah sukses; kembalikan hasil terakhir.

- [ ] **Step 1: Tes** dengan `PengantaranApi` palsu: `PengirimAntrean` — 1.200 titik → 3 panggilan (500/500/200), antrean kosong; panggilan kedua gagal → 700 tersisa, tak ada yang hilang; respons `statusPerjalanan="ditutup_otomatis"` → `kirimSemua` mengembalikan status itu (service memakainya untuk berhenti). Repository: parsing JSON respons `driver_kirim_lokasi`/`driver_perjalanan_aktif` (sampel JSON persis spec §6.2) → model benar; `tiba_jarak_m: null` → `null`.
- [ ] **Step 2: Jalankan** — FAIL.
- [ ] **Step 3: Implement service:** `startForeground` dengan notifikasi channel `pengantaran` teks `"Sedang mengantar · {tiba}/{total} outlet"`; `requestLocationUpdates` (`PRIORITY_HIGH_ACCURACY`, interval = pengaturan); tiap lokasi → `FilterTitik.perluKirim` → `AntreanTitik.tambah` → `PengirimAntrean.kirimSemua()` (maks satu kirim berjalan; coba ulang saat titik berikut); status bukan `berjalan` → `stopSelf()`; perbarui `pengaturan` dari respons. Baterai dari `BatteryManager`. Tidak menyimpan profil staf.
- [ ] **Step 4: Jalankan** test — PASS; `./gradlew :app:assembleDebug` sukses.
- [ ] **Step 5: Commit** `feat(superapp): service lokasi pengantaran dengan antrean offline`.

### Task 10: Native — layar Pengantaran & panduan izin

**Files:**
- Create: `ui/features/pengantaran/PengantaranViewModel.kt`, `PengantaranScreen.kt`, `PanduanIzinScreen.kt`
- Modify: `ui/MainShell.kt` (ganti placeholder), `app/build.gradle.kts` (versionCode +1, versionName naik minor)
- Test: `ui/features/pengantaran/PengantaranViewModelTest.kt`

**Interfaces:**
- Consumes: `PengantaranApi`, `UsulanUrutan`, `PengantaranLocationService.mulai/hentikan/status`, `LocationHelper.getCurrentLocation`.
- Produces: `sealed interface LayarPengantaran { PilihMuatan; SusunUrutan; DalamPerjalanan; Ringkasan; PerluIzin }`; `PengantaranViewModel(api, lokasi, service)` dengan aksi `muat()`, `pilih(sjId)`, `lanjutUrutan()`, `pindah(dari, ke)`, `berangkat()`, `tiba(stopId)`, `ubahUrutanBerjalan(...)`, `selesaikan()`.

- [ ] **Step 1: Tes ViewModel** (api & service palsu):
  - **Review Focus 4:** `muat()` saat `perjalananAktif()` mengembalikan perjalanan → layar `DalamPerjalanan` dan `service.mulai` dipanggil sekali.
  - tanpa perjalanan → `PilihMuatan` berisi hasil `sjSiap()`.
  - `lanjutUrutan()` dengan 0 dipilih → tetap, pesan "Pilih minimal satu surat jalan".
  - `berangkat()` → `api.mulai` dengan id berurutan sesuai layar urutan → `DalamPerjalanan` + `service.mulai`.
  - `api.mulai` melempar error berisi nomor SJ ganda → tetap di `SusunUrutan` dengan pesan error itu, daftar dimuat ulang.
  - `tiba()` stop terakhir → respons perjalanan `selesai` → `Ringkasan` + `service.hentikan`.
  - `selesaikan()` dengan stop menunggu → butuh konfirmasi (state `konfirmasiSelesai = true`) sebelum memanggil api.
  - izin lokasi belum ada → `PerluIzin`.
- [ ] **Step 2: Jalankan** — FAIL.
- [ ] **Step 3: Implement UI** sesuai spec §8.2: daftar centang (nomor SJ, outlet, jumlah item); daftar urutan dengan tombol ▲/▼; layar perjalanan — stop berikutnya disorot, tombol **Tiba** di tiap stop menunggu, banner `"Terakhir terkirim N dtk lalu · M titik menunggu sinyal"` dari `StatusKirim`, tombol **Selesaikan Perjalanan**; ringkasan km & durasi. `PanduanIzinScreen`: izin lokasi (RequestPermission FINE), notifikasi (Android 13+), optimasi baterai (`ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`), dan bila `Build.MANUFACTURER` ∈ {xiaomi, redmi, poco, oppo, realme, vivo} langkah Autostart dengan tombol buka pengaturan aplikasi; tampil sekali sebelum Berangkat pertama dan setiap izin lokasi dicabut.
- [ ] **Step 4: Jalankan** unit test + `assembleDebug` + `assembleRelease` — PASS.
- [ ] **Step 5: Commit** `feat(superapp): layar pengantaran driver`.

### Task 11: Uji ujung-ke-ujung, dokumentasi, deploy

**Files:**
- Modify: `CLAUDE.md` (entri sesi), `docs/ROLE-JOBDESK.md` (driver: pengantaran & pelacakan)

- [ ] **Step 1:** Jalankan ulang `t1`–`t3` dan `pemantau.sql` di DB live — semua lulus, Q1/Q2/Q5 = 0.
- [ ] **Step 2:** Uji lokal web (`yarn dev` distribusi) sebagai kitchen & sebagai crew outlet uji, dengan perjalanan dari APK debug di emulator/HP pengembang yang login sebagai akun driver uji di **outlet tes** (jangan pakai SJ outlet nyata): pin bergerak, Tiba muncul di panel & di Terima outlet tanpa koordinat, Selesaikan mematikan notifikasi.
- [ ] **Step 3:** Skenario lapangan (checklist untuk HP Adam, isi hasil nyata): perjalanan 2+ outlet; layar mati 10 menit; mode pesawat 5 menit lalu kembali (titik menyusul, rute utuh); app di-kill dari recent apps lalu dibuka (kembali ke perjalanan); catat merek HP & apakah panduan Autostart diperlukan.
- [ ] **Step 4:** Tulis entri CLAUDE.md: status (migration applied+stempel, ⚠️ perlu redeploy `distribusi` + rilis APK), keputusan Q1–Q14 ringkas, gotcha (driver di-outlet BNR, Gudang tanpa koordinat, tabel lokasi lama hilang/monitoring basi, policy UPDATE SJ kini menolak driver).
- [ ] **Step 5: Commit** `docs: pelacakan driver — catatan sesi & jobdesk`.
