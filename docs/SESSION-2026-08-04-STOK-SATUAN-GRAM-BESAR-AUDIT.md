# Session 2026-08-04: Satuan Gram/Besar — Konflik Arsitektur, ApprovalModal, Auto-Cancel, dan Bug DB Layer Baru

**Status:** Kode selesai & di-push ke `main`. Migration applied & diverifikasi ground-truth. Audit DB terdokumentasi, **belum ada fix untuk bug DB layer yang ditemukan di bagian akhir** — itu menunggu keputusan/prioritas terpisah.

**Konteks:** kelanjutan langsung dari kerja semalam (2026-08-03) yang membangun mekanisme `saldo_is_gram()` untuk memperbaiki bug tampilan "8553 Blok" (SAPI 8.5kg tampil sebagai 17 ton). Lihat CLAUDE.md § "Session 2026-08-01: Waterfall BOM Deduction" dan seterusnya untuk histori penuh sebelum sesi ini.

---

## 1. Konflik arsitektur dengan sesi paralel — diresolusi

Ditemukan via `git fetch`: sesi lain mem-push commit `b450047a` ("fix(stok): tulis qty opname dalam satuan besar, bukan satuan terkecil") ke `origin/main`, yang membalik `OpnameForm.tsx` untuk menulis **satuan besar** — kebalikan total dari mekanisme `saldo_is_gram` yang dibangun sepanjang malam sebelumnya.

**Investigasi ground-truth** (bukan asumsi):
- Cek `qty_fisik` dari 2 opname yang baru difinalisasi **setelah** commit itu (21:59 & 22:50 WIB) → hasilnya **masih gram-scale** (24000, 6316 — kelipatan bulat satuan besar×faktor). Kesimpulan: `b450047a` sudah di-commit tapi **belum ter-deploy** ke `stok.sukashawarma.com` — situs live masih jalan kode lama (gram).
- Baca `compositeQty.ts` (file baru dari commit itu): `toSatuanBesar()` membandingkan fisik (besar-scale) langsung terhadap `qtySystem = saldoOf[bahan]` **tanpa cek skala saldo saat ini sama sekali**. Kalau di-deploy, opname berikutnya pada baris gram-scale mana pun akan menghasilkan `selisih` raksasa salah arah — persis bug yang mereka klaim sudah diperbaiki, tapi arah sebaliknya.
- Dokumen yang direferensikan di pesan commit (`docs/SESSION-2026-08-03-*.md`, klaim "pemulihan ~300 saldo") **tidak ada di repo**.

**Keputusan user:** *"pokoknya jangan rusak yang sudah berjalan baik"* — produksi saat ini berjalan dengan mekanisme gram, jadi itu yang dipertahankan.

**Tindakan:** `git merge origin/main` (membawa `b450047a` + 1 commit finance tak terkait) lalu `git revert b450047a` di atasnya — mengembalikan `OpnameForm.tsx` ke gram-scale, menghapus `compositeQty.ts`/`compositeQty.test.ts` mereka. Type-check bersih (3 error pre-existing tak terkait, terverifikasi via `git show` bukan regresi). Push `b501effa`.

---

## 2. §5 Nudge Batch — auto-cancel permintaan stale (>12 jam)

Dari spec `docs/superpowers/specs/2026-08-03-permintaan-batch-nudge-design.md` §5 (gerbang keputusan yang sengaja belum dikerjakan sesi sebelumnya). User memutuskan: **batas 12 jam, auto-batalkan** (bukan sekadar label).

**Implementasi:**
- `PermintaanForm.tsx` — `pendingItemIds` sekarang membebaskan (un-hide) bahan dengan permintaan `menunggu` yang sudah **>12 jam**, sehingga bisa diminta ulang.
- Migration `20300105000011_permintaan_auto_cancel_stale.sql` — tambah status `'dibatalkan'` ke CHECK constraint `permintaan_bahan`; `buat_permintaan_svc` di-`CREATE OR REPLACE` untuk otomatis men-set status `'dibatalkan'` (+ catatan) pada request lama yang stale saat request baru berisi bahan yang sama diajukan. Applied & diverifikasi ground-truth (constraint definition + isi fungsi via `pg_get_functiondef`/`prosrc`).
- `PermintaanList.tsx` / `types/permintaan.ts` — status `dibatalkan` ditampilkan (label abu-abu + alasan).

