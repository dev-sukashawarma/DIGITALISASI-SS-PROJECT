# Rencana Implementasi: CRUD Petty Cash Admin yang Selaras dengan POS

## Tujuan

Merapikan fitur **Sistem > Saldo Petty Cash** agar Admin cukup mengisi satu nilai **Penyesuaian Petty Cash** per outlet. Sistem menentukan sendiri tujuan nilai tersebut berdasarkan status shift pada saat transaksi: menjadi modal awal jika belum ada shift aktif, atau menjadi saldo saat ini jika shift sudah aktif. Semua perubahan wajib memiliki catatan, masuk histori, dan langsung terbaca oleh kasir, Crew, Leader, Area Manager, serta proses tutup shift.

## Keputusan Model Data

Petty cash diperlakukan sebagai ledger, bukan dua saldo bebas:

```text
Saldo saat ini
= modal awal shift
+ top-up yang sudah masuk laci
+ penyesuaian Admin bertipe tambah
- pengeluaran aktif
- penyesuaian Admin bertipe kurang
```

- Admin hanya melihat satu input nominal: **Penyesuaian Petty Cash**. Nilai ini adalah **saldo target setelah penyesuaian**, bukan nominal tambah/kurang.
- Jika **tidak ada shift aktif**, nilai disimpan sebagai penyesuaian tertunda dan otomatis menjadi `starting_petty_cash` ketika shift berikutnya dibuka.
- Jika **ada shift aktif**, backend menghitung selisih terhadap saldo sistem dan menyimpannya sebagai mutasi adjustment. Contoh: saldo Rp164.950 disesuaikan menjadi Rp200.000 menghasilkan mutasi `+Rp35.050`.
- Admin tidak memilih mode “modal awal” atau “saldo saat ini”; status shift ditentukan ulang oleh database ketika tombol simpan diproses.
- **Modal awal** tetap merupakan saldo pembuka satu shift (`shifts.starting_petty_cash`), tetapi bukan field yang dapat diedit langsung dari UI Admin.
- **Saldo saat ini** tetap merupakan hasil perhitungan mutasi dan bukan field input terpisah.
- Top-up mengikuti alur persetujuannya sendiri dan tidak boleh diedit/hapus lewat CRUD saldo umum.
- Pengeluaran tidak dihapus permanen. Penghapusan adalah void/soft-delete dengan alasan agar saldo kembali dan audit tetap utuh.
- Jika shift dibuka bersamaan dengan Admin menekan simpan, satu transaksi database dan lock outlet menentukan tepat satu hasil: diterapkan ke shift yang sudah aktif atau dikonsumsi sebagai modal awal saat pembukaan shift, tidak keduanya.

## Hasil Audit Saat Ini

| Bagian | Web POS | Native Android | Dampak |
|---|---|---|---|
| Saldo shift aktif | Memanggil `get_petty_cash_balance`, lalu fallback hitung lokal | Selalu hitung lokal | Override Admin belum konsisten |
| Rumus lokal | Modal awal + top-up efektif - expense aktif | Sama | Rumus dasar sudah sejalan |
| Top-up efektif | `completed`, `approved`, `forwarded_by_leader` | Sama | RPC DB masih ikut menghitung `approved_by_finance`, perlu diseragamkan |
| Expense batal | `deleted_at` diabaikan | Sama | Void mengembalikan saldo |
| Saldo tutup shift | Saldo sistem dibanding uang fisik | Sama | Harus memakai snapshot kanonis yang sama |
| Shift berikutnya | Membawa saldo akhir shift sebelumnya + mutasi interim | Sama | Harus tetap dipertahankan |
| Override Admin saat ini | Memiliki baseline override | DTO dan ViewModel tidak membaca override | Web dan Android dapat menampilkan angka berbeda |

## Dependency Graph

```text
Task 1: Kontrak saldo kanonis
  ├── Task 2: Migrasi ledger penyesuaian + RPC Admin
  │     ├── Task 3: Refactor UI CRUD Admin
  │     ├── Task 4: Integrasi Web POS
  │     └── Task 5: Integrasi Native Android
  └── Task 6: Selaraskan dashboard operasional

Tasks 2-6
  └── Task 7: Migrasi override lama, pengujian lintas aplikasi, rollout
```

