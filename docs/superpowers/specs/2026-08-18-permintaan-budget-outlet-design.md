# Permintaan Bahan Baku Berbasis Budget Outlet — Design Spec

**Tanggal:** 2026-08-18
**App:** `apps/stok`
**Status:** Draft — menunggu review user

## 1. Latar Belakang

Halaman `/stok/permintaan` (role crew) saat ini punya dua cara mengajukan permintaan bahan baku, ditata sebagai dua tab di [PermintaanForm.tsx](../../../apps/stok/src/components/permintaan/PermintaanForm.tsx):

- **"🍔 Target Menu (Jualan)"** — crew input target porsi menu terjual, sistem hitung kebutuhan bahan otomatis via BOM/resep (`calculateBahanBakuRequest`).
- **"📦 Tambah Manual"** — crew pilih bahan baku + qty langsung, dengan saran item kritis (stok menipis) dari `monitoring_view_crew`.

Tab "Target Menu" akan **dihapus**. Alur "Tambah Manual" jadi satu-satunya cara mengajukan permintaan, dan ditambah lapisan **budget pembelian per outlet**: owner menetapkan plafon Rupiah per outlet per periode; crew dan approver (kitchen/admin/owner) melihat status budget saat mengajukan/menyetujui, tapi keputusan blokir tetap di tangan approver — sistem tidak memblokir submit otomatis.

## 2. Tujuan

- Hilangkan alur "order by menu" — sederhanakan jadi satu alur permintaan bahan baku langsung.
- Beri owner kontrol plafon belanja per outlet (nominal + periode, bisa beda tiap outlet).
- Beri visibilitas nilai Rupiah permintaan ke crew (sebelum kirim) dan approver (saat approve), tanpa mengekspos harga per-unit mentah ke crew (RLS `bahan_baku_harga` tetap admin-only).
- Histori nilai budget yang sudah disetujui harus stabil terhadap perubahan `harga_beli` di masa depan (snapshot, bukan live).

## 3. Non-Tujuan

- Tidak memblokir submit atau approve otomatis saat melebihi budget — murni informasi/badge untuk keputusan manusia (approver).
- Tidak membangun sistem approval bertingkat baru — approval tetap satu langkah kitchen/admin/owner seperti sekarang.
- Tidak mengubah logika BOM/resep di tempat lain (COGS, waste, dll) — hanya mencabut penggunaannya dari form permintaan crew.
- Tidak retroaktif menghitung ulang budget untuk permintaan lama (histori sebelum fitur ini tidak punya `harga_snapshot`, akan dianggap Rp 0 di laporan budget).

## 4. Model Data

### 4.1 Tabel baru: `outlet_budget_config`

Satu baris aktif per outlet. Diubah = overwrite (bukan versioned history) — periode berjalan baru dihitung dari `effective_from` yang di-update.

```sql
CREATE TABLE outlet_budget_config (
  outlet_id      UUID PRIMARY KEY REFERENCES outlets(id) ON DELETE CASCADE,
  nominal        NUMERIC NOT NULL CHECK (nominal >= 0),
  period_type    TEXT NOT NULL CHECK (period_type IN ('harian', 'mingguan', 'bulanan')),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  updated_by     UUID REFERENCES outlet_staff(id),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**RLS:**
- `SELECT`: `authenticated`, dibatasi `outlet_id IN (SELECT accessible_outlet_ids())` (crew lihat outlet sendiri; kitchen/admin/owner/spv lihat semua — pola sama seperti `ledger_read`).
- `INSERT`/`UPDATE`/`DELETE`: owner-only (`EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND role = 'owner' AND status = 'active')`).

Outlet tanpa baris di tabel ini = **dianggap tak terbatas** — semua badge/UI budget disembunyikan untuk outlet itu (bukan Rp 0).

### 4.2 Kolom baru: `permintaan_bahan_item.harga_snapshot`

```sql
ALTER TABLE permintaan_bahan_item
  ADD COLUMN IF NOT EXISTS harga_snapshot NUMERIC;
