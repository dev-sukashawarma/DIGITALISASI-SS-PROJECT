# Kasbon: HR Menyetujui Nilai, Finance Mencairkan Uang

**Tanggal:** 2026-11-13
**Status:** Rancangan, menunggu persetujuan owner
**Menyentuh:** DB (Supabase), `apps/finance`, `apps/HR`, `apps/admin-dashboard`, `apps/absensi`, `apps/bot`

## 1. Maksud & alasan

Hari ini kasbon hanya punya satu gerbang. Begitu HR menekan **Setujui**
(`apps/HR/src/hooks/useCashAdvanceMutations.ts` `approve`), kasbon langsung
`status='active'`. Artinya kasbon itu dianggap sudah berjalan: masuk ke potongan
gaji di slip payroll dan bisa dicicil. Padahal tidak ada yang mencatat kapan
uangnya keluar, dari rekening mana, dan oleh siapa. Per 13 Nov 2026,
`cash_transaction` memuat **0** baris kasbon, sementara 54 kasbon sudah
disetujui (±Rp 16,8 jt).

Keputusan owner (13 Nov 2026):

> HR hanya menyetujui **nilai** kasbon. Yang mengeluarkan uang adalah tim
> **finance**. Yang boleh mengubah pengajuan kasbon hanya HR; finance hanya
> mencairkan atau menolak.

Keputusan lanjutan owner (13 Nov 2026, atas pertanyaan pemeriksa):

1. **Kasbon manual di slip gaji ditutup.** Potongan kasbon di slip hanya boleh
   berasal dari kasbon yang sudah dicairkan finance. Kasbon di luar sistem
   harus diinput sebagai pengajuan, lalu dicairkan finance.
2. **Pencairan bisa dibatalkan oleh finance** selama belum ada cicilan.
   Transaksi rekening di-void (bukan dihapus), lalu kasbon kembali ke
   *menunggu pencairan*.
3. **Yang mencairkan harus orang lain dari yang menyetujui di HR.**

Sukses berarti:
1. Tidak ada kasbon yang dipotong dari gaji sebelum uangnya benar-benar keluar.
2. Setiap kasbon yang cair tercatat di Rekening & Mutasi, lengkap dengan
   rekening sumber, bukti, pelaku, dan jam.

## 2. Tujuan, bukan-tujuan, anti-tujuan

**Tujuan**
- Alur dua tahap: crew mengajukan, lalu HR menyetujui nilai (status
  *menunggu pencairan*), lalu finance mencairkan (status *aktif*, mulai dipotong
  gaji) atau menolak (final).
- Finance mencairkan dari **Hub Approval** di app finance, dengan memilih
  **Rekening Petty Cash Bank** atau **Rekening Petty Cash Tunai**.
- Saldo rekening terpotong dan tercatat (`cash_transaction`, `source_type='kasbon'`).
- Crew melihat bedanya "disetujui, menunggu pencairan" dan "sudah dicairkan".

**Bukan tujuan**
- Mengubah cara cicilan atau potongan gaji dihitung.
- Mengubah alur pengajuan crew di app absensi.
- Pencairan otomatis atau transfer bank lewat API.
- Membereskan semua bug lama di modul kasbon admin-dashboard, kecuali yang
  bersinggungan langsung (lihat §6.4).

**Anti-tujuan** (dianggap gagal walau secara teknis jalan)
- Kasbon berstatus *menunggu pencairan* ikut terpotong dari gaji di jalur mana pun.
- Finance bisa mengubah nominal, cicilan, atau alasan kasbon.
- HR, atau app versi lama yang masih terbuka di browser, bisa membuat kasbon
  langsung "aktif" tanpa lewat finance.
- Cicilan bisa dicatat pada kasbon yang belum dicairkan.

## 3. Kondisi sekarang yang relevan

- `cash_advances.status`: CHECK `cash_advances_status_check` hanya
  `'active'`/`'paid_off'`, default `'active'`. Kolom ini adalah **siklus uang**.
  Pengajuan pending pun berstatus `'active'` karena default; yang membedakannya
  adalah `status_hr`.