## Task 1: Tetapkan Kontrak Saldo Kanonis

**Deskripsi:** Buat satu definisi server-side untuk saldo, waktu efektif mutasi, dan status top-up yang benar-benar sudah masuk laci.

**Acceptance criteria:**

- [ ] Status top-up efektif ditetapkan menjadi `forwarded_by_leader`, `completed`, serta `approved` hanya untuk kompatibilitas data lama.
- [ ] `approved_by_finance` tidak menambah saldo karena dana belum sampai outlet.
- [ ] Snapshot saldo mengembalikan minimal: outlet, shift aktif/terakhir, modal awal, total top-up efektif, total pengeluaran aktif, total penyesuaian Admin, saldo saat ini, penyesuaian pembukaan yang masih tertunda, dan waktu kalkulasi.
- [ ] Ketika tidak ada shift aktif, snapshot menampilkan saldo carry-forward serta saldo target yang akan menjadi modal awal shift berikutnya jika ada penyesuaian tertunda.
- [ ] Web, Native, Admin, Leader, dan Area Manager memakai kontrak yang sama.

**Verification:** Uji SQL dengan skenario shift aktif, shift tutup, top-up lintas shift, expense void, dan outlet tanpa histori.

**Dependencies:** Tidak ada.

**Files likely touched:**

- `supabase/migrations/<timestamp>_canonical_petty_cash_snapshot.sql`
- Dokumentasi kontrak petty cash bersama.

**Estimated scope:** Medium.

## Task 2: Tambahkan Ledger Penyesuaian dan RPC Admin

**Deskripsi:** Ganti baseline override tersembunyi dengan mutasi penyesuaian yang eksplisit dan dapat diaudit.

**Acceptance criteria:**

- [ ] Tabel `petty_cash_adjustments` memiliki `outlet_id`, `shift_id` opsional, `application_mode` (`active_shift` atau `next_shift_opening`), saldo target, nominal selisih, saldo sebelum/sesudah, status (`pending`, `applied`, `superseded`), catatan, pembuat, dan waktu efektif.
- [ ] Saldo target negatif dan catatan kurang dari batas minimum ditolak di database; target yang sama dengan saldo sekarang ditolak sebagai perubahan kosong.
- [ ] Hanya ada satu adjustment pembukaan berstatus `pending` per outlet. Penyesuaian baru menggantikan pending lama secara atomik tanpa menghapus historinya.
- [ ] Satu RPC `admin_adjust_petty_cash` menerima hanya outlet, saldo target, dan catatan; database menentukan mode berdasarkan keberadaan shift aktif.
- [ ] Jika shift aktif, RPC mengunci outlet/shift, menghitung selisih, menyimpan adjustment `applied`, dan mengembalikan snapshot terbaru.
- [ ] Jika tidak ada shift aktif, RPC menyimpan saldo target sebagai adjustment `pending` untuk pembukaan shift berikutnya tanpa mengubah histori shift yang sudah tutup.
- [ ] `open_shift` mengunci outlet yang sama, memakai pending adjustment sebagai `starting_petty_cash`, menautkannya ke shift baru, lalu mengubah status menjadi `applied` dalam transaksi yang sama.
- [ ] Role selain Admin ditolak oleh RPC dan RLS.
- [ ] Semua tabel saldo masuk Supabase Realtime dengan kebijakan akses outlet yang benar.

**Verification:** Jalankan migration lint/SQL test; panggil RPC sebagai Admin dan non-Admin; uji simpan saat shift tutup, simpan saat shift aktif, dua Admin bersamaan, serta perlombaan antara `admin_adjust_petty_cash` dan `open_shift`.

**Dependencies:** Task 1.

**Files likely touched:**

- `supabase/migrations/20300108000014_admin_petty_cash_override.sql` melalui migration koreksi baru, bukan mengedit migration yang sudah dirilis.
- `supabase/migrations/<timestamp>_petty_cash_admin_ledger.sql`
- SQL test petty cash.

**Estimated scope:** Large.