```

Diisi oleh `approve_permintaan_svc` saat item disetujui: `harga_snapshot := bahan_baku_harga.harga_beli` (harga saat itu, COALESCE 0 kalau tak ada baris harga). `NULL` untuk item lama (pre-fitur ini) dan untuk item yang ditolak (`qty_disetujui = 0`) — dianggap Rp 0 dalam agregasi.

Nilai kontribusi item ke budget = `qty_disetujui * harga_snapshot`.

### 4.3 RPC: `get_outlet_budget_status(p_outlet_id UUID)`

`SECURITY DEFINER` (perlu baca `bahan_baku_harga` yang admin-only RLS, dan `permintaan_bahan_item` lintas status). Mengembalikan:

```
outlet_id, nominal, period_type, period_start, period_end, terpakai, sisa, has_config (bool)
```

Logika:
1. Ambil `outlet_budget_config` untuk outlet. Kalau tak ada baris → `has_config = false`, field lain default.
2. Hitung `period_start`/`period_end` dari `period_type` + `effective_from` relatif ke `now()` (WIB):
   - `harian`: periode = hari kalender berjalan.
   - `mingguan`: periode 7 hari berulang dari `effective_from` (anchor hari-minggu = hari `effective_from`).
   - `bulanan`: periode = bulan kalender berjalan (tanggal 1 s/d akhir bulan) — bukan rolling 30 hari dari `effective_from`, supaya intuitif ("budget Agustus").
3. `terpakai = SUM(pbi.qty_disetujui * COALESCE(pbi.harga_snapshot, 0))` untuk semua `permintaan_bahan` outlet itu dengan `status = 'disetujui'` dan `permintaan_bahan.created_at` dalam `[period_start, period_end]`.
4. `sisa = nominal - terpakai` (boleh negatif).

### 4.4 RPC estimasi keranjang (belum-submit): `estimate_permintaan_value(p_items JSONB)`

`SECURITY DEFINER`, input `[{bahan_baku_id, qty}]` dalam base unit, output `{total_nilai NUMERIC, item_tanpa_harga UUID[]}`. Dipakai form crew untuk estimasi live tanpa expose harga per-item ke client (hanya total agregat + daftar ID yang belum berharga, untuk label "Harga belum di-set").

## 5. Backend — Server Actions (`apps/stok/src/app/actions/budget.ts`, baru)

Mengikuti pola existing di `permintaan.ts` (service-role client + gerbang otorisasi eksplisit — **wajib**, mengacu insiden [Server Action authz gap](../../../CLAUDE.md) sesi 2026-07-20).

```
requireOwner(): Promise<string>
  — cek outlet_staff.role === 'owner' && status === 'active'. Dipakai untuk write config.

getOutletBudgetStatus(outletId: string): Promise<BudgetStatus>
  — guard: assertOutletAccessible (crew outlet sendiri) ATAU requirePermintaanViewer (approver semua outlet).
  — panggil RPC get_outlet_budget_status.

listOutletBudgets(): Promise<Array<{outlet_id, outlet_name, ...BudgetStatus}>>
  — owner-only. Untuk halaman /stok/budget-outlet: loop semua outlet operasional (exclude Kantor Pusat/HQ dummy, exclude outlet type marketplace bila relevan) + panggil RPC per outlet (atau versi RPC ber-batch bila perlu performa; tidak kritis karena hanya 19 outlet, dipanggil jarang oleh owner).

setOutletBudgetConfig(outletId: string, nominal: number, periodType: 'harian'|'mingguan'|'bulanan'): Promise<void>
  — requireOwner(), lalu upsert outlet_budget_config (effective_from = now()).

estimateCartValue(items: {bahan_baku_id: string, qty: number}[]): Promise<{totalNilai: number, itemTanpaHarga: string[]}>
  — guard ringan: user harus outlet_staff aktif (tak perlu approver). Panggil RPC estimate_permintaan_value.
