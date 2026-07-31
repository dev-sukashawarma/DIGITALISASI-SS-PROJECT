# Baseline Data "Sebelum" — Pra Tarik-Ulang Pawoon (31 Juli 2026)

Snapshot angka DB **sebelum** penarikan ulang data Pawoon sampai hari ini.
Dipakai sebagai pembanding untuk membuktikan apa yang berubah setelah import.

**Diambil:** 2026-07-31, dari DB produksi via `supabase db query --linked`.
**Cakupan:** semua order berstatus `completed` + `cancelled`.

---

## 1. Grand total (kunci verifikasi utama)

| Metrik | Nilai |
|---|---|
| Order `completed` | **24.363** |
| Omzet `completed` (Completed Only) | **Rp 1.446.455.714** |
| Order `cancelled`/void | **180** |
| Nilai void | **Rp 9.500.881** |
| Omzet **NET** (completed − void) | **Rp 1.436.954.833** |
| — dari impor Pawoon (`external_order_id` terisi) | Rp 1.240.930.998 (20.342 order) |
| — dari sistem sendiri (native) | Rp 205.524.716 (4.021 order) |

> ⚠️ Dua metodologi sengaja dicatat keduanya karena dua halaman laporan memakai
> aturan berbeda (lihat bagian 4). Pastikan membandingkan apples-to-apples.

## 2. Per outlet

Lihat `baseline_outlet.txt` (kolom: order completed, omzet completed, void,
omzet pawoon vs native, rentang tanggal, jumlah hari ada data).

Lima terbesar:

| Outlet | Order | Omzet completed | Pawoon | Native |
|---|---|---|---|---|
| MITRA SENTUL | 2.965 | Rp 149.412.332 | Rp 143.164.000 | Rp 6.248.332 |
| MITRA CIBINONG | 2.258 | Rp 129.507.181 | Rp 124.443.324 | Rp 5.063.857 |
| SUKA SHAWARMA CIMANGGU | 2.169 | Rp 125.384.749 | Rp 96.610.660 | Rp 28.774.089 |
| MITRA CIBUBUR | 1.441 | Rp 122.066.902 | Rp 115.011.548 | Rp 7.055.354 |
| SUKA SHAWARMA EMPANG | 2.151 | Rp 120.699.424 | Rp 85.779.348 | Rp 34.920.076 |

## 3. Lubang data — yang diharapkan terisi setelah import

**92 outlet-hari kosong** sepanjang Juli (outlet jualan saja, tidak termasuk
KANTOR PUSAT / GUDANG PUSAT (HQ) / outlet tes).

| Outlet | Bolong | Tanggal |
|---|---|---|
| MITRA CILEUNGSI | 30 | seluruh Juli — **konfirmasi dulu: outlet ini beroperasi?** |
| MITRA CICURUG | 17 | 01–17 Juli |
| SUKA SHAWARMA BNR | 8 | 01–05, 16, 19, 24 |
| SUKA SHAWARMA JATIASIH | 6 | 23–28 |
| JAGAKARSA / PEKAYON / JATIWARINGIN / BEJI | 4 | 25–28 |
| SAWANGAN / KALISARI | 3 | 25–27 |
| CIRENDEU | 3 | 25, 26, 28 |
| SENTUL | 2 | 26–27 |
| EMPANG / PAJAJARAN / PALEDANG | 1 | **24 Juli** |
| DEPOK SUKMAJAYA | 1 | 25 Juli |

**Dua pola berbeda:**
1. **Celah migrasi (25–28 Juli)** — impor Pawoon berhenti, sistem sendiri belum
   jalan di outlet itu. Penjualan riil tapi tak masuk sistem manapun.
2. **Anomali 24 Juli** — Empang, Pajajaran, Paledang, BNR bolong *hanya* di
   tanggal itu (23 & 25 ada). Bukan pola migrasi; lebih mirip satu batch impor
   Pawoon yang terlewat.

Cakupan outlet per hari turun drastis 24–28 Juli (15 → 12 → 11 → 12 → 15
outlet, vs normal 19–21), lalu pulih ke 21 outlet pada 29–30 Juli.

## 4. ⚠️ Peringatan metodologi (jebakan yang sudah pernah terjadi)

Dua halaman laporan memakai aturan void **berbeda**:

| Halaman | Filter | Angka |
|---|---|---|
| `/dashboard/pawoon-import/profit` | `['completed','cancelled']` + `sign=-1` → **NET** | Rp 1.436.954.833 |
| `/dashboard/reports/pos` | `status='completed'` → **Completed Only** | Rp 1.446.455.714 |

Selisih **Rp 9.500.881 (0,66%)**. Grand Total Excel Pawoon = **NET**.

Membandingkan Excel (net) vs halaman Completed Only akan **selalu** memunculkan
selisih palsu sebesar total void — persis kesalahan yang terdokumentasi di
`apps/admin-dashboard/docs/superpowers/specs/2026-07-29-pawoon-data-discrepancy-analysis.md`
bagian 4b. Samakan filter status kedua sisi sebelum menyimpulkan ada selisih.

**Status:** belum diputuskan apakah `reports/pos` ikut disamakan ke NET.

## 5. Yang perlu dicek setelah import

- [ ] Grand total naik; selisihnya = nilai yang mengisi 92 outlet-hari kosong
- [ ] Anomali 24 Juli (Empang, Pajajaran, Paledang, BNR) terisi
- [ ] Celah 25–28 Juli terisi untuk outlet yang belum pindah sistem
- [ ] Jatiasih 23–28 Juli terisi
- [ ] Cileungsi — pastikan statusnya sebelum dianggap lubang data
- [ ] **Tidak ada dobel**: order native yang sudah ada (Rp 205.524.716) tidak
      boleh bertambah/berubah. Importer idempoten via `external_order_id`,
      tapi tetap verifikasi angka native tidak berubah.
- [ ] **Channel struk multi-channel**: dokumen discrepancy bagian 6 mencatat bug
      ini kemungkinan masih ada di 18 outlet lain, belum terverifikasi karena
      Excel-nya belum tersedia. Tarik data ini = kesempatan menuntaskannya.

## 6. Berkas pendukung

Di scratchpad sesi (`.../scratchpad/`):
- `baseline_outlet.txt` — rincian per outlet
- `baseline_harian.txt` — rincian per tanggal
- `baseline_gap.txt` — peta lubang data
