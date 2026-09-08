# Panduan Kategori Petty Cash untuk POS Native

**Untuk:** tim POS native (repo terpisah, database Supabase yang sama)
**Dari:** repo `DIGITALISASI-SS-PROJECT`
**Tanggal:** 2026-09-08
**Status:** perubahan sisi DB & admin-dashboard **sudah live**; sisi POS native belum

---

## 1. Ringkasan satu paragraf

Layar input pengeluaran petty cash untuk crew perlu menyediakan **8 kategori**, menggantikan 3 kategori lama. Kode kategori yang ditulis ke database **harus persis** seperti daftar di §2 — salah ketik satu huruf tidak akan ditolak database, tapi baris itu akan hilang diam-diam dari Buku Kas dan laporan Laba. Baca §4 sebelum menulis kode apa pun.

---

## 2. Delapan kategori kanonik

Urutan ini sekaligus urutan tampil yang diminta owner.

| Label di layar | Kode yang ditulis ke DB | Contoh isi |
|---|---|---|
| Outlet | `pengeluaran_outlet` | plastik, ATK, alat kebersihan |
| Bahan Baku | `bahan_baku` | es batu, sayur |
| Transport | `transport` | ongkir, bensin, Lalamove, parkir |
| Listrik | `pln` | token listrik, tagihan listrik |
| Air | `pdam` | tagihan air, meteran air |
| Internet | `internet` | kuota, voucher data, WiFi |
| Overtime | `lembur` | uang lembur crew |
| Endorsement | `endorsement` | biaya endorse |

Default saat form dibuka: **`pengeluaran_outlet`**.

### Kenapa "Transport" ada di daftar ini

POS lama hanya punya 3 pilihan (Bahan Baku, Operasional Outlet, Utilitas) dan **tidak punya Transport sama sekali**. Crew akhirnya membuang belanja transport ke kategori mana pun yang tersedia. Audit Agustus 2026 menemukan `transport riki`, `driver lalamove`, bahkan `gas tabung 4` tercatat sebagai *Overtime* dan *Ads*. 232 baris Agustus (± Rp 15,5 juta) sudah dikoreksi manual. Selama layar POS belum menyediakan Transport, data salah bucket akan lahir lagi setiap hari.

---

## 3. Cara menulis ke database

Tabel: `public.petty_cash_expenses`

### Jalur A — INSERT langsung (**disarankan**)

Ini yang dipakai POS web sekarang, dan yang sudah terbukti jalan.

```jsonc
{
  "outlet_id":      "<uuid outlet>",
  "category":       "transport",          // salah satu dari 8 kode di §2
  "amount":         25000,                // wajib > 0
  "description":    "transport bahan baku",
  "expense_date":   "2026-09-08",         // lihat catatan tanggal di §7
  "payment_source": "petty_cash",
  "created_by":     "<uuid auth user>",
  "receipt_url":    null                  // opsional
}
```

Kolom `type` punya default `'expense'` dan `id` default `gen_random_uuid()` — tidak perlu dikirim.

**RLS INSERT** yang berlaku:

```sql
WITH CHECK (outlet_id IN (SELECT accessible_outlet_ids()))
```

Artinya user hanya bisa menulis ke outlet yang boleh ia akses. Crew otomatis terbatas ke outletnya sendiri. Tidak perlu validasi tambahan di klien untuk ini.

### Jalur B — RPC `add_petty_cash` (**jangan dipakai sebelum diperbaiki**)

RPC ini **akan menolak kedelapan kategori baru**. Whitelist-nya masih set lama:

```sql
IF p_category NOT IN ('cash_in','admin','outlet','utilities','overtime','bb','ads') THEN
  RAISE EXCEPTION 'Kategori tidak valid: %', p_category;
```

Tidak satu pun dari 8 kode di §2 ada di daftar itu — semuanya akan gagal dengan `Kategori tidak valid`.

RPC ini juga punya dua batasan lain yang membuat POS web meninggalkannya:

1. Ia membaca `outlet_staff.outlet_id` milik pemanggil. User multi-outlet (mis. Area Manager) yang `outlet_id`-nya `NULL` akan kena `Akun Anda tidak terhubung ke outlet manapun`.
2. Ia menolak transaksi bila saldo petty cash tidak mencukupi.

