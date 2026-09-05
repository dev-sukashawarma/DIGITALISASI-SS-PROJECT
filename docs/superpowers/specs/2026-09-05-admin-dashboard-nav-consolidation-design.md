# Konsolidasi Navigasi ADMIN — apps/admin-dashboard

**Tanggal:** 2026-09-05
**Status:** Design disetujui, belum diimplementasikan
**Scope:** Hanya role `ADMIN`. Role lain (OWNER, ADMIN_HR, PURCHASING, LEADER, AREA_MANAGER, MITRA) tidak berubah.

---

## 1. Masalah

`NAV_GROUPS` di `apps/admin-dashboard/src/components/layout/navConfig.ts` tumbuh menjadi 13 grup.
Role `ADMIN` melihat **10 pintu / 51 entri**, di dalamnya ada tiga entri yang benar-benar kembar
(route yang sama muncul di dua pintu), dua grup berisi satu item, dan dua item duduk di pintu
yang salah menurut labelnya sendiri.

Bukti terukur (dibaca dari `navConfig.ts` dan inventaris `src/app/dashboard/**/page.tsx`):

| Masalah | Bukti |
|---|---|
| Grup `Pengadaan` adalah subset persis grup `Pembelian & PO` | Keduanya memuat `/dashboard/pembelian` dan `/dashboard/pembelian/supplier` |
| `/dashboard/reports/pembelian` muncul dua kali | "Pembelian" di `Pusat Laporan`, "Laporan Pembelian" di `Pembelian & PO` |
| Grup satu item | `Kemitraan` (1 item), `Area Manager Dashboard` (1 item) |
| Item salah pintu | "Rekap Absensi (Stealth)" ada di pintu `Bisnis`, bukan `Karyawan` |
| Nama grup menyesatkan | `Migrasi Data` memuat `platform-settlement` dan `data-validate` yang bukan migrasi |
| Bottom-nav mobile tak disengaja | `BottomNav.tsx` memakai `accessibleItems(role).slice(0, 4)`; untuk ADMIN hasilnya Ringkasan Bisnis · Petty Cash (Khusus) · Rekap Absensi (Stealth) · Untung Rugi |

Beban per role hari ini:

| Role | Grup | Entri |
|---|---|---|
| ADMIN | 10 | 51 (48 route unik) |
| OWNER | 6 | 24 |
| ADMIN_HR | 1 | 5 |
| PURCHASING | 1 | 6 |
| LEADER | 1 | 4 |
| AREA_MANAGER | 1 | 1 |
| MITRA | 1 | 5 |

Beban praktis hanya ada di ADMIN. Karena itu scope sengaja dibatasi ke role tersebut.

---

## 2. Batasan yang disepakati

1. **Nol item hilang.** Semua route yang hari ini bisa dijangkau ADMIN lewat sidebar harus tetap
   bisa dijangkau sesudahnya. Yang berkurang hanya jumlah *pintu* dan entri kembar.
2. **Tidak mengubah halaman.** Ini restrukturisasi navigasi, bukan penggabungan fitur.
3. **Role lain tidak tersentuh.** `accessibleGroups()` sudah memfilter per role, jadi perubahan
   keanggotaan grup untuk ADMIN tidak boleh mengubah apa yang dilihat role lain.
4. **Perubahan komponen seminimal mungkin.** Sidebar tidak diubah sama sekali; BottomNav satu baris.

---

## 3. Struktur target: 10 pintu → 7

```
Bisnis            Ringkasan Bisnis · Untung Rugi · Pengeluaran · Budget Outlet
                  · Target & Pesan · Petty Cash (Khusus) · Dashboard Kemitraan
Laporan           Rangkuman Penjualan · Rekap Bulanan · Buku Kas (OPEX)
                  · Selisih Stok · Kerugian Waste · Target Harian · Bonus Crew
Produk & Stok     Master Bahan Baku · Manajemen Resep · Detail Opname Outlet · Manajemen Outlet
Pembelian         Perlu Dibeli · Purchase Order · Permintaan Pembelian · Master Supplier
                  · Harga & Bahan Baku · Laporan Pembelian
POS               Ringkasan POS · Daftar Menu · Kategori Menu · Manajemen Promo
                  · Pengguna POS · Pengaturan POS · Bukti QRIS
Karyawan          Ringkasan HR · Database Karyawan · Absensi & Shift · Cuti & Izin
                  · Payroll & Kasbon · Rekap Absensi (Stealth)
Sistem & Data     Monitoring Aktivitas · Panduan Sistem · Pusat Notifikasi
                  · Penyesuaian Petty Cash · Kesehatan Sistem · Pengaturan Printer
                  · Migrasi Pawoon · Data Tersinkron · Mapping Menu Pawoon
                  · Settlement Food Apps · Data Validate
```

