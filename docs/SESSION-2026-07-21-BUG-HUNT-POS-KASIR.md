# Session 2026-07-21: Bug Hunt POS-Kasir — 8 Temuan, 4 Diperbaiki

**Branch:** `fix/bom-reversal-regression-dan-xss-approval`
**Metode:** systematic-debugging (root cause dulu, verifikasi ground-truth di DB live sebelum menyimpulkan)

Sweep `type-check` seluruh workspace **bersih 0 error** (pos-kasir, finance, distribusi, portal, owner-dashboard), jadi seluruh temuan di bawah adalah bug logika/otorisasi — bukan sesuatu yang tertangkap compiler.

---

## Ringkasan

| # | Temuan | Dampak | Status |
|---|---|---|---|
| P1 | Reversal BOM over-restore (regresi) | stok hantu | ✅ **live di DB** |
| P5 | Stored XSS di halaman approval | curi sesi lintas-app | ✅ commit, perlu redeploy |
| P6 | Rupiah pecahan dari promo persentase | setoran laci meleset | ✅ commit, perlu redeploy |
| P8 | Oracle status (token dicek belakangan) | kebocoran info | ✅ commit, perlu redeploy |
| P3 | Pemohon pegang kunci persetujuannya sendiri | absensi & uang | ⏸ butuh keputusan |
| P4 | PIN seragam + endpoint mati | laten | ⏸ butuh keputusan |
| P7 | Nilai balik RPC promo dibuang | diskon tak tercatat | ⏸ butuh keputusan |
| P2 | Reject pembatalan reset status buta | order hantu | ⏸ butuh keputusan |

---

## ✅ P1 — Reversal BOM over-restore (regresi senyap)

**Commit:** `a29e3812` · **Migration:** `20300103000006_fix_bom_reversal_regression.sql` (applied & verified)

### Akar masalah: ranjau timestamp tahun 2030

Ada **8 migration bertimestamp tahun 2030** (`20300101000000`–`20300103000005`). Karena migration diurutkan berdasarkan nama, file-file ini **selalu jalan paling akhir** — mengalahkan setiap perbaikan bertanggal wajar.

Dua di antaranya (`20300103000001`, `20300103000003`, fitur menu packages) menyalin basis `trg_process_bom_stok` dari versi **sebelum 8 Juli**, sehingga membuang dua kerja tanpa ada yang sadar:

| Kerja yang hilang | Bukti di DB live |
|---|---|
| Reversal idempoten (`20260708110000`) | reversal = loop per-baris, tanpa `GROUP BY/HAVING` |
| Fitur `item_name` (`20260715000000`) | `pg_get_functiondef LIKE '%item_name%'` → **false** |

`CREATE OR REPLACE` tidak pernah mengeluh saat menimpa — itulah kenapa regresinya senyap.

### Bug-nya seperti apa

Pemicu = **siklus batal berulang**: `selesai → batal → selesai lagi → batal lagi`.

| | Nilai |
|---|---|
| Potongan yang benar-benar tersisa | −300 g |
| Versi lama mengembalikan | 600 g → **stok hantu +300 g** |
| Versi baru mengembalikan | 300 g → sisa 0 ✅ |

Kuncinya: `SUM` harus mencakup `adjustment` juga, supaya pengembalian yang sudah terjadi ikut terhitung.

> ⚠️ **Catatan koreksi:** analisis awal keliru menyebut pemicunya "order di-`completed` dua kali lalu dibatalkan". Dalam skenario itu versi lama dan baru menghasilkan angka identik. Simulasi read-only yang memaksa koreksi ini.

### Kerusakan nyata: NOL

```
over_restored_pairs : 0
voids_processed     : 0   ← blok reversal belum pernah tereksekusi
```

Seluruh 24 order batal dibatalkan **sebelum** sempat `completed`. Ini perbaikan preventif.

**Eksposur:** Kitchen Pusat punya BOM aktif (1.856 baris) **dan** 22 pembatalan — kedua syarat sudah berkumpul di satu outlet.