Commit `a44d862a`, push `011b9cc4`.

---

## 3. ApprovalModal — instance lain dari bug gram/besar, plus bug arithmetic tersembunyi

User melaporkan "Stok Outlet: 91 Pack" di modal Persetujuan Permintaan terlihat tidak sesuai.

**Temuan 1 (display):** `ApprovalModal.tsx` masih pakai `formatTriUnitSaldo` (fungsi besar-scale-only lama), bukan `formatTriUnitSaldoAdaptive` — sama persis kelas bug yang sudah diperbaiki di 7 komponen lain, tapi modal ini terlewat. `fetchCrosscheckStok` (server action) juga belum mengembalikan `saldo_is_gram` untuk baris outlet & gudang (dua baris `stok_balance` terpisah, bisa beda skala satu sama lain).

**Temuan 2 (arithmetic, lebih serius):** Perbandingan "⚠️ melebihi stok gudang" (`hasOverStock`/`isOverStock`) membandingkan `qtyDisetujuiBase` (SELALU satuan besar, dari `convertToBaseUnit`) langsung terhadap `crosscheckData[...].gudangStok` (saldo mentah, bisa gram-scale) — salah skala total kalau saldo gudang gram-scale. Warning bisa salah nyala/salah tidak nyala.

**Fix:**
- `fetchCrosscheckStok` kini mengembalikan `outletSaldoIsGram`/`gudangSaldoIsGram`.
- Tampilan pakai `formatTriUnitSaldoAdaptive`.
- Fungsi baru `convertGramToBesar()` di `compositeUnit.ts` (= `qtyGram / faktor_tampilan` bila ada `satuan_kecil`) dipakai untuk menyamakan skala sebelum perbandingan over-stock.

Commit `d7217923`, push `9ad56dfe`.

---

## 4. 🔴 Temuan baru paling penting: penulis ledger lain SEMUANYA scale-blind terhadap `saldo_is_gram`

Saat memverifikasi kenapa POLYBAG menampilkan "1 Ikat / 8 Ikat" di CICURUG/GUDANG, ditemukan bahwa **angka itu sendiri matematis konsisten** dengan raw saldo tersimpan — bukan bug tampilan. Tapi menelusuri `sj_on_dikirim_kurangi_kitchen` (trigger yang menulis ledger `transfer_keluar` saat surat jalan dikirim) mengungkap bug yang jauh lebih dalam:

```sql
INSERT INTO ledger_stok (..., qty, ...)
VALUES (..., -(v_item.qty_dikirim), ...)  -- qty_dikirim SELALU satuan besar
```

`qty_dikirim` (= `qty_disetujui`, dihitung di `ApprovalModal.tsx` via `convertToBaseUnit()`) **selalu satuan besar**, ditulis langsung sebagai delta ke `ledger_stok` **tanpa pernah cek `saldo_is_gram` outlet tujuan**. Trigger stok_balance sendiri (`ledger_stamp_saldo`) cuma `saldo = saldo + qty` murni, tak tahu-menahu soal skala — kesalahan terjadi di titik SIAPA yang menghitung `qty` sebelum ditulis.

**Akibat konkret:** kalau bahan gram-scale (mis. saldo 40 Pack) dikirim via surat jalan sebanyak 1 Pack, delta yang tertulis adalah `-0.2` (1 Pack dikonversi ke besar via faktor 5) bukan `-1` — saldo salah 5× lipat (faktor konversi bahan itu). **Ini bukan salah tampil — salah TERSIMPAN, permanen di ledger.**