### Daftar perubahan dan alasannya

| Perubahan | Alasan |
|---|---|
| Hapus grup `Pengadaan` | Kedua itemnya sudah ada di `Pembelian & PO` — duplikat murni |
| Hapus entri "Pembelian" dari `Pusat Laporan` | Route yang sama tetap tersedia sebagai "Laporan Pembelian" di pintu Pembelian |
| Lebur grup `Kemitraan` jadi satu item di `Bisnis` | Grup satu item adalah overhead visual |
| Lebur grup `Migrasi Data` ke `Sistem & Data` | Isinya bukan semuanya migrasi; keduanya sama-sama pintu jarang-pakai |
| Pindahkan "Rekap Absensi (Stealth)" ke `Karyawan` | Labelnya sendiri menandakan domain kepegawaian, bukan bisnis |
| Ganti nama `Pusat Laporan` → `Laporan` | Kata "Pusat" tidak membedakan apa pun |
| Ganti nama `Manajemen POS` → `POS` | Idem "Manajemen" |
| Ganti nama `Pembelian & PO` → `Pembelian` | "& PO" redundan setelah grup Pengadaan hilang |
| Ganti nama `Sistem` → `Sistem & Data` | Mencerminkan isi barunya |

### Yang sengaja TIDAK dilakukan

Menyatukan tiga permukaan uang-keluar — `/dashboard/owner/expenses` (rekap bulanan),
`/dashboard/reports/input-pengeluaran` (buku kas harian), `/dashboard/budget-outlet` (plafon
anggaran) — ketiganya beda fungsi. Menggabungkannya adalah perubahan produk, bukan navigasi.
Ketiganya tetap tiga item terpisah; yang berubah hanya letaknya jadi berdekatan.

### Hasil terukur

| Metrik | Sebelum | Sesudah |
|---|---|---|
| Pintu ADMIN | 10 | 7 |
| Entri nav ADMIN | 51 | 48 |
| Route unik ADMIN | 48 | 48 (invariant) |

---

## 4. Bottom-nav eksplisit

**Masalah:** `BottomNav.tsx` baris 22 memakai `items.slice(0, 4)`, sehingga isi tab bar mobile
adalah efek samping dari urutan array — bukan keputusan.

**Solusi:** field opsional pada `NavItem` dan satu helper baru di `navConfig.ts`.

```ts
export type NavItem = {
  href: string
  label: string
  shortLabel?: string
  icon: LucideIcon
  roles: Role[]
  /** Role yang menampilkan item ini di tab bar mobile. Maksimal 4 item per role. */
  primary?: Role[]
}

/**
 * Empat item untuk bottom-nav. Item bertanda `primary` untuk role tsb didahulukan;
 * bila kurang dari 4 (atau tidak ada sama sekali), sisanya diisi dari urutan
 * `accessibleItems(role)` — sehingga role tanpa penandaan berperilaku persis seperti sebelumnya.
 */
export function primaryItems(role: Role): NavItem[]
```

`primary` memakai `Role[]`, bukan `boolean`, karena satu item bisa dipakai beberapa role dan
belum tentu jadi tab utama untuk semuanya.

**Penandaan untuk ADMIN (4 item):**

| Item | Route |
|---|---|
| Ringkasan Bisnis | `/dashboard/owner` |
| Rangkuman Penjualan | `/dashboard/reports/pos` |
| Purchase Order | `/dashboard/pembelian` |
| Ringkasan HR | `/dashboard/hr` |

Role lain tidak diberi penandaan apa pun, jadi `primaryItems()` untuk mereka mengembalikan
persis empat item pertama seperti perilaku `slice(0, 4)` hari ini.

Perubahan di `BottomNav.tsx` hanya satu baris: `items.slice(0, 4)` → `primaryItems(role)`.

---

## 5. File yang disentuh

| File | Perubahan |
|---|---|
| `src/components/layout/navConfig.ts` | restruktur `NAV_GROUPS` untuk ADMIN, tambah `primary?` pada `NavItem`, tambah `primaryItems()` |
| `src/components/layout/BottomNav.tsx` | ganti `items.slice(0, 4)` menjadi `primaryItems(role)` |
| `src/components/layout/navConfig.test.ts` | file baru |