### Kenapa tidak me-rename file 2030

Semua 8 migration sudah `applied` dan riwayatnya **bersih** (lokal ↔ remote cocok, nol orphan). Rename akan memaksa `migration repair` tanpa perlu. Cukup menulis migration baru bernomor **setelah** yang terakhir (`20300103000006`).

> 🚩 **Utang teknis:** timestamp 2030 tetap jadi "lantai". Migration baru bertanggal 2026/2027 untuk fungsi ini **akan tertimpa** saat build dari nol. Peringatan sudah ditulis di akhir file migration. Merapikannya = pekerjaan tersendiri.

**Selalu jalankan sebelum menyentuh fungsi DB:** `grep -rn "<nama_fungsi>" supabase/migrations/`

---

## ✅ P5 — Stored XSS di halaman persetujuan

**Commit:** `5a5d92c3` · [bypass/approve](../apps/pos-kasir/app/api/bypass/approve/route.ts) · [topup/approve](../apps/pos-kasir/app/api/topup/approve/route.ts)

4 titik injeksi masuk mentah ke template HTML: `outletName`, `requested_by_name`, `reason`, `description`. Dua di antaranya diketik langsung oleh crew/kasir.

### Pengganda: cookie sesi lintas-subdomain

[`packages/auth/src/supabase-client.ts`](../packages/auth/src/supabase-client.ts):

```ts
domain: '.sukashawarma.com'   // berlaku di SEMUA app
maxAge: 31536000              // 1 tahun
```

Cookie tidak `httpOnly` (memang tak bisa — JS browser perlu membacanya). Skrip di halaman approval bisa membaca `document.cookie` dan mencuri sesi **SPV/owner**, berlaku di stok, absensi, finance, admin-dashboard, distribusi — selama setahun.

Halaman ini dibuka dari WhatsApp oleh pemegang otoritas tertinggi. Itu kombinasi terburuknya.

### Perbaikan

- `esc()` di 4 titik injeksi
- **CSP di 19 respons HTML**: `default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'` — mematikan eksekusi skrip total, menutup seluruh kelas serangan (bukan cuma titik yang sudah diketahui)
- Tombol "Tutup Halaman" dari `onclick` inline → `<a href>`, karena inline handler justru diblokir CSP-nya sendiri
- `id`/`token` di atribut form lewat `encodeURIComponent`

**Kenapa escape, bukan filter input:** RLS `bypass_requests` INSERT masih `WITH CHECK (true)`, jadi payload bisa ditanam langsung ke DB tanpa menyentuh UI. Pertahanan harus di titik render.

**Data produksi bersih** saat perbaikan dibuat: 0 dari 75 bypass_requests / 33 topup / 24 outlet mengandung karakter HTML.

Titik interpolasi lain sudah diaudit dan aman: `status` dibatasi CHECK constraint → literal; `title`/`message`/`icon` selalu string dari kode; `amountStr` numerik.

---

## ✅ P6 — Rupiah pecahan

**Commit:** `6fc8e9f5` · [promo-calculator.ts](../apps/pos-kasir/lib/promo-calculator.ts)

`Math.round` ditambahkan di 4 titik pengembalian. Dibulatkan di **harga satuan**, bukan total — supaya `unit_price × qty = subtotal` tetap konsisten di struk. Kalau dibulatkan di total, rincian struk tidak menjumlah dan itu lebih membingungkan kasir daripada bugnya.

**Eksposur saat ini nol:** 536 order tidak ada yang pecahan; kelima persentase yang terpakai (10/20/40/70/80%) menghasilkan nilai bulat untuk seluruh 23 harga menu. Bug baru menggigit pada diskon seperti 15%/33% atau harga tak bulat.

Kolom uang `numeric(10,2)` — DB **menerima** pecahan, jadi nol-nya bukan karena DB menolak.

**Test baru** (sebelumnya fungsi ini tak punya test sama sekali): 4 kasus pembulatan + 6 kasus regresi yang mengunci perilaku existing. **4 gagal sebelum fix → 10/10 lolos sesudah.**

