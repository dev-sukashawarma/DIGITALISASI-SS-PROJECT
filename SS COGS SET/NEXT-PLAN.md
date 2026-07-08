# Rencana Selanjutnya — COGS/BOM Suka Shawarma

Status per 2026-07-04 (akhir sesi): **Tahap B, C — SELESAI & TERUJI.** BOM automation aktif & terverifikasi benar di outlet Empang (allowlist). 1 bug kritis ditemukan & diperbaiki selama testing. Tinggal keputusan rollout ke outlet lain + beberapa loose ends non-blocking.

---

## ✅ Tahap B — SELESAI (2026-07-04)
Migration yang sudah applied ke `dev-sukashawarma's Project`:

| Migration | Isi | Verifikasi |
|---|---|---|
| `20260704110000_cogs_new_bahan_baku.sql` | 8 bahan baku baru | ✅ |
| `20260704120000_cogs_update_plastik_merah_satuan.sql` | PLASTIK MERAH: pack → pcs | ✅ |
| `20260704130000_cogs_resep_seed.sql` | 21 resep + resep_item (20 produk kartu, Suka Drink pecah 2) | ✅ |
| `20260704140000_cogs_deactivate_stale_resep.sql` | Nonaktifkan resep duplikat lama "Resep Original Mix Jumbo" | ✅ |

**Temuan selama eksekusi (sudah ditangani):** drift 11 migration lama (petty cash/system guides) di-`repair --status applied`; ditemukan & dinonaktifkan 1 resep duplikat usang yang bentrok menu dengan resep baru.

---

## ✅ Tahap C — SELESAI & TERUJI (2026-07-04)

### Migration yang sudah applied
| Migration | Isi |
|---|---|
| `20260704150000_cogs_fix_variable_packaging_satuan.sql` | KENTANG/MAYONES/SAOS SAMYANG → kg, FOIL → pcs (kemasan variabel) |
| `20260704160000_cogs_add_faktor_konversi.sql` | Kolom `bahan_baku.faktor_konversi` + isi 25 bahan |
| `20260704170000_cogs_bom_automation_with_allowlist.sql` | Trigger `trg_process_bom_stok` v3 (faktor konversi + allowlist guard via `global_settings`) |
| `20260704180000_cogs_enable_bom_automation_empang.sql` | Allowlist diisi khusus outlet **SUKA SHAWARMA EMPANG** (`550e8400-e29b-41d4-a716-446655440002`) |
| `20260704190000_cogs_refill_stok_empang.sql` | Isi stok awal 25 bahan di Empang (buffer ~50x penjualan/produk) |
| `20260704200000_cogs_bom_automation_security_definer.sql` | **Fix bug kritis** (lihat bawah): tambah `SECURITY DEFINER` |

### 🐛 Bug kritis ditemukan & diperbaiki saat testing
**Gejala:** Order sukses `completed` di kasir, tapi TIDAK ADA baris `ledger_stok` sama sekali — padahal semua data (outlet, menu_item_ref, resep aktif) cocok saat dicek manual via SQL.

**Root cause:** Fungsi trigger awalnya tanpa `SECURITY DEFINER` (default `SECURITY INVOKER`) → query internal (`resep`, `resep_item`, `bahan_baku`) jalan pakai role sesi yang menyelesaikan order. Testing dilakukan lewat `pos-kasir` lokal tanpa login SSO Portal penuh → sesi jalan sebagai `anon`. RLS `resep`/`resep_item`/`bahan_baku` cuma izinkan role `authenticated` baca → pencarian resep kembali **kosong secara diam-diam** (bukan error) → BOM di-skip tanpa jejak.

**Fix:** `SECURITY DEFINER SET search_path = public` — trigger sekarang konsisten jalan terlepas dari role yang menyelesaikan order (kasir, admin, sinkronisasi online, dll).

### Bug tambahan ditemukan & diperbaiki (di luar trigger, terkait Tahap C)
`SuratJalanForm.tsx` & `VerifikasiForm.tsx` (app `distribusi`) pakai `parseInt()` untuk input qty — membuang desimal. Jadi masalah nyata begitu 4 bahan (SAOS CABE, MAYONES, KENTANG, SAOS SAMYANG) pindah ke satuan `kg` (butuh input desimal, mis. "5.5"). **Fix:** `parseInt`→`parseFloat` + `step="0.01"` di kedua file. Sudah type-check bersih, belum di-commit.

### Hasil testing (outlet Empang, lewat UI kasir asli + verifikasi SQL)
| Skenario | Hasil |
|---|---|
| Order sederhana (Shawarma Sapi Sedang) | ✅ 12 bahan, semua qty & faktor konversi cocok persis (termasuk desimal panjang FOIL) |
| Quantity > 1 | ✅ dikonfirmasi user |
| Void/Cancel reversal (Shawarma Mix Jumbo) | ✅ 13 baris `pemakaian` + 13 baris `adjustment` cermin sempurna |
| Produk tanpa resep (Subsidi/Online) | ⏳ belum dicoba (opsional) |
| Stok habis (exception `ledger_stamp_saldo`) | ⏳ belum dicoba (opsional) |