`Sidebar.tsx` tidak disentuh. `isItemActive()` dan `labelForPath()` tidak disentuh — keduanya
bekerja dari `href`, dan tidak ada `href` yang berubah.

---

## 6. Testing

Repo ini kehilangan seluruh test suite pada 2026-07-28 (lihat memori
`test-suite-deleted-2026-07-28`); tidak ada `navConfig.test.ts` yang tersisa. Test ditulis
lebih dulu (TDD), dan invarian pertama sengaja dipilih agar **gagal pada kode hari ini** lalu
hijau setelah restrukturisasi — itulah bukti duplikatnya benar-benar hilang.

| # | Invarian | Catatan |
|---|---|---|
| 1 | Tidak ada `href` kembar dalam `accessibleItems(role)` untuk setiap role | **Merah dulu** — hari ini ADMIN punya 3 duplikat |
| 2 | Setiap role punya ≥1 grup, dan tidak ada grup yang lolos filter dengan 0 item | |
| 3 | Setiap `href` di `NAV_GROUPS` punya `page.tsx` yang benar-benar ada di `src/app` | Mencegah item nav mati; dibaca dari filesystem |
| 4 | `primaryItems(role)` mengembalikan ≤4 item, semuanya anggota `accessibleItems(role)` | |
| 5 | `accessibleGroups('ADMIN')` menghasilkan tepat 7 grup | |
| 6 | Himpunan route unik ADMIN sesudah = himpunan sebelum | Snapshot 48 route ditulis eksplisit di test — inilah penegak "nol item hilang" |
| 7 | `accessibleGroups(role)` untuk keenam role non-ADMIN tidak berubah | Snapshot; penegak batasan #3 |

Verifikasi manual setelah test hijau:

- `yarn type-check` dan `yarn build` di `apps/admin-dashboard` — keduanya harus bersih relatif
  terhadap baseline (repo ini punya error pre-existing di file lain; yang dinilai adalah tidak
  adanya error **baru**).
- Login sebagai ADMIN: sidebar menampilkan 7 pintu; membuka halaman dalam sebuah pintu membuat
  accordion otomatis memilih pintu itu (perilaku `activeGroupTitle`).
- Tampilan mobile: tab bar berisi empat item yang ditentukan di §4.

---

## 7. Risiko

| Risiko | Mitigasi |
|---|---|
| ADMIN kehilangan akses ke suatu halaman karena salah pindah | Invarian test #6 membandingkan himpunan route, bukan sekadar jumlah |
| Role lain ikut berubah tanpa disadari | Invarian test #7 (snapshot per role) |
| Hafalan otot ADMIN terganggu | Lima dari tujuh nama pintu bertahan; tak ada URL yang berubah, jadi bookmark tetap hidup |
| `primaryItems()` salah untuk role tanpa penandaan | Fallback dirancang identik dengan `slice(0, 4)`, dan diuji |

---

## 8. Di luar scope — usulan terpisah, butuh keputusan owner

Audit rute menemukan 11 halaman yang hidup tapi tidak punya pintu di nav. **Tidak ada yang
dihapus dalam pekerjaan ini**; didaftar di sini supaya keputusannya tidak hilang:

| Route | Dugaan |
|---|---|
| `/dashboard/kelola-mitra` | Kembar dengan `/dashboard/owner/kelola-mitra` yang ada di nav |
| `/dashboard/pos-admin/outlets` | Beririsan dengan `/dashboard/outlets` |
| `/dashboard/pos-admin/petty-cash` | Beririsan dengan `/dashboard/petty-cash-balance` |
| `/dashboard/pos-admin/guides` | Beririsan dengan `/dashboard/panduan` |
| `/dashboard/inventory/dispatch` | Fungsi ini hidup di app `stok`/`distribusi` |
| `/dashboard/inventory/request` | Idem |
| `/dashboard/reports/voids` | Hidup, tanpa pintu |
| `/dashboard/reports` | Halaman indeks, tanpa pintu |
| `/dashboard/ecommerce/import-sales` | Hidup, tanpa pintu |
| `/dashboard/pawoon-import/profit` | Hidup, tanpa pintu |
| `/dashboard/area-manager/monitoring` | Hidup, tanpa pintu |

Catatan untuk invarian test #3: ia memeriksa arah "nav → file" (setiap item nav punya halaman),
**bukan** sebaliknya. Halaman tanpa pintu di atas tidak membuat test merah.