## Checkpoint 1: Database

- [ ] Saldo snapshot cocok dengan penjumlahan ledger untuk seluruh skenario uji.
- [ ] Tidak ada lagi pembaca yang bergantung pada `admin_petty_cash_balance` sebagai baseline khusus.
- [ ] Override lama memiliki strategi migrasi yang deterministik dan tidak menggandakan mutasi.
- [ ] Persetujuan manusia diperlukan sebelum migration dijalankan ke database produksi.

## Task 3: Refactor UI CRUD Admin

**Deskripsi:** Ubah halaman dari dua input saldo bebas menjadi satu input pintar setelah Admin memilih outlet.

**Acceptance criteria:**

- [ ] Form hanya memiliki pemilih outlet, satu input **Penyesuaian Petty Cash**, dan catatan wajib; tidak ada input `Modal Awal` maupun `Saldo Saat Ini`.
- [ ] UI tetap menampilkan status shift dan saldo referensi sebagai informasi read-only.
- [ ] Jika shift belum aktif, helper text dan dialog konfirmasi menjelaskan bahwa nilai akan menjadi modal awal shift berikutnya.
- [ ] Jika shift aktif, helper text dan dialog konfirmasi menjelaskan bahwa saldo saat ini akan menjadi nilai target tersebut serta menampilkan selisihnya.
- [ ] UI tidak mengirim mode aplikasi; server action hanya mengirim `outletId`, `targetBalance`, dan `note` agar keputusan status shift tetap otoritatif di database.
- [ ] Setelah berhasil, respons menampilkan hasil aktual dari server: **Dijadwalkan sebagai modal awal** atau **Saldo shift aktif disesuaikan**.
- [ ] Histori memperlihatkan mode penerapan, status pending/applied/superseded, sebelum/sesudah, selisih, Admin, catatan, dan waktu.
- [ ] Tombol aksi memakai modal konfirmasi, memiliki loading state, mencegah double-submit, dan menampilkan error database secara mudah dipahami.
- [ ] UI responsif dan dapat digunakan dengan keyboard; nominal selalu memakai format Rupiah.

**Verification:** Type-check/build Admin Dashboard; uji interaksi outlet tanpa shift, shift aktif, shift tutup, histori kosong, dan data panjang.

**Dependencies:** Task 2.

**Files likely touched:**

- `apps/admin-dashboard/src/app/dashboard/petty-cash-balance/page.tsx`
- `apps/admin-dashboard/src/app/dashboard/petty-cash-balance/PettyCashBalanceView.tsx`
- `apps/admin-dashboard/src/app/dashboard/petty-cash-balance/actions.ts`
- Komponen modal/tabel kecil di folder fitur bila diperlukan.

**Estimated scope:** Large.

## Task 4: Integrasikan Snapshot ke Web POS

**Deskripsi:** Hilangkan sumber saldo ganda dan gunakan snapshot server sebagai nilai utama.

**Acceptance criteria:**

- [ ] Halaman shift aktif membaca snapshot kanonis.
- [ ] Validasi expense memakai saldo snapshot terbaru di server; validasi client hanya sebagai bantuan UX.
- [ ] Tutup shift menyimpan `expected_ending_petty_cash` dari snapshot kanonis yang diambil tepat sebelum penutupan.
- [ ] Jika shift belum dibuka, Web POS menampilkan saldo target pending sebagai modal awal terkunci; kasir tidak dapat menggantinya.
- [ ] Setelah shift dibuka, pending adjustment tidak dihitung lagi sebagai mutasi agar saldo tidak dobel.
- [ ] Adjustment Admin pada shift aktif muncul sebagai mutasi ledger dengan label dan catatan yang jelas.
- [ ] Realtime perubahan shift, top-up, expense, dan adjustment memicu refresh.
- [ ] Fallback lokal, jika tetap dipertahankan untuk gangguan jaringan, memakai status dan rumus yang persis sama serta diberi indikator data belum tersinkron.

**Verification:** Type-check/build Web POS; uji rekonsiliasi Admin saat layar kasir terbuka, expense setelah rekonsiliasi, void, dan tutup shift.

