# Konsolidasi Realtime + Isi Celah Distribusi — Design

**Tanggal:** 2026-07-16
**Status:** Disetujui (brainstorm + grill-with-docs), siap dibuatkan plan
**Scope apps:** absensi, stok, distribusi, pos-kasir (+ admin-dashboard & finance sebagai pemakai firehose)

---

## 1. Masalah

Realtime di suite ini tumbuh organik jadi **tiga pola yang hidup berdampingan** dan mulai busuk:

| Pola | Apps | Cara kerja |
|---|---|---|
| **Firehose** — `GlobalRealtimeProvider` | pos-kasir, admin-dashboard, finance | Subscribe seluruh schema `public` (`event:'*', schema:'public'`), invalidate React Query key `[table]`, debounce 300ms |
| **Scoped** — `lib/realtime/` | absensi, stok | Channel per-scope, sub eksplisit `table`+`event`+`filter`, debounce 500ms, invalidate query key spesifik |
| **Ad-hoc** — channel per-fitur | pos-kasir (OrderNotification, OnlineOrderSync, useKioskControl…) | `.channel().on('postgres_changes', …)` buatan tangan |

Publication pun firehose: `20260713100000_enable_realtime_all.sql` memasukkan **semua** tabel `public` ke `supabase_realtime`.

### Bukti kerusakan (data asli repo)

1. **Dua copy `lib/realtime` sudah divergen diam-diam.** `apps/absensi` memakai `channelName-${Math.random()}` (channel baru tiap mount); `apps/stok` memakai `channelName` stabil. Tak ada yang sengaja membedakan — satu di-edit, satu ketinggalan. Ini justru **bertentangan** dengan catatan CLAUDE.md ("Nama channel stabil per scope, bukan Date.now()").

2. **Firehose tidak reliabel** — ia mengandalkan queryKey **kebetulan sama** dengan nama tabel, karena `invalidateQueries({ queryKey: [payload.table] })` cocok via prefix-match React Query:

   | queryKey asli (admin-dashboard) | nama tabel | Dapat realtime? |
   |---|---|---|
   | `['expenses', …]` | `expenses` | ✅ (kebetulan cocok) |
   | `['payroll', …]` | `payroll` | ✅ (kebetulan cocok) |
   | `['staff']` | `outlet_staff` | ❌ mati diam-diam |
   | `['cash-advances']` | `cash_advances` | ❌ mati (beda tanda hubung) |
   | `['sales-hourly-raw', …]` | `orders` | ❌ mati |

   Contoh konkret: 1 order di `SUKA SHAWARMA EMPANG` menyentuh `orders` + `order_items` + `stok_balance`×2 + `ledger_stok`×2 = 6 baris. Firehose menerima 6 event lalu invalidate `['orders']`, `['order_items']`, `['stok_balance']`, `['ledger_stok']` — **nol** di antaranya cocok dengan queryKey sales dashboard (`['sales-hourly-raw']`, `['menu-sales-agg']`, …). Jadi 6 event diproses → 0 refetch relevan. Yang benar-benar menyalakan dashboard justru hook scoped terpisah `useSalesRealtime` (subscribe `orders` saja). Firehose = beban murni + redundan.

3. **Distribusi nol realtime.** `useSuratJalanList`, `useTerimaList`, `usePengirimanList` — tak satu pun subscribe. Alur Permintaan Bahan → Surat Jalan → Verifikasi Penerimaan (titik tunggu nyata antara pusat & outlet) tidak live.

---

## 2. Tujuan

Menyatukan tiga pola jadi **satu abstraksi scoped kanonik** (paket `@suka/realtime`), **membunuh firehose dengan aman**, dan **menambah realtime ke distribusi**.

Non-goal (sengaja dikecualikan):
- Memangkas publication `enable_realtime_all` (lihat §5 — berisiko di DB shared).
- Mengubah channel ad-hoc pos-kasir yang sudah jalan (OrderNotification dll) — hanya firehose yang dicabut.

---

## 3. Abstraksi kanonik — paket `@suka/realtime`

Paket baru `packages/realtime` (`@suka/realtime`), sejajar `@suka/auth` & `@suka/design-system`.