Kalau tim native tetap ingin memakai jalur RPC (misalnya demi guard saldo di poin 2), **whitelist-nya harus diperbarui lebih dulu lewat migration** di repo ini. Koordinasikan — jangan mengubah fungsi DB bersama secara sepihak.

---

## 4. ⚠️ Ranjau utama: salah ketik = uang hilang dari laporan

**Kolom `category` tidak punya CHECK constraint.** Database akan menerima string apa pun, termasuk `Transport`, `transportasi`, `trasnport`, atau string kosong. Tidak ada error, tidak ada peringatan.

Tapi di sisi laporan, `admin-dashboard` menyaring petty cash lewat **allowlist kategori** yang di-hardcode di dua tempat:

- `apps/admin-dashboard/src/hooks/useExpenses.ts` — Buku Kas, halaman Expenses, halaman Laba
- `apps/admin-dashboard/src/app/actions/profitExport.ts` — Export Excel P&L

Kode di luar allowlist itu **dibuang diam-diam**. Baris tetap ada di database, uangnya tetap keluar dari petty cash, tapi tidak pernah muncul sebagai biaya di laporan mana pun.

Ini bukan skenario hipotetis. Persis inilah yang terjadi pada 14 baris berkategori `overtime`/`ads` (Rp 796.000) yang tidak pernah muncul di Buku Kas selama Agustus–September 2026, sampai ditemukan lewat audit.

**Konsekuensi praktis untuk tim native:**

- Gunakan konstanta/enum, jangan string literal yang diketik ulang di beberapa tempat.
- Tulis unit test yang membandingkan daftar kode di app dengan daftar di §2.
- Kalau nanti mau menambah kategori ke-9, itu **bukan** perubahan sisi POS saja — allowlist di kedua file di atas harus ikut diperbarui dan di-redeploy, kalau tidak kategori barunya tak terlihat.

---

## 5. Kode lama: boleh dibaca, jangan ditulis

Data historis masih memakai kode-kode ini. Kalau POS native menampilkan riwayat pengeluaran, ia perlu bisa **membaca** dan melabelinya. Tapi **jangan pernah menulis** kode ini untuk transaksi baru.

| Kode lama | Artinya | Label yang wajar |
|---|---|---|
| `outlet`, `operasional` | sama dengan `pengeluaran_outlet` | Outlet |
| `bb` | sama dengan `bahan_baku` | Bahan Baku |
| `utilities`, `utilitas` | payung lama listrik/air/internet | Utilitas |
| `lainnya` | kategori buangan lama | Lainnya |
| `overtime` | pendahulu `lembur` | Overtime |
| `ads` | dipakai salah oleh crew | Ads |
| `cash_in`, `admin` | dari skema OPEX lama | — |

Catatan: `admin-dashboard` menormalkan sebagian saat menampilkan (`bb`→`bahan_baku`, `outlet`/`operasional`→`pengeluaran_outlet`, `utilities`→`utilitas`), jadi di layar owner mereka sudah menyatu. Kalau POS native menampilkan riwayat, sebaiknya lakukan pemetaan yang sama supaya tidak muncul kategori kembar.

---

## 6. Pembatalan pengeluaran (void)

**Jangan `UPDATE` atau `DELETE` baris `petty_cash_expenses` secara langsung.** Tidak ada RLS policy untuk UPDATE maupun DELETE di tabel ini, jadi percobaan langsung akan gagal — dan memang begitu desainnya.

Gunakan RPC:

```
void_petty_cash_expense(p_expense_id uuid, p_reason text)
```

Perilakunya: memvalidasi pemanggil, mewajibkan alasan tidak kosong, memastikan outletnya boleh diakses, menolak baris yang sudah dibatalkan, lalu mengisi `deleted_at`, `delete_reason`, dan `deleted_by`. Ini soft-delete — barisnya tetap ada untuk jejak audit.

**Semua pembaca wajib menyaring `deleted_at IS NULL`.** Ini bukan preferensi; `get_petty_cash_balance()` di DB sudah menyaringnya sejak awal, jadi kalau POS native menampilkan total pengeluaran tanpa menyaring, angkanya akan berbeda dari saldo yang dihitung DB untuk shift yang sama.

POS web menampilkan baris ter-void dengan gaya dicoret plus labelnya ("Alasan Batal: …") dan mengeluarkannya dari total — pola yang bagus untuk ditiru.