```

## 6. Perubahan RPC existing (dampak pada migration tanpa file SQL di repo)

`approve_permintaan_svc` perlu ditambah logika isi `harga_snapshot` saat approve. **Karena RPC ini tidak punya file SQL tertelusuri di repo** (temuan sesi 2026-07-20 — hanya ada live di DB), langkah wajib sebelum menulis migration baru:

1. `supabase db query "SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'approve_permintaan_svc'" --linked` untuk ambil definisi live yang sebenarnya.
2. Tulis migration baru `CREATE OR REPLACE FUNCTION approve_permintaan_svc(...)` berbasis definisi itu + tambahan `harga_snapshot` fill, **bukan** menulis ulang dari asumsi/kode lama di repo.
3. Sisipkan baris `SET harga_snapshot = (SELECT harga_beli FROM bahan_baku_harga WHERE bahan_baku_id = pbi.bahan_baku_id)` (COALESCE 0) di UPDATE item saat status jadi `disetujui`.

Ini pola yang sama dipakai untuk insiden `20260708100001` (fix manual di SQL Editor setelah verifikasi `pg_get_functiondef`) — dicatat sebagai preseden di CLAUDE.md.

## 7. UI — Crew (`PermintaanForm.tsx`)

- Hapus: tab switcher (`activeTab` state), seluruh render cabang `'katalog'`, state `menuTargets`, `menus`/`loadingMenus`, `useEffect` fetch `fetchActiveResep`, `useEffect` kalkulasi `calculateBahanBakuRequest`, bagian `finalCart` yang menggabungkan `calculatedResult`. Import `fetchActiveResep`/`calculateBahanBakuRequest`/`ResepMenu`/`CalculatedBahan` dari `permintaan_target` dihapus dari file ini (tetap dipakai di `ApprovalModal.tsx` untuk histori lama, tidak disentuh).
- Konten yang sebelumnya di tab "📦 Tambah Manual" (picker bahan baku, saran item kritis, list manual dengan stepper qty) jadi **satu-satunya tampilan** halaman — tanpa tab wrapper.
- `submit()` tak lagi kirim `targetMetadata` (kirim array kosong / `undefined` — kompatibel dengan `buatPermintaan` yang sudah punya default `[]`).
- **Badge budget** (komponen baru `BudgetBadge`) tampil di atas form (dan di cart view): "Sisa Budget {Periode} Ini: Rp X dari Rp Y" — hanya render kalau `has_config === true` untuk outlet itu. Warna: hijau (< 80% terpakai termasuk estimasi keranjang), oranye (80–100%), merah (lewat 100%).
- Di cart view, tampilkan estimasi total nilai keranjang saat ini (dari `estimateCartValue`, debounce sama seperti kalkulasi lama) dan bandingkan visual ke sisa budget — **tombol kirim tetap aktif**, tak ada disable state terkait budget.
- Item dengan harga belum di-set (`itemTanpaHarga`) diberi label kecil "Harga belum di-set" di baris cart-nya (tidak menghalangi kirim).
- Hapus file `TargetMenuCalculator.tsx` (dead code, tak dipakai di mana pun setelah audit).

## 8. UI — Approver (`ApprovalList.tsx` + `ApprovalModal.tsx`)

- `ApprovalList`: tiap card permintaan dapat tambahan `BudgetBadge` kecil (variant compact) di baris badge yang sudah ada ("Persetujuan", "Potensi Omzet") — pakai `getOutletBudgetStatus(outlet_id)` + hitung estimasi nilai permintaan itu (`SUM(qty_diminta * harga_beli_terkini)` — pakai `estimateCartValue`, karena belum disetujui belum ada snapshot) dibanding sisa budget outlet. Label: "Dalam Budget" (hijau) / "Melebihi Budget +Rp X" (merah) — hanya render kalau outlet itu `has_config`.
- `ApprovalModal`: tambah ringkasan nilai Rupiah total permintaan (`SUM(qtys[id] * harga_beli terkini)`, live mengikuti stepper qty yang diedit approver) + `BudgetBadge` yang sama, ditempatkan dekat area Alasan/Actions supaya terlihat saat approver mau memutuskan.
- Tidak ada perubahan pada gerbang `canApprove`/`requirePermintaanApprover` — budget murni informasi tambahan, bukan syarat baru untuk approve/reject.

## 9. UI — Owner: Halaman `/stok/budget-outlet` (baru)

- Guard: hanya `role === 'owner'` (page-level guard, mengikuti pola `/dashboard/enroll` di apps/absensi — defense-in-depth di atas nav yang sudah role-filtered).
- List 19 outlet operasional (exclude Kantor Pusat/dummy HQ dan outlet `type='marketplace'` bila ada), tiap baris:
  - Nama outlet.
  - Status saat ini: kalau `has_config` → "Rp {nominal} / {periode}" + progress bar `terpakai/nominal` untuk periode berjalan; kalau belum → "Belum diset".
  - Tombol "Atur" → buka form inline/modal kecil: input nominal (Rupiah, format ribuan) + dropdown periode (Harian/Mingguan/Bulanan) → simpan via `setOutletBudgetConfig`.
- Entry nav: tambahkan link dari halaman settings/menu owner yang relevan (cek `BottomNav.tsx` atau menu admin existing di stok untuk pola penempatan — detail final di plan implementasi).

## 10. Edge Cases

| Kasus | Perilaku |
|---|---|
| Outlet belum ada `outlet_budget_config` | Semua badge/info budget disembunyikan di crew, approver, dan list owner menampilkan "Belum diset". Alur permintaan & approval jalan normal seperti sebelum fitur ini. |
| Bahan baku tanpa `harga_beli` (kosong/0) diminta | Dihitung Rp 0 dalam estimasi/snapshot, item tetap bisa diminta/disetujui, label "Harga belum di-set" ditampilkan di UI crew (dan opsional approver). |
| Permintaan lama (pre-fitur, `harga_snapshot` semua NULL) | Dianggap Rp 0 saat dihitung ulang oleh `get_outlet_budget_status` (COALESCE) — tak memengaruhi budget berjalan karena periode saat ini tak mencakup tanggal lama, kecuali kasus tepi awal rollout (periode bulan ini mencakup permintaan sebelum fitur di-deploy pada bulan yang sama → nilainya Rp 0, under-count sementara, dapa adanya — dicatat sebagai batasan, bukan bug). |
| Owner ubah nominal/periode di tengah periode berjalan | `effective_from` di-update ke saat itu → periode berjalan baru dihitung ulang dari titik itu. `terpakai` (berbasis `permintaan_bahan.created_at`) otomatis mengikuti window baru; tidak ada migrasi data historis khusus. |
| Reject permintaan | Tidak memotong budget sama sekali (`status != 'disetujui'` tak masuk agregasi `terpakai`). |
| Approve sebagian item (qty_disetujui < qty_diminta, atau beberapa item di-nol-kan) | `terpakai` hanya menghitung item dengan `qty_disetujui > 0` × `harga_snapshot`-nya sendiri — otomatis proporsional, tak perlu logika khusus. |

## 11. Testing

- Unit test pure function periode (`computeBudgetPeriod(periodType, effectiveFrom, now)`) untuk 3 tipe periode + edge tanggal (akhir bulan, pergantian tahun).
- Unit test `BudgetBadge` render states (hijau/oranye/merah/hidden-saat-belum-config).
- Server action test: `setOutletBudgetConfig` menolak non-owner (mirror pola test `requirePermintaanApprover` existing).
- Manual smoke test (tak ada e2e infra): set budget outlet test → ajukan permintaan crew → lihat badge di form → approve sebagian → verifikasi `sisa` berkurang sesuai `qty_disetujui × harga_snapshot`, bukan `qty_diminta`.

## 12. Rollout

1. Migration: `outlet_budget_config` + `harga_snapshot` kolom + 2 RPC baru (aditif, idempoten — tak mengganggu app lain).
2. Migration terpisah: `CREATE OR REPLACE approve_permintaan_svc` (berbasis `pg_get_functiondef` live, lihat §6) — **verifikasi ground-truth di DB live sebelum & sesudah**, bukan andalkan `migration list` saja (pola wajib proyek ini, mengingat riwayat migration remote sering diverged oleh tim lain).
3. Deploy kode `apps/stok` → redeploy `stok.sukashawarma.com` setelah migration ter-apply (breaking bila kode baru jalan sebelum kolom/RPC ada).
4. Owner isi budget outlet satu per satu via halaman baru — tak ada "big bang", outlet yang belum diisi tetap berjalan normal tanpa badge.