**Isi:**
- `useRealtimeChannel(opts)` — callback mentah per event (untuk kasus non-React-Query).
- `useRealtimeInvalidate(opts)` — wrapper React Query: event → debounce → `invalidateQueries(queryKey)`.
- Util murni `createDebouncer` + `subsSignature` (sudah ada di `lib/realtime`, diangkat + unit test ikut).

**Keputusan desain:**
- **Sumber client = `@suka/auth` (`createSupabaseBrowserClient`)**, bukan `@/lib/supabase` lokal tiap app. Membuat paket app-agnostik + memakai browser client singleton yang benar (cookie/session konsisten lintas app).
- **Konvensi nama channel = stabil per-scope** (mis. `sj-${outletId}`), **bukan** `Math.random()` per-mount. Nama stabil + cleanup andal (`removeChannel` di cleanup effect) = dedup benar & tak bocor channel. Divergensi absensi (random) diperbaiki saat repoint.
- `lib/realtime` lokal di absensi & stok **dihapus**, semua consumer di-repoint ke `@suka/realtime`.

**Konsekuensi kerja (gotcha):** consumer meng-import dari `dist/`, jadi tiap edit `packages/realtime/src` **wajib `yarn build`** dulu sebelum app melihat perubahan (identik gotcha `@suka/auth`). Util realtime jarang diedit → harga ini kecil.

---

## 4. Bunuh firehose — aman, *replace-before-remove*

**Prinsip keamanan:** firehose **hanya** berguna untuk update **lintas-sesi/lintas-device** (orang/device lain mengubah data). Mutasi di tab sendiri sudah invalidate query-nya via React Query `onSuccess`. Maka aturan per-query:

> Query X butuh pengganti sub scoped **hanya jika** (a) datanya bisa diubah sesi/device lain **dan** (b) layar ini perlu lihat perubahan itu tanpa refresh. Kalau tidak → cabut firehose = nol dampak.

Tiap query yang *kebetulan* dapat realtime dari firehose diganti sub scoped eksplisit **dulu**, baru firehose dicabut. Urutan by-risiko, dengan **uji lintas-device (2 browser) tiap app**:

1. **pos-kasir** — 🟢 risiko rendah. Realtime asli sudah di channel dedicated (`OrderNotification`, `KasirMenuClient` channel sendiri) + invalidate eksplisit pasca-mutasi (`['orders', outletId]`, `['target_progress', outletId]`, `['histori']`). Firehose redundan → verifikasi tak ada yatim → cabut.
2. **admin-dashboard** — 🟡 rendah–sedang. Jalur sales sudah dipegang `useSalesRealtime` + `useTargetProgress`. Ganti sub eksplisit yang benar-benar numpang firehose: `['expenses']`, `['payroll']`. (`['staff']` & `['cash-advances']` sudah mati karena beda nama tabel — cabut tak mengubah apa pun) → cabut.
3. **finance** — 🔴 risiko tertinggi. Firehose adalah **satu-satunya** realtime-nya (tak ada channel dedicated). Pasang set scoped lengkap **dulu**: `cash_transaction`, `cash_balance`, `cash_location`, `petty_cash_topups`, `po_payable`. Uji lintas-device → baru cabut.

`GlobalRealtimeProvider.tsx` dihapus dari tiap app di akhir langkahnya (juga dari `Providers.tsx`).

---

## 5. Publication & REPLICA IDENTITY

**Di mana biaya sebenarnya:**
- Publication membership → server Realtime men-*decode* setiap perubahan tabel itu (biaya server-side, tetap kena walau nol subscriber).
- Client subscription → fan-out ke browser (biaya jaringan + refetch).

Biaya terbesar yang kita rasakan (event mubazir membanjiri tiap browser) berasal dari **subscription wildcard**, bukan publication. Membunuh firehose sudah menghapusnya.

**Keputusan: publication dibiarkan permisif** (`enable_realtime_all` tetap). Memangkas jadi allowlist **berisiko** di project ini:
- DB **shared** dengan dev lain yang aktif push migration (drift rutin, terdokumentasi berkali-kali di CLAUDE.md).
- Fitur di app tak-teraudit (atau kerja dev lain) yang diam-diam mengandalkan sebuah tabel ada di publication → **mati senyap** bila dipangkas — persis penyakit "mati diam-diam" yang diberantas sesi ini.