Sekadar catatan seberapa nyata risikonya: 5 pembaca di `admin-dashboard` melewatkan penyaring ini dan menghitung Rp 886.805 pengeluaran yang sudah dibatalkan sebagai biaya nyata. Baru diperbaiki 2026-09-08.

---

## 7. Saldo petty cash & tanggal

### Saldo

Jangan menghitung saldo sendiri di klien. Pakai:

```
get_petty_cash_balance(p_outlet_id uuid) RETURNS numeric
```

Rumusnya: `saldo_awal_shift + topup_selama_shift − pengeluaran_shift_yang_belum_dibatalkan`, dan ia mengembalikan `0` bila tidak ada shift berstatus `open`. Dua halaman di `admin-dashboard` sempat meniru rumus ini secara manual tanpa penyaring `deleted_at` dan menghasilkan saldo yang berbeda dari DB — jangan ulangi.

### Tanggal — perilaku yang perlu diputuskan sadar

POS web mengisi `expense_date` begini:

```js
const today = new Date().toISOString().split('T')[0]
```

Itu menghasilkan tanggal **UTC**, bukan WIB. Akibatnya belanja yang dicatat antara **00:00–07:00 WIB tercatat di tanggal sebelumnya**.

Untuk shift malam yang tutup lewat tengah malam, ini mungkin justru yang diinginkan (belanjanya memang milik hari operasional kemarin). Tapi perilaku ini tampaknya kebetulan, bukan keputusan. **Tim native sebaiknya memutuskan ini secara eksplisit** dan menyamakannya dengan POS web supaya laporan harian kedua sistem tidak berselisih. Kalau memilih WIB, konversikan ke `Asia/Jakarta` sebelum mengambil tanggalnya.

Kolom ini juga punya default `CURRENT_DATE` di DB — yang juga UTC. Mengandalkan default punya masalah yang sama.

---

## 8. Checklist verifikasi sebelum rilis

- [ ] Delapan kategori tampil, urut seperti §2, default `pengeluaran_outlet`.
- [ ] Kode yang tersimpan di DB persis 8 string di §2 — cek langsung ke tabel setelah input uji, jangan percaya tampilan.
- [ ] Input uji satu per kategori, lalu buka **Buku Kas** di admin-dashboard pada rentang tanggal itu. Kedelapannya harus muncul dengan label yang benar. Kalau ada yang hilang → kodenya salah ketik, atau allowlist §4 belum mencakupnya.
- [ ] Transaksi ke outlet lain ditolak RLS (uji dengan akun crew).
- [ ] Pembatalan lewat `void_petty_cash_expense`, bukan UPDATE/DELETE. Alasan kosong ditolak.
- [ ] Setelah membatalkan, saldo dari `get_petty_cash_balance()` kembali seperti semula.
- [ ] Total pengeluaran yang ditampilkan POS native = total yang ditampilkan admin-dashboard untuk outlet & periode yang sama.
- [ ] Perilaku tanggal (§7) sudah diputuskan dan konsisten dengan POS web.

---

## 9. Rujukan implementasi

Implementasi POS **web** yang setara ada di repo ini sebagai contoh kerja — bukan untuk disalin mentah, tapi berguna sebagai pembanding:

- `apps/pos-kasir/app/kasir/shift/page.tsx` — daftar kategori, INSERT langsung, penanganan baris ter-void di riwayat
- `apps/admin-dashboard/src/lib/expenseCategories.ts` — kode kategori kanonik + label
- `apps/admin-dashboard/src/hooks/useExpenses.ts` — allowlist yang menentukan kategori mana yang terhitung sebagai biaya

Commit terkait: `1a334847` (8 kategori di POS web), `ffbc7ebf` (allowlist + penyaring `deleted_at`).

---

## 10. Yang perlu dikoordinasikan, bukan dikerjakan sendiri

Karena database-nya bersama, tiga hal ini menyentuh repo lain dan harus dibicarakan dulu:

1. **Menambah/mengubah kategori** — perlu update allowlist di `admin-dashboard` (§4) + redeploy, kalau tidak kategori barunya tidak terlihat di laporan.
2. **Memperbaiki whitelist `add_petty_cash`** (§3 jalur B) — perlu migration di repo `DIGITALISASI-SS-PROJECT`.
3. **Menambah CHECK constraint pada `category`** — akan menutup kelas bug §4 untuk selamanya, tapi berisiko menolak tulisan dari sistem lain yang belum diaudit. Perlu sisir semua penulis dulu.