**Kesimpulan:** BOM automation di outlet Empang **berfungsi benar** dan siap dianggap "lolos uji" untuk skenario inti. 2 skenario edge-case opsional belum dicoba tapi tidak blocking.

---

## ⚠️ Menggantung — perlu tindak lanjut manusia (non-blocking)
1. **Migration `20260704100000_open_shift_reset_to_last_opening`** milik dev lain — statusnya "reverted" di histori (perubahan aktual aman/utuh, cuma catatan salah). Perlu dev tsb commit filenya & `migration repair --status applied`.
2. **2 pertanyaan kecil ke atasan** (`VERIFIKASI-BAHAN-BAKU.md`): gram pasti 1 crt SAOS SAMYANG, reorder point PLASTIK MERAH dalam pcs (masih perkiraan 1750).
3. **Fix `parseInt`→`parseFloat`** di `apps/distribusi` belum di-commit ke git.

## Langkah selanjutnya — rollout ke outlet lain
Setelah puas dengan hasil Empang:
```sql
UPDATE global_settings
SET value = value || ',' || '<outlet_id_baru>', updated_at = now()
WHERE key = 'bom_automation_allowed_outlets';
```
Tambahkan satu-satu / bertahap, bukan sekaligus 18 outlet — pantau tiap penambahan (query pemantauan di `TEST-PLAN-BOM-AUTOMATION.md` Bagian 6).

## Tahap D — 5 produk tanpa menu POS (tidak mendesak)
- **Shawarma Subsidi, Ayam Sedang Subsidi** — resep tersimpan, sengaja tidak dijual lewat menu internal.
- **3 varian Online Reguler** — dijual di ShopeeFood/TikTok/GoFood, mekanisme pencatatan menu belum jelas, owner minta ditunda.

## Tahap E — Housekeeping (kapan saja)
- Commit fix `parseInt`→`parseFloat` di `apps/distribusi`.
- Arsipkan draft di `SS COGS SET/` (sudah jadi migration resmi).
- Reorder point 8 bahan baru masih 1 angka global untuk 19 outlet — pertimbangkan per-outlet.
- Bersihkan data test di outlet Empang (order buatan, ledger test) sebelum outlet ini beroperasi normal — lihat `STEP-BY-STEP-TEST-EMPANG.md` Langkah 6.

---

## Ringkasan status (TL;DR)
```
✅ Tahap B — SELESAI, terverifikasi
✅ Tahap C — SELESAI, DIUJI LANGSUNG di outlet Empang, 1 bug kritis ditemukan+diperbaiki
✅ Tahap F — SELESAI (2026-07-07) UI/UX Halaman Resep & Sinkronisasi Harga Master
⚠️ 3 loose ends non-blocking (migration dev lain, 2 pertanyaan kecil, commit fix parseFloat)
⏳ Rollout bertahap ke 18 outlet lain — siap kapan saja, tambah 1-2 outlet dulu & pantau
⏳ Tahap D — ditunda sesuai instruksi owner
⏳ Tahap E — housekeeping, kapan saja
```

---

## ✅ Tahap F — Peningkatan UI/UX Resep & Pricing (2026-07-07)
Fokus pada kenyamanan admin dalam meracik resep dan menentukan harga jual (HPP).

1. **Penyatuan Form Resep**: *Section* "Komposisi Bahan Baku" dan "Rincian Bahan Baku" di `ResepEditor.tsx` telah dilebur menjadi satu *Editable Table* yang jauh lebih bersih, responsif, dan mudah dibaca (sesuai referensi desain).
2. **Koreksi Satuan**: Memastikan tampilan tabel Resep menggunakan satuan `kemasan_satuan` (seperti yang tertera pada dokumen supplier/kartu COGS fisik) alih-alih `satuan_kecil`.
3. **Kalkulator Harga & Margin Slider Interaktif**: Menambahkan *slider* pada Margin Keuntungan yang secara otomatis akan *reverse-calculate* (menghitung mundur) Harga Jual ideal. Admin kini juga bisa mengetik manual Harga Jual di kotak ringkasan, dan otomatis menyimpannya ke tabel `menu_items` ketika menyimpan resep.
4. **Auto-Sync Harga Beli Display (`20260707154500_sync_harga_beli_display.sql`)**: Membuat PostgreSQL Trigger `trg_sync_harga_beli_display` agar perubahan *base price* di Master Bahan Baku otomatis menghitung ulang harga per satuan kemasan (`harga_beli_display`) yang dipakai di halaman Resep.
5. **Koreksi Kategori Orange Jus**: Memindahkan Orange Jus dari kategori *Original Shawarma Ayam* ke kategori **Suka Drink**.
6. **Reordering Kategori di Tabel Resep**: Mengubah pengurutan default tabel Manajemen Resep agar mematuhi `categories.sort_order` dan `menu_items.sort_order`.

*Diperbarui: 2026-07-07 (setelah peningkatan UI/UX Resep selesai).*