---

## ✅ P8 — Oracle status

**Commit:** `a18f74e2`

Validasi `approval_token` dipindah ke paling atas, sebelum cabang status apa pun. Sebelumnya pemegang `id` saja bisa memastikan pengajuan itu ada dan tahu statusnya.

- Perbandingan constant-time (`timingSafeEqual`), seragam dengan `/api/orders/update-status`
- Pesan "tidak ditemukan" dan "token salah" **disamakan** — kalau dibedakan, oracle-nya cuma bergeser
- `POST` juga ikut `timingSafeEqual`

---

## ⏸ P3 — Pemohon pegang kunci persetujuannya sendiri

**Belum diperbaiki. Butuh keputusan arsitektur.**

Ini **satu cacat arsitektur**, bukan dua bug terpisah: *pihak yang mengajukan ikut memegang kunci persetujuannya.*

### Bypass absensi — tanpa token sama sekali

[`BlockedOverlay.tsx`](../apps/pos-kasir/components/BlockedOverlay.tsx):

```ts
.insert({...}).select('id').single()          // crew menerima id
const approveLink = `${appUrl}/api/bypass/approve?id=${insertedRequest.id}`
```

**Link persetujuan disusun di browser crew sendiri**, lalu ditaruh di pesan WA yang crew sendiri kirim. Crew tinggal tidak mengirimnya dan membukanya sendiri → POS terbuka tanpa absen. Tidak perlu menebak UUID, tidak perlu dev tools.

RLS-nya terbuka penuh — dan nama policy-nya menyesatkan:

| Nama policy | Ekspresi asli |
|---|---|
| "Kasir can view … **for their outlet**" | `USING (true)` |
| "**SPV** can update bypass requests" | `USING (true)` |
| "Kasir can insert bypass requests" | `WITH CHECK (true)` |

Niatnya ditulis di nama, tidak pernah diimplementasikan. Akibatnya 75 pengajuan dari 6 outlet terbaca & ter-update siapa pun yang login.

### Top-up petty cash — token dibuat pemohon

[`shift/page.tsx:368`](../apps/pos-kasir/app/kasir/shift/page.tsx): `const approvalToken = crypto.randomUUID()` — **di browser kasir**. Kasir memegang `id` + `token`, bisa menyetujui pengajuan uangnya sendiri.

RLS tabel ini justru **benar** (ter-scope `accessible_outlet_ids()`, tanpa policy UPDATE). Terpakai nyata: 33 pengajuan, 10 disetujui, **Rp 1.320.000**.

### Kenapa "tambahkan token" tidak menyelesaikan

Selama perangkat pemohon ada di jalur pembuatan/pengiriman link, ia tetap memegang kuncinya. Token server-side pun bocor karena **RLS SELECT mengembalikan semua kolom** ke pemohon yang baru meng-insert baris.

### Opsi

| Opsi | Keamanan | Beban SPV |
|---|---|---|
| **A. Otoritas via sesi login** (disarankan) | tuntas, teraudit | harus login |
| B. Token server-side disembunyikan | lebih baik, masih rapuh — butuh pengirim WA sisi server yang belum ada | tetap satu tap |
| C. Hanya hardening #1–#4 | tak menutup self-approval | tak berubah |

**Hardening yang perlu apa pun pilihannya:**
1. **RLS `bypass_requests` di-scope** + cabut UPDATE dari klien ← *paling mendesak, tak mengubah alur kerja siapa pun*
2. Kolom `approved_by`, `approved_at`, `expires_at`
3. Larangan self-approval eksplisit (penyetuju ≠ pemohon)
4. Kadaluarsa link

> ⚠️ Dari 39 bypass + 10 top-up yang sudah disetujui, **tidak bisa diketahui mana yang self-approved** — kolom penyetuju tak pernah ada. Tidak dapat dipulihkan retrospektif.

---

## ⏸ P4 — PIN seragam + endpoint mati