- `cash_advances.status_hr`: `pending|approved|rejected`. Ini persetujuan HR.
- Tabel aslinya **tidak ada di migration mana pun**. Migration baru harus
  `DROP` lalu `ADD` CHECK-nya.
- Potongan gaji (HR `usePayrollMutations.ts` generate/sync/finalize,
  `PayrollSlipForm.tsx`, `actions/users.ts` prorata) mensyaratkan
  `status='active' AND status_hr='approved'`.
- RLS: tulis = `is_hr_pusat()` (admin, admin_hr, owner, developer). **Finance
  (`admin_finance`) tidak bisa UPDATE `cash_advances`.**
- `cash_transaction_source_type_check` **sudah memuat `'kasbon'`**.
- Rekening Petty Cash: bank `b0955381-0040-4c0e-9a11-5e70a0000002`, tunai
  `b0000000-0ff1-4c0e-9a11-5e70a0000003` (`grup='petty_cash'`, `scope='pusat'`).
- Pola pencairan yang ditiru: `finance_process_petty_cash_custom`
  (migration `20261105107000`). Pola yang dipakai: cek peran `kas_pencatat_ok()`
  atau developer, kunci baris pengajuan `FOR UPDATE`, rekening harus
  `grup='petty_cash'` + aktif + `kind` sesuai metode, saldo dikunci
  `cash_balance FOR UPDATE` lalu dicek cukup, lalu `INSERT cash_transaction`
  (`direction='out'`, `status='paid'`).
- Hub Approval finance: `src/lib/approval/hub.ts` (`HubJenis`, `URUTAN_JENIS`,
  `JENIS_LABEL`), `src/hooks/useHubApproval.ts` (+ `useHubApprovalCount`),
  `src/app/approval/*`. Riwayatnya ada di tabel `approval_log`, diisi trigger;
  CHECK `jenis` saat ini `petty_cash|po|bayar_vendor|dana_kantor`, dan nama
  pelaku wajib dari `approval_log.pelaku_nama` karena RLS menahan join ke staf.
- Bukti finance diunggah ke bucket storage `finance-proofs`.

Peta lengkap pembaca dan penulis status kasbon (hasil audit 13 Nov) ada di §6.

## 4. Pendekatan

| | Cara | Pertukaran |
|---|---|---|
| **A (dipilih owner)** | Nilai baru `status='menunggu_cair'`. HR setuju menghasilkan `menunggu_cair`; finance cair menghasilkan `active`. | Sesuai makna kolom (siklus uang). Semua rumus potong gaji sudah mensyaratkan `active`, jadi kasbon yang belum cair otomatis tak terpotong. Kelemahannya, layar yang menampilkan status harus mengenal nilai baru; kalau ada yang terlewat, salahnya di tampilan, bukan di uang. |
| B | Status tetap `active`, tambah penanda `dicairkan_at`; semua pembaca ditambah syarat. | Satu pembaca yang terlewat berarti karyawan dipotong untuk uang yang belum diterima. Kesalahannya senyap, dan pembacanya >10. |
| C | Tabel pencairan terpisah. | Kasbon hanya cair sekali, jadi tabel tambahan ini tidak memberi apa-apa. |

## 5. Rancangan

### 5.1 Siklus status

```
crew ajukan ─▶ status_hr=pending, status=active (default lama, tak diubah)
   │
   ├─ HR tolak ───────────▶ status_hr=rejected                          (final)
   └─ HR setuju (nilai) ──▶ status_hr=approved, status=menunggu_cair
          │
          ├─ finance tolak ─▶ status_hr=rejected, ditolak_finance_*      (final)
          └─ finance cair ──▶ status=active  ──(cicilan/payroll)──▶ paid_off
                    │
                    └─ finance batal cair (belum ada cicilan) ─▶ kembali menunggu_cair
```

- HR yang **membuat kasbon langsung** (tombol tambah di HR/admin-dashboard)
  juga menghasilkan `approved + menunggu_cair`. Tidak ada jalan pintas.