Biaya decode server-side diterima sebagai trade-off. Bila kelak terbukti jadi beban nyata (metrik Supabase Realtime), pemangkasan publication = **proyek terpisah** dengan audit repo-penuh lebih dulu.

**`REPLICA IDENTITY FULL` selektif & aditif** — hanya pada tabel yang sub-nya memakai `filter=` atau butuh event `DELETE` (agar event ter-filter / baris "hilang" lolos ke client). `permintaan_bahan` sudah (`20260615000400`). Tambah `surat_jalan` (§6). Migration idempotent; aditif — tak mematikan apa pun.

---

## 6. Distribusi realtime (isi celah)

**Inkonsistensi yang diluruskan:** `useSuratJalanList` & `useTerimaList` memakai `useEffect + useState` manual (bukan React Query, beda dari seluruh suite). Migrasikan ke **React Query** dulu, lalu abstraksi kanonik langsung pas.

**Surface (3, semuanya titik tunggu nyata):**

| # | Layar | Siapa | Trigger live | Sub |
|---|---|---|---|---|
| 1 | Terima / Pengiriman outlet | Outlet | Pusat "kirim" → SJ baru muncul | `surat_jalan` filter `outlet_id=eq.{outlet}` → invalidate list terima |
| 2 | Daftar Surat Jalan pusat | Pusat | Outlet verifikasi terima → status flip | `surat_jalan` (semua outlet) → invalidate list SJ |
| 3 | Permintaan Bahan | Pusat & outlet | Outlet buat / pusat approve | `permintaan_bahan` (publication siap) |

- `REPLICA IDENTITY FULL` pada `surat_jalan` (karena filter `outlet_id`).
- **Payoff lintas-app:** outlet bisa berada di stok *atau* distribusi; paket `@suka/realtime` yang sama dipakai dua app → satu perubahan status `surat_jalan` menyalakan layar di app mana pun. Ini pembenaran konkret paket bersama (§3).

Status kanonik `surat_jalan` (dari kode): `draft → dikirim → diterima_lengkap | diterima_sebagian → selesai`.

---

## 7. Verifikasi

Tiap app:
- `yarn type-check` + `yarn build` bersih.
- **Uji lintas-device 2-browser**: ubah data di browser A (mis. approve cuti / kirim SJ / setor kas) → muncul live di browser B **tanpa refresh**. Ini gerbang "selesai" tiap langkah cabut-firehose & tiap surface distribusi.
- Unit test `createDebouncer` & `subsSignature` ikut ke paket (pindah dari `lib/realtime`).
- Migration diverifikasi **ground-truth** (`SELECT … FROM pg_publication_tables` + `relreplident='f'` via `supabase db query --linked`), **bukan** mengandalkan `supabase migration list` (riwayat DB shared terbukti berubah antar-pengecekan).

---

## 8. ADR yang akan ditulis

- **ADR-0014** — `@suka/realtime` paket bersama sebagai abstraksi realtime kanonik (vs modul diduplikasi). Catat preseden lawan: printLayout sengaja menolak paket bersama demi "hindari friksi build/deploy dist"; bedanya realtime = infrastruktur yang bug-nya menyebar ke semua app, nilai satu-sumber jauh lebih tinggi.
- **ADR-0015** — Publication permisif + bunuh firehose client (vs pangkas allowlist). Alasan: keamanan di DB shared; biaya nyata ada di subscription, bukan publication membership.

---

## 9. Ringkasan keputusan

1. Abstraksi kanonik = paket bersama `@suka/realtime` (client dari `@suka/auth`, nama channel stabil per-scope).
2. Firehose dibunuh per-app, replace-before-remove, urutan pos-kasir → admin-dashboard → finance, uji lintas-device tiap langkah.
3. Publication dibiarkan permisif; `REPLICA IDENTITY FULL` ditambah selektif (aditif).
4. Distribusi: `useSuratJalanList`/`useTerimaList` → React Query, lalu 3 surface realtime; `REPLICA IDENTITY FULL` pada `surat_jalan`.
5. Verifikasi = type-check + build + uji lintas-device 2-browser + ground-truth migration check.