**Belum diperbaiki. Butuh keputusan: fitur ini dipakai atau dibuang?**

| Fakta terverifikasi | Nilai |
|---|---|
| Staff punya PIN | 66 |
| PIN **unik** di antara 66 itu | **1** ← semua sama |
| Termasuk default umum (`123456` dsb) | **ya** |

Sebaran: crew 34, leader 10, admin 4, kitchen 2, **spv 1**. PIN "otorisasi supervisor" identik dengan PIN 34 crew.

Kolom `pin` juga terbaca klien: `authenticated` punya `SELECT` tanpa pembatasan kolom, RLS `outlet_staff` mengizinkan baca satu outlet → crew bisa `select('pin')` rekan sekaligus SPV-nya. Tidak perlu brute-force.

**Tapi dampaknya hari ini nol:** `grep -rn "verify-pin"` di seluruh repo → **tidak ada call site**. Endpoint ini kode mati; PIN tidak menjaga apa pun.

> **Koreksi:** analisis awal menyebutnya "gerbang otorisasi aksi supervisor di POS" — itu kesimpulan dari nama file tanpa memeriksa pemanggilnya.

Penulisan PIN terkunci benar (admin / supervisor outlet sendiri / service_role). Policy `USING (true)` yang sempat dicurigai ternyata hanya berlaku untuk `{service_role}` — aman.

**Risiko = ranjau:** endpoint masih hidup & tanpa login (oracle PIN), dan begitu ada yang menyambungkannya ke fitur nyata, fitur itu lahir tanpa keamanan sejak hari pertama.