- **Tolak finance = final** (keputusan owner). Crew mengajukan ulang bila perlu.

### 5.2 Database (satu migration, timestamp hari ini)

**Kolom baru di `cash_advances`:**
`dicairkan_at timestamptz`, `dicairkan_oleh uuid`, `dicairkan_dari uuid`
(FK `cash_location`), `metode_cair text` (`transfer|tunai`), `bukti_cair text`
(path di `finance-proofs`), `cash_transaction_id uuid`, `ditolak_finance_at
timestamptz`, `ditolak_finance_oleh uuid`.

**CHECK** `cash_advances_status_check` → `active|paid_off|menunggu_cair`.

**Trigger penjaga `BEFORE INSERT OR UPDATE` di `cash_advances`** (lapisan
utama; mencegah app versi lama yang masih terbuka di browser, AksiBot, dan skrip
melewati finance):
- Saat `status_hr` menjadi `approved` (INSERT, atau UPDATE dari `pending`) dan
  `status` bukan `paid_off`: paksa `status := 'menunggu_cair'`, apa pun yang
  dikirim klien. `paid_off` dibiarkan (impor data lama `bulkImportStaff`,
  fallback finalisasi payroll).
- `status` berubah dari `menunggu_cair` ke `active`: **ditolak** kecuali flag
  transaksi `app.kasbon_cair = 'on'`, yang hanya dipasang oleh RPC pencairan.
- `status` berubah dari `active` kembali ke `menunggu_cair`: ditolak kecuali
  flag `app.kasbon_cair = 'on'` (hanya RPC batal pencairan).
- Selama `status='menunggu_cair'`, `amount`, `remaining`, `installment_months`
  boleh diubah HR (koreksi sebelum cair). Saat cair, `remaining := amount`.
- **Setelah cair (`active`/`paid_off`)**: `amount` dan `installment_months`
  dikunci; `remaining` hanya boleh turun (cicilan/payroll). *(Keputusan
  builder.)*
- `status_hr` hanya boleh menjadi `rejected` dari `pending`, atau dari
  `approved` selama `status='menunggu_cair'`. Kasbon yang sudah cair tidak bisa
  ditolak, karena uangnya sudah keluar tapi tak akan pernah dipotong.
  *(Keputusan builder.)*
- Saat `status_hr` menjadi `approved`, isi `approved_by := auth.uid()` dan
  `approved_at := now()` bila kosong. Kolom ini kosong di 49 kasbon lama; ia
  dipakai untuk aturan "orang berbeda" dan ditampilkan di Hub.
- **Kasbon manual di slip ditutup (keputusan owner 1):** dari sesi user
  (`auth.uid()` tidak NULL), INSERT dengan `status='paid_off'` atau `'active'`
  ditolak. Impor staf massal (`bulkImportStaff`, service role,
  `auth.uid()` NULL) tetap boleh memasukkan riwayat `paid_off`.

**Trigger penjaga `BEFORE INSERT` di `cash_advance_payments`:** menolak cicilan
bila kasbon induknya bukan `status='active'`.

**RPC (SECURITY DEFINER, `SET search_path=public`, REVOKE dari PUBLIC/anon):**

