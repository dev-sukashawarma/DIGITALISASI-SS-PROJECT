# Wizard Pembukaan Outlet — Keputusan Desain

**Tanggal:** 2026-11-13 · **Status:** keputusan owner (grilling), belum ada kode · **App:** admin-dashboard

## Masalah

Membuka outlet menyentuh ±29 setelan per outlet yang tersebar di 7 app. Enam di antaranya hanya bisa diubah
lewat SQL manual: `is_bom_enabled`, baris `stok_balance`, `rab_outlet_otomatis`, `region`,
rekening bank / `requires_korlap_review`, `area_manager_outlets`. Belum ada standar proses maupun
standar waktu: semua dikerjakan manual. Pelajaran mahal: 3 outlet mitra dibuat Juli dengan BOM mati, sehingga
3.676 order September tidak memotong stok.

## Keputusan

| # | Topik | Keputusan |
|---|---|---|
| 1 | Pemakai & tempat | Satu wizard di **admin-dashboard**. Langkah milik divisi lain tampil sebagai checklist dengan penanggung jawab dan dikerjakan di app masing-masing; wizard hanya membaca statusnya. |
| 2 | Siklus status | Outlet dibuat di awal dengan status **Persiapan** (`outlets.status = 'pending'`), lalu tombol **Go-Live** → `active`. Persiapan boleh berlangsung berapa lama pun. **Tanggal grand opening** opsional di wizard tetapi **wajib sebelum Go-Live** (revisi owner 13 Nov: "optional tapi mengarah ke wajib"); tampil sebagai hitung mundur di daftar & papan, jadi isian bawaan dialog Go-Live. Go-Live tetap manual, tidak otomatis pada tanggal itu. |
| 3 | Jenis | Langkah pertama: **Internal / Mitra**. Jenis dikunci setelah Go-Live. |
| 4 | Nilai awal | Diambil dari **bawaan pusat** (harga menu global, ambang stok default, jam kerja global), bukan disalin dari outlet acuan. Wizard menandai setelan yang masih bawaan. Promo, staf, dan transaksi tidak pernah disalin. |
| 5 | Staf | AM (wajib) & Leader (opsional) dipilih di wizard dari staf yang sudah ada. **Crew dibuat di dashboard HR** seperti biasa; wizard hanya menghitung yang terdaftar/enroll. Revisi owner 13 Nov: **minimal 1 crew aktif wajib** sebelum Go-Live; leader boleh kosong. |
| 6 | Stok awal | **Linimasa (owner 13 Nov):** Kitchen kirim SJ bahan baku awal **H-1**, outlet verifikasi saat barang tiba (terlewat → auto-verifikasi 02:00 tetap memasukkan stok); **hari H sebelum jualan** opname pertama (langsung `finalized`, tanpa approval), lalu Go-Live. Lewat **surat jalan biasa yang dibuat Kitchen** (gudang berkurang, outlet memverifikasi). Wizard tidak membuat SJ. Opname pertama di outlet = titik awal. |
| 7 | RAB | Langkah **Masa RAB hanya untuk Mitra**: tanggal berakhir + kategori pengecualian (bawaan = daftar Karawaci). Dipasang saat outlet dibuat, bukan saat Go-Live. Menulis ke `rab_outlet_otomatis`. |
| 8 | Saat Go-Live | Menyala sekaligus tanpa pilihan: tampil di POS & laporan, BOM aktif + baris `stok_balance` untuk semua bahan aktif, masuk reminder WA AM, tanggal mulai mitra = tanggal Go-Live. **Opsional, belakangan:** aplikasi pelanggan (`app_enabled`), promo pembukaan. |
| 9 | Gerbang Go-Live | Lihat tabel checklist di bawah. Langkah wajib mengunci tombol; langkah peringatan hanya muncul di konfirmasi. |
| 10 | Hak Go-Live | **Admin & developer**, dengan konfirmasi ketik nama outlet; pelaku + jam dicatat. Owner hanya melihat progres. |
| 11 | Tahap 0 (prasyarat) | (a) Pemetaan AM di app manager dan fungsi bonus AM dibaca dari `am_outlet_assignments`, bukan hardcode. (b) Status mitra hanya dari `outlets.type`, bukan dari nama mengandung "mitra" (`lib/outletOwnership.ts`). |
| 12 | Form outlet lama | Membuat outlet baru lewat wizard. Form `/outlets` jadi satu-satunya form edit dan ditambah isian yang selama ini hanya lewat SQL (telepon, region, rekening bank, review korlap). Form `/pos-admin/outlets` **dibiarkan sebagai cadangan**, hanya ditambah keterangan "Untuk outlet baru, pakai Wizard Pembukaan Outlet". |
| 13 | Batal | Tombol **Batalkan Pembukaan** (admin/developer, wajib alasan). Belum ada data → hapus permanen. Sudah ada data → `inactive` + alasan + daftar hal yang perlu dibereskan manual (SJ, crew, biaya RAB). |
| 14 | Bentuk UI | Wizard singkat 4 langkah: (1) jenis → (2) data outlet, peta, jam → (3) AM & Leader → (4) khusus mitra. Lalu **papan checklist per outlet** di menu baru **"Pembukaan Outlet"**, plus daftar semua outlet yang sedang Persiapan. Status checklist terbaca otomatis dari data, tidak dicentang tangan. |
| 15 | Langkah 4 (mitra) | Diisi **admin & developer**. Akun mitra langsung dibuat di sini; mitra lama yang membuka outlet kedua dipilih dari akun yang ada lalu outlet ditambahkan ke `mitra_profiles.outlet_ids`. Data investasi ke `mitra_investments`. |
| 16 | Notifikasi | **Tidak ada** di tahap ini. |