**Kalau dibuang** (disarankan): hapus route, `REVOKE SELECT (pin)`, kosongkan kolom.
**Kalau dipakai:** PIN unik per orang **dulu** (#1) → hash → revoke → rate-limit. Menaikkan panjang PIN percuma selama satu PIN dipakai 66 orang.

---

## ⏸ P7 — Nilai balik RPC promo dibuang

**Belum diperbaiki. Butuh keputusan kecil.**

> **Koreksi:** analisis awal menyebut "cek limit dan increment tidak atomik". **Salah.** RPC `increment_promo_usage` di DB live sudah defensif: `SELECT … FOR UPDATE` + cek limit + `RETURN FALSE`. `current_usage` tidak akan pernah melewati `usage_limit`.

Bug sebenarnya ada di **ketiga pemanggil** — [checkout:216](../apps/pos-kasir/app/api/checkout/route.ts), [manual:278](../apps/pos-kasir/app/api/orders/manual/route.ts), [walk-in:269](../apps/pos-kasir/app/api/orders/walk-in/route.ts):

```ts
const { error: incError } = await supabaseService.rpc('increment_promo_usage', ...)
if (incError) { console.error(...) }      // ← `data` (true/false) tak pernah dilihat
```

Order sudah terbuat **sebelum** RPC dipanggil. Saat beberapa checkout masuk bersamaan di kuota terakhir, semuanya memberi diskon; RPC menolak sebagian, tapi penolakan itu dibuang.

> Kuota 100 tersisa 3, delapan checkout serentak → 3 tercatat, **5 order tetap dapat diskon tanpa tercatat**. Counter berhenti rapi di 100, jadi dari laporan semuanya tampak normal — lebih sulit terdeteksi daripada counter jebol.

**Perbaikan jauh lebih sederhana dari rencana awal:** baca `data`, tangani `false`. Tidak perlu menyentuh DB.

**Keputusan:** order yang kena kuota-habis dibiarkan lolos dengan diskon (rugi beberapa porsi, kasir tak terganggu) atau checkout digagalkan (benar akuntansinya, antrean terganggu)? **Saran: yang pertama**, plus catat kejadiannya.

**Konteks:** seluruh 167 promo sedang `is_active = false` — P6 & P7 dorman, akan hidup saat promo pertama dinyalakan.

---

## ⏸ P2 — Reject pembatalan reset status buta

**Belum diperbaiki. Butuh keputusan semantik.**

[cancellations/action:63](../apps/pos-kasir/app/api/cancellations/action/route.ts):

```ts
status: newStatus === 'approved' ? 'cancelled' : 'pending'   // reject → SELALU 'pending'
```

Status tujuan di-hardcode tanpa melihat status asal. Kalau order tadinya `completed`: uang hilang dari laporan, stok nyangkut terpotong (trigger hanya reverse pada `completed → cancelled`), dan penyelesaian ulang memotong bahan **dua kali**.

> **Turun prioritas setelah verifikasi:** alur nyatanya order menunggu persetujuan di status `preparing:pending_approval`, bukan `completed`. Jadi reject saat ini hanya menurunkan `preparing → pending` — mengganggu, tapi tanpa dampak stok/uang. Bug tetap nyata, belum melukai siapa pun.

**Anomali belum ditelusuri:** ada 1 order `cancelled` **dengan** `cancellation_status='rejected'` — kombinasi yang mustahil dihasilkan kode yang dibaca.

**Solusi:** simpan `previous_status` saat request dibuat dan kembalikan ke situ; atau lebih bersih — jangan pernah menurunkan order dari `completed`, cukup ubah `cancellation_status`.

**Keputusan:** saat pembatalan order `completed` menunggu persetujuan, order itu di mata kasir statusnya apa — masih selesai, atau digantung? Komentar bingung di baris 49–57 file itu menunjukkan pertanyaan ini memang belum pernah dijawab.

---

## Verifikasi

| | Hasil |
|---|---|
| Test suite pos-kasir | ✅ **67/67 lolos** (nol regresi) |
| `tsc --noEmit` | ✅ 0 error |
| `npm run build` | ✅ sukses |
| Fungsi DB live pasca-migration | ✅ reversal idempoten, `item_name` pulih, fitur paket & allowlist & `SECURITY DEFINER` utuh |
| Trigger `trg_orders_bom_stok` | ✅ terpasang & enabled |

**Belum dilakukan:** smoke test browser (halaman approval pasca-CSP, banner, alur bypass nyata).

---

## Pelajaran metodologis

1. **Verifikasi ground-truth di DB live, jangan percaya file migration.** P1 akarnya ternyata bukan file yang dicurigai di awal; ditemukan lewat `pg_get_functiondef`.
2. **Simulasi read-only sebelum menulis fix.** Itu yang memaksa koreksi narasi P1 — angka lama dan baru ternyata identik di skenario yang semula disangka pemicu.
3. **Tiga analisis awal terbukti keliru** setelah diverifikasi (P1 pemicu, P4 dampak, P7 mekanisme), dan satu nyaris jadi laporan palsu (21 promo global disangka duplikat, ternyata 1 per outlet untuk 21 outlet). Nama file dan nama policy adalah **klaim**, bukan bukti.
4. **Nama yang menyesatkan menyembunyikan bug bertahun-tahun** — policy "for their outlet" yang isinya `USING (true)` lolos berkali-kali dari pembacaan sekilas.

---

## 📝 Next

**Segera:**
- [ ] **Redeploy `pos-kasir`** — P5, P6, P8 baru berlaku setelah ini
- [ ] Smoke test: buka halaman approval, pastikan CSP tak memblokir yang tak terduga
- [ ] **RLS `bypass_requests` di-scope** (bagian P3 yang tak butuh keputusan)

**Menunggu keputusan:**
- [ ] P3 — opsi A/B/C
- [ ] P4 — fitur PIN dipakai atau dibuang
- [ ] P7 — kuota habis: lolos dengan diskon, atau gagalkan checkout
- [ ] P2 — semantik order saat pembatalan menunggu persetujuan

**Utang teknis:**
- [ ] Rapikan 8 migration bertimestamp 2030 (pekerjaan tersendiri)
- [ ] Telusuri 1 order `cancelled` + `cancellation_status='rejected'`
- [ ] Satukan dua route approval yang menduplikasi ~100 baris HTML nyaris identik

---

**Last updated:** 2026-07-21