`finance_cairkan_kasbon(p_id uuid, p_cash_location_id uuid, p_bukti text)`
1. Peran: `kas_pencatat_ok()` atau developer aktif. Selain itu ditolak.
2. `SELECT … FOR UPDATE` kasbon; wajib `status_hr='approved' AND status='menunggu_cair'`.
   Tolak bila `auth.uid() = approved_by` ("pencairan harus oleh orang lain dari
   yang menyetujui di HR", keputusan owner 3). Kasbon `approved_by` NULL
   (hanya kasbon lama) tidak terhalang aturan ini.
3. Rekening: aktif, `grup='petty_cash'`, `scope='pusat'`. `metode_cair`
   diturunkan dari `kind` (`bank` → `transfer`, `cash` → `tunai`).
4. Bukti wajib (tidak kosong).
5. `cash_balance FOR UPDATE`; tolak bila saldo < `amount`.
6. `INSERT cash_transaction` (`amount`, `direction='out'`, `source_type='kasbon'`,
   `source_id=p_id`, `status='paid'`, `occurred_at=now()`, `created_by=auth.uid()`,
   catatan "Pencairan kasbon <nama staf>", bukti).
7. Pasang `app.kasbon_cair='on'` (lokal transaksi), lalu UPDATE kasbon:
   `status='active'`, `remaining=amount`, kolom `dicairkan_*`, `cash_transaction_id`.

`finance_tolak_kasbon(p_id uuid, p_alasan text)`
- Peran sama; kunci baris; wajib `approved + menunggu_cair`; alasan wajib.
- `status_hr='rejected'`, `rejection_note='[Ditolak Finance] ' || alasan`,
  `ditolak_finance_at/oleh`. `status` tetap `menunggu_cair` (baris tolak tak
  pernah dibaca sebagai berjalan).

`finance_batal_cair_kasbon(p_id uuid, p_alasan text)` (keputusan owner 2)
- Peran sama; kunci baris; alasan wajib.
- Wajib `status='active'`, **tidak ada** baris `cash_advance_payments`, dan
  `remaining = amount` (belum pernah dipotong payroll).
- `cash_transaction` pasangannya di-void mengikuti pola `batal_top_up_saldo`
  (`status='void'` + alasan; tidak pernah DELETE). Saldo rekening kembali
  dengan mekanisme yang sama seperti batal Top Up; pembangun memverifikasi
  bahwa `cash_balance` memang ikut bergerak saat void.
- Pasang flag, lalu `status='menunggu_cair'`; kolom `dicairkan_*` dan
  `cash_transaction_id` dikosongkan. Kasbon muncul lagi di Hub dan bisa
  dicairkan ulang dari rekening yang benar.

**Riwayat Hub:** CHECK `approval_log.jenis` ditambah `'kasbon'`, dan
`keputusan` ditambah `'batal_cair'`. Trigger `trg_approval_log_kasbon` (tahan
galat, pola trigger approval_log yang ada) mencatat `setuju` saat
`menunggu_cair → active`, `tolak` saat penolakan finance, dan `batal_cair`
saat pencairan dibatalkan, dengan `pelaku_nama` terisi. Karena ada indeks unik
`(jenis, keputusan, sumber_id)`, pencairan ulang setelah batal memakai
`ON CONFLICT DO UPDATE`, sehingga yang tersimpan adalah pencairan terakhir.

**Fungsi ringkasan HR:** `hr_kasbon_daftar` menerima filter
`p_status='menunggu_cair'`. `hr_perizinan_ringkasan` menambah hitungan
`menunggu_cair` + nominalnya. Keduanya juga punya versi di migration 2030
(`20300254001100`), jadi definisi baru harus bersumber dari versi terakhir itu.

**Notifikasi crew:** push saat kasbon cair ("Kasbon Rp X sudah dicairkan").
Trigger push crew yang ada (`trg_crew_kasbon_status_push`) hanya mendengar
`UPDATE OF status_hr`, jadi pencairan butuh pemicu sendiri pada perubahan
`status`. Penolakan finance otomatis memicu push "ditolak" yang sudah ada
karena `status_hr` berubah; pastikan teksnya memuat alasan.

### 5.3 App finance

- `HubJenis` ditambah `'kasbon'` (label "Kasbon"). Sumber datanya kasbon
  `approved + menunggu_cair`, diurutkan dari `approved_at` (menunggu sejak HR
  setuju). Badge `useHubApprovalCount` ikut menghitung.
- Baris hub menampilkan nama staf, outlet, nominal, alasan, cicilan berapa
  bulan, catatan HR, dan siapa yang menyetujui di HR.
- Modal **Cairkan**: pilih rekening (Petty Cash Bank / Petty Cash Tunai, tampil
  dengan saldo terkini), unggah bukti (bank = bukti transfer, tunai = foto tanda
  terima bertanda tangan karyawan), lalu panggil `finance_cairkan_kasbon`.
  Nominal tampil **read-only**.
- Modal **Tolak**: alasan wajib, lalu `finance_tolak_kasbon`.
- Tombol **Batalkan pencairan** (alasan wajib → `finance_batal_cair_kasbon`)
  di baris riwayat pencairan kasbon. Tombol hanya tampil bila belum ada cicilan;
  DB tetap menjadi penjaga akhirnya.
- Bila yang membuka Hub adalah orang yang menyetujui kasbon itu di HR, tombol
  Cairkan dinonaktifkan dengan keterangan "Anda menyetujui kasbon ini di HR,
  pencairan harus oleh orang lain".
- Riwayat Hub menampilkan jenis kasbon. Rekening & Mutasi menampilkan
  `source_type='kasbon'` dengan label "Kasbon"; cek apakah label sudah ada.

### 5.4 App HR (dan salinannya di admin-dashboard)

- Mutasi `approve` & `create` mengirim `status: 'menunggu_cair'`. Trigger
  tetap jadi penjaga utamanya.
- `CashAdvanceStatus` ditambah `'menunggu_cair'`. Badge "Menunggu pencairan".
- `getEffectiveStatus` (`CashAdvanceTable.tsx:35-44`) saat ini memetakan semua
  yang `approved` ke "Aktif" lalu menampilkan **Bayar Cicilan**. Harus memetakan
  `menunggu_cair` tersendiri, tanpa tombol cicilan.
- `PerizinanModule` mendapat tab/ringkasan "Menunggu pencairan".
- Kasbon yang ditolak finance tampil sebagai "Ditolak (Finance)" dengan alasannya.
- `addPayment`: dijaga di UI; DB menolak lewat trigger §5.2.
- Slip payroll (`PayrollSlipForm`): bila staf punya kasbon `menunggu_cair`,
  tampilkan info "belum dicairkan, tidak dipotong".
- **Kasbon manual di slip ditutup (keputusan owner 1):**
  - Isian potongan kasbon di slip dibatasi sebesar sisa kasbon `active` staf
    (tidak bisa melebihi; nol bila tidak ada kasbon aktif). Sumber teks catatan
    yang dicocokkan regex sebagai kasbon juga tunduk ke batas ini.
  - Fallback finalisasi yang membuat kasbon `paid_off` baru saat tidak ada
    kasbon aktif (HR `usePayrollMutations.ts` ±699–711 & ±809–820) **dihapus**.
    DB juga menolaknya (§5.2).
  - `addPayment` (cicilan manual) dan pemotongan payroll hanya menyentuh kasbon
    `active`.
  - Salinan di admin-dashboard (`usePayrollMutations.ts` generate) disamakan,
    termasuk bug lamanya: ia hanya menyaring `status='active'` tanpa
    `status_hr`, sehingga kasbon pending ikut terpotong.
- admin-dashboard: `useCashAdvanceMutations` disamakan dengan HR untuk
  approve/reject/create. Versi sekarang rusak: approve tidak menyentuh
  `status_hr`, reject melanggar CHECK. Badge `CashAdvanceTable` mengenal
  status baru.

### 5.5 App absensi (crew)

`KasbonView` membedakan tampilan: Menunggu HR → **Menunggu pencairan**
(`approved + menunggu_cair`) → **Dicairkan** (tanggal cair) → Lunas; Ditolak
menampilkan alasan. Tipe `KasbonDisbursementStatus` ditambah nilai baru.

### 5.6 Bot & Hermes

- `admin-dashboard/src/lib/hermes/server/hrRinciSumber.ts` `statusKasbon`
  saat ini **membuang** baris yang tidak dikenali. Tambahkan `menunggu_cair`.
- `apps/bot/src/lib/server/telemetriNyata.ts:1637` (`.in('status',['pending','active'])`)
  ditambah `menunggu_cair` agar terlihat.
- Akumulasi bot CEO (`status<>'paid_off' AND status_hr IN ('pending','approved')`)
  sudah menghitung `menunggu_cair`. Biarkan, karena uangnya memang sudah terikat.

### 5.7 Data lama

- 5 kasbon `approved + active` (9 Okt–13 Nov) **dianggap sudah dicairkan** dan
  tidak disentuh. Kolom `dicairkan_*` dibiarkan kosong; tampilan menulis
  "dicairkan sebelum alur finance". Tidak dibuat `cash_transaction` mundur,
  karena rekening sumbernya tak diketahui dan saldo awal November sudah
  direkonsiliasi manual.
- 5 kasbon `pending` otomatis mengikuti alur baru saat HR menyetujuinya.
- 44 `paid_off` & 12 `rejected` tidak berubah.

## 6. Peta dampak (audit 13 Nov, ringkas)

| Tempat | Perlu diubah |
|---|---|
| HR `useCashAdvanceMutations` approve/create/addPayment | Ya (§5.4) |
| HR `CashAdvanceTable` `getEffectiveStatus` | Ya: bug "Bayar Cicilan" |
| HR `PerizinanModule` tab/ringkasan/CSV | Ya |
| HR payroll generate/sync, `actions/users.ts` | Tidak: sudah syarat `active` |
| HR payroll finalize (fallback kasbon `paid_off` baru) | **Ya: dihapus** (keputusan owner 1) |
| HR `PayrollSlipForm` | Ya: info + batas potongan kasbon |
| HR `AksiBot` (approve dari bot HRD) | Tidak: ikut `approve()`, dijaga trigger |
| admin-dashboard kasbon (mutasi, tabel) | Ya (§5.4) |
| admin-dashboard `usePayrollMutations` generate (hanya `status='active'`, tanpa `status_hr`, jadi kasbon pending ikut terpotong; bug lama) | Ya: disamakan dengan HR |
| Hermes `hrRinciSumber` | Ya (§5.6) |
| bot `telemetriNyata` | Ya (§5.6) |
| absensi `KasbonView`, tipe | Ya (§5.5) |
| DB `hr_kasbon_daftar`, `hr_perizinan_ringkasan` | Ya (§5.2) |
| DB `batalkan_kasbon` (crew batal hanya saat pending) | Tidak: crew tak bisa membatalkan setelah HR setuju |
| DB push/alert HRD, CEO, `kasbon_isi_push_hr` | Tidak, kecuali push cair baru |
| `hermes_kasbon_per_outlet` | Opsional: tambah hitungan menunggu cair |

## 7. Batasan

- Semua tulisan finance lewat RPC; RLS `cash_advances` tidak dilonggarkan
  untuk `admin_finance`.
- `kas_pencatat_ok()` untuk peran uang, **jangan `is_finance()`** (memuat spv,
  leader, dan lain-lain).
- Timestamp migration hari ini (lint menolak tanggal 2030). Fungsi yang juga
  didefinisikan di migration 2030 (`hr_kasbon_daftar`) menjadi utang replay,
  seperti preseden-preseden sebelumnya.
- Perubahan app terkirim otomatis saat merge ke `main` (`HR`, `admin`,
  `finance`, `absensi`, `bot`). Migration diterapkan **sebelum** app,
  karena trigger dan kolom baru harus sudah ada.

## 8. Diserahkan ke pembangun

- Nama dan tata letak komponen modal di Hub; pemakaian ulang komponen unggah bukti.
- Teks notifikasi push.
- Bentuk uji: verifikasi SQL `supabase/verifikasi/kasbon_cair/` + unit test
  fungsi murni hub/status. Uji SQL mencakup:
  - peran tanpa hak ditolak;
  - saldo kurang ditolak;
  - status salah ditolak;
  - pencair = penyetuju HR ditolak;
  - cicilan sebelum cair ditolak;
  - HR tidak bisa menulis `active`;
  - insert `paid_off` dari sesi user ditolak;
  - batal cair setelah ada cicilan ditolak;
  - batal cair mengembalikan saldo;
  - kontrol negatif.
- Label `kasbon` di Rekening & Mutasi bila belum ada.