**Dependencies:** Task 2.

**Files likely touched:**

- `apps/pos-kasir/app/kasir/shift/page.tsx`
- `apps/pos-kasir/app/kasir/shift/close/page.tsx`
- `apps/pos-kasir/app/api/kasir/close-shift/route.ts`
- Komponen/tipe helper petty cash Web POS.

**Estimated scope:** Medium.

## Task 5: Integrasikan Snapshot ke Native Android

**Deskripsi:** Jadikan native memakai kontrak server yang sama, termasuk adjustment Admin.

**Acceptance criteria:**

- [ ] DTO shift/snapshot memuat field yang diperlukan tanpa mengandalkan `admin_petty_cash_balance` lama.
- [ ] `ShiftViewModel` tidak lagi menjadikan hitungan lokal sebagai sumber utama saldo online.
- [ ] Jika shift belum dibuka, Native menampilkan saldo target pending sebagai modal awal terkunci; kasir tidak dapat menggantinya.
- [ ] Setelah shift dibuka, pending adjustment tidak dihitung lagi sebagai mutasi agar saldo tidak dobel.
- [ ] Ledger Native menampilkan adjustment Admin pada shift aktif dan catatannya.
- [ ] Expected petty cash pada tutup shift berasal dari snapshot terbaru server.
- [ ] Realtime perubahan adjustment dan shift memuat ulang data tanpa harus restart aplikasi.
- [ ] Perilaku offline dinyatakan jelas: tampilkan snapshot cache terakhir dan blokir mutasi yang memerlukan validasi saldo server.

**Verification:** Jalankan unit test ViewModel, build Gradle, dan uji perangkat/emulator untuk rekonsiliasi Admin saat aplikasi terbuka.

**Dependencies:** Task 2.

**Files likely touched:**

- `D:/PROJECT-APPS-NATIVE/POS/app/src/main/java/com/sukashawarma/pos/data/remote/SupabaseApi.kt`
- `D:/PROJECT-APPS-NATIVE/POS/app/src/main/java/com/sukashawarma/pos/data/remote/dto/SupabaseDtos.kt`
- `D:/PROJECT-APPS-NATIVE/POS/app/src/main/java/com/sukashawarma/pos/presentation/shift/ShiftViewModel.kt`
- `D:/PROJECT-APPS-NATIVE/POS/app/src/main/java/com/sukashawarma/pos/presentation/shift/ShiftScreen.kt`
- `D:/PROJECT-APPS-NATIVE/POS/app/src/main/java/com/sukashawarma/pos/data/remote/realtime/POSRealtimeService.kt`

**Estimated scope:** Large.

## Task 6: Selaraskan Dashboard Leader dan Area Manager

**Deskripsi:** Pastikan semua tampilan operasional membaca snapshot yang sama dan dapat mengenali penyesuaian Admin.

**Acceptance criteria:**

- [ ] Kartu saldo Leader dan Area Manager sama dengan Web POS, Native, dan Admin.
- [ ] Histori/aktivitas menampilkan adjustment Admin dengan pembuat dan catatan.
- [ ] Top-up baru menambah saldo hanya ketika dana masuk laci sesuai status kanonis.
- [ ] Tidak ada query lokal lama yang masih menghitung `approved_by_finance` sebagai uang outlet.

**Verification:** Type-check/build aplikasi terkait dan bandingkan saldo satu outlet pada seluruh layar setelah setiap jenis mutasi.

**Dependencies:** Tasks 1-2.

**Files likely touched:** Halaman petty cash Leader/Area Manager dan helper saldo bersama yang ditemukan saat implementasi.

**Estimated scope:** Medium.

## Checkpoint 2: Integrasi Lintas Aplikasi

- [ ] Satu rekonsiliasi Admin tampil dengan nilai identik di Admin, Web POS, Native, Leader, dan Area Manager.
- [ ] Penyesuaian saat shift tutup muncul sebagai modal awal terkunci di Web POS dan Native, lalu dikonsumsi tepat satu kali saat `open_shift`.
- [ ] Penyesuaian saat shift aktif mengubah saldo saat ini tanpa mengubah modal awal shift.
- [ ] Expense baru menurunkan semua tampilan satu kali.
- [ ] Void mengembalikan semua tampilan satu kali.
- [ ] Top-up belum diserahkan Leader tidak mengubah saldo.
- [ ] Top-up yang diserahkan Leader mengubah saldo satu kali.
- [ ] Persetujuan manusia diperlukan sebelum deployment aplikasi dan migrasi data lama.