## Checklist Go-Live

| Langkah | Penanggung jawab | Sifat | Sumber status |
|---|---|---|---|
| Data outlet: nama, alamat, titik peta, jam buka | Admin | Wajib | `outlets` |
| AM ditautkan | Admin | Wajib | `am_outlet_assignments` |
| Crew terdaftar (≥1 aktif) | HR | Wajib | `outlet_staff` |
| Leader ditautkan | Admin / HR | Peringatan | `staff_outlets` |
| Stok awal: SJ dikirim **dan** diverifikasi | Kitchen | Wajib | `surat_jalan` ke outlet |
| Opname pertama | Leader/crew | Wajib | `opname` finalized |
| Tanggal grand opening | Admin | Wajib (boleh kosong saat outlet dibuat) | `outlets.tanggal_grand_opening` |
| Mitra: investasi + akun login | Admin | Wajib (mitra) | `mitra_investments`, `mitra_profiles` |
| Mitra: masa RAB | Admin | Peringatan | `rab_outlet_otomatis` |
| ~~Budget kas kecil~~ | — | Tidak masuk checklist (revisi owner 13 Nov): pengajuan kas tetap lewat alur top up petty cash biasa | — |

Revisi owner 13 Nov (sesudah rilis): langkah **Jadwal absensi & checklist harian** dan **Target harian** dibuang dari papan; keduanya diatur di halaman masing-masing setelah outlet buka.

**Go-Live paksa** (revisi owner 13 Nov): admin & developer boleh Go-Live walau langkah wajib belum selesai, dengan **alasan wajib (min 10 karakter)**. Alasan + kunci langkah yang dilewati dicatat di `outlet_pembukaan_log` (aksi `go_live`, `detail.paksa = true`). Migration `20261113160000`.

## Yang wajib dicek saat perencanaan

- **Apakah outlet `pending` benar-benar tersembunyi** dari POS, dropdown outlet tiap app, laporan omzet/laba,
  reminder WA AM, aplikasi pelanggan, dan Order Online. Fondasinya (`status` + `is_active` disinkronkan trigger)
  sudah ada, tapi tiap app menarik daftar outlet sendiri (pelajaran outlet tes & marketplace).
- Pembuatan outlet wajib lewat jalur `createOutlet` yang sudah menyinkronkan ke DB Order Online + Marcom.
- Semua tulis lewat server action dengan cek role di dalamnya (bukan guard halaman saja).
- Go-Live mengisi `mitra_investments.tanggal_mulai` dengan tanggal Go-Live.
- `apps/admin-dashboard/src/data/outlet_system_start_dates.json` yatim, abaikan.