**Cek fungsi lain yang berpotensi sama:** `select proname from pg_proc where prosrc ilike '%ledger_stok%'` menemukan 11 fungsi lain yang menulis `ledger_stok` — **belum diaudit satu-satu**:
`finalize_opname`, `finalize_surat_jalan`, `finalize_surat_jalan_and_ledger`, `hard_reset_outlet_data`, `kirim_mutasi`, `po_on_verified`, `process_waste_report_approval`, `process_waterfall_deduction` (BOM — **jalan di setiap order laku**, frekuensi tertinggi), `terima_mutasi`, `trg_process_bom_stok`.

---

## 5. Audit lapangan: 2 tabel (dipublikasi sebagai Artifact, hasil disalin ke sini untuk arsip)

### 5a. Per outlet+bahan (708 baris gram-scale dari total 1517 baris stok_balance)
Query: cek EXISTS ledger `opname_selisih` setelah cutoff 2026-08-01 20:32 WIB (baseline gram) → lalu EXISTS ledger `transfer_keluar`/`terima_kiriman`/`pemakaian`/`waste`/`adjustment` **setelah** baseline itu (= sudah kena tulisan besar-scale yang salah skala).

- **141 baris "Berisiko"** — sudah kena tulisan besar-scale setelah baseline gram, saldo saat ini kemungkinan besar korup.
- **567 baris "Aman"** — belum tersentuh sejak baseline gram, saldo saat ini kemungkinan masih valid (tapi tetap berisiko begitu ada transfer/BOM berikutnya, sampai bug §4 diperbaiki).

### 5b. Per bahan baku (61 bahan, agregat lintas outlet)
Cross-check konfigurasi `satuan_distribusi` (satuan yang dipakai di form Permintaan Bahan) terhadap besar/tengah/kecil bahan:

- **61/61 bahan — config OK.** Tidak ada satu pun `satuan_distribusi` yang salah setting / jatuh ke fallback faktor=1 diam-diam. Jadi masalah gram/besar BUKAN salah konfigurasi unit.
- **25 bahan** punya minimal 1 outlet dengan status "Berisiko" (dari 5a) — bukan salah config, murni akibat bug §4.
- POLYBAG spesifik: 0 outlet berisiko (termasuk kategori "Aman") — konsisten dengan yang user lihat di modal approval (angkanya benar, bukan bug).

---

## 6. Next steps (belum dikerjakan, perlu keputusan/prioritas user)

1. **Audit 11 fungsi penulis `ledger_stok` lain** (daftar di §4) — cek satu-satu apakah sama-sama scale-blind seperti `sj_on_dikirim_kurangi_kitchen`. `process_waterfall_deduction`/`trg_process_bom_stok` prioritas tertinggi (jalan tiap order).
2. **Perbaikan arsitektural** — pilihan: (a) semua fungsi penulis dibuat scale-aware (baca `saldo_is_gram` sebelum hitung delta), atau (b) migrasi satu kali semua baris gram-scale balik ke besar-scale lalu hentikan penulisan gram baru (kebalikan dari commit `b450047a` yang di-revert, tapi dieksekusi dengan benar — termasuk fix di titik yang mereka lewatkan).
3. **141 baris "Berisiko"** (§5a) perlu opname ulang untuk dipastikan/dikoreksi — tidak bisa direkonstruksi dari ledger karena kerusakannya di titik penulisan, bukan di baca.
4. Redeploy `stok.sukashawarma.com` — menumpuk beberapa fix sesi ini (auto-cancel, ApprovalModal, revert satuan besar) yang belum live.

## Artefak
- Migration: `supabase/migrations/20300105000011_permintaan_auto_cancel_stale.sql`
- Spec: `docs/superpowers/specs/2026-08-03-permintaan-batch-nudge-design.md` (§5 kini terimplementasi)
- Commits: `b501effa` (revert konflik satuan), `a44d862a` (auto-cancel), `d7217923` (ApprovalModal)