## Task 7: Migrasi Data Lama, Regresi, dan Rollout

**Deskripsi:** Pindahkan override lama tanpa kehilangan audit, lalu rilis database sebelum klien.

**Acceptance criteria:**

- [ ] Setiap `admin_petty_cash_balance` lama dikonversi menjadi maksimal satu adjustment dengan referensi histori lama.
- [ ] Data history lama tetap dapat dibaca setelah skema baru aktif.
- [ ] Kolom override lama baru dinonaktifkan setelah semua klien memakai snapshot baru.
- [ ] Urutan rollout ditetapkan: migration kompatibel mundur → Admin → Web/operasional → Native → observasi → cleanup migration.
- [ ] Ada query rekonsiliasi untuk mendeteksi outlet yang saldo snapshot-nya tidak cocok dengan ledger.
- [ ] Ada rollback operasional yang tidak menghapus histori atau mutasi baru.

**Verification:** Dry-run pada salinan data; bandingkan saldo semua outlet sebelum/sesudah; jalankan build/test seluruh aplikasi; smoke test satu outlet uji sebelum produksi penuh.

**Dependencies:** Tasks 2-6.

**Files likely touched:** Migration data, test SQL, dokumentasi rollout, serta catatan rilis aplikasi.

**Estimated scope:** Large.

## Matriks Pengujian Wajib

| Skenario | Saldo yang diharapkan |
|---|---|
| Modal awal 500.000 | 500.000 |
| Top-up masih `approved_by_finance` 100.000 | Tetap 500.000 |
| Top-up berubah `forwarded_by_leader` | 600.000 |
| Expense 75.000 | 525.000 |
| Expense di-void | 600.000 |
| Admin menyesuaikan ke 550.000 ketika shift aktif | Adjustment -50.000; saldo saat ini 550.000; modal awal tetap |
| Expense baru 25.000 setelah rekonsiliasi | 525.000 |
| Tutup shift dengan fisik 520.000 | Expected 525.000; variance -5.000 |
| Admin menyesuaikan ke 700.000 ketika tidak ada shift aktif | Pending target 700.000; histori shift lama tidak berubah |
| Kasir membuka shift setelah pending 700.000 | Modal awal shift baru 700.000; pending menjadi applied; saldo saat ini 700.000 |
| Admin dan kasir menekan simpan/buka shift bersamaan | Nilai diterapkan tepat satu kali berdasarkan urutan lock database |

## Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Web dan Native menghitung sendiri-sendiri | Saldo berbeda | Satu snapshot RPC sebagai sumber utama |
| Override lama dihitung ulang sebagai mutasi baru | Saldo dobel | Migration idempotent dengan referensi history unik |
| Admin harus memilih modal awal atau saldo saat ini | Salah konteks dan membingungkan | Satu input; database menentukan mode dari status shift |
| Dua Admin mengubah saldo bersamaan | Update salah timpa | Lock per outlet/shift dan transaksi atomik |
| Shift dibuka bersamaan dengan penyesuaian Admin | Nilai diterapkan dua kali atau hilang | Lock outlet yang sama di RPC Admin dan `open_shift` |
| Top-up finance dianggap sudah di outlet | Saldo terlalu tinggi | Status efektif dipusatkan di SQL dan test kontrak |
| Hapus permanen memutus audit | Riwayat hilang | Void/soft-delete saja |
| Native offline memakai angka basi | Expense melebihi saldo | Tampilkan cache sebagai estimasi dan blok mutasi saldo saat offline |

## Batas Scope

- Plan ini tidak mengubah workflow persetujuan top-up.
- Plan ini tidak menghapus data histori lama.
- Implementasi belum dimulai sampai kontrak satu input pintar dan rollout migration disetujui.
