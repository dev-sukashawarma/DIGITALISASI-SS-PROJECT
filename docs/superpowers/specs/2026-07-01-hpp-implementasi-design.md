# Spec: Implementasi HPP → Laba di Owner Dashboard

**Tanggal:** 2026-07-01
**App:** `apps/admin-dashboard` + migration DB (+ 1 kolom di `surat_jalan_item`)
**Status:** Design disetujui, siap masuk implementation plan.
**Basis keputusan:** [ADR-011](../../adr/0011-hpp-cogs-harga-terakhir-opname-harian.md) (Accepted).

## Latar Belakang

Halaman Profitabilitas (`/dashboard/owner/profit`) menghitung `Laba Bersih = Omzet − Expenses`; **HPP bahan baku belum masuk**. Owner minta laporan **Omzet − HPP** (Laba Kotor) yang presisi. ADR-011 sudah menetapkan model HPP: **opname periodik harian + snapshot harga per Order Session (Surat Jalan) + valuasi harga terakhir (Metode B)**. Spec ini mengimplementasikannya sampai tampil di layar.

## Keputusan Desain (hasil brainstorming)

| Topik | Keputusan |
|---|---|
| Perolehan HPP | Opname periodik (ADR-011) |
| Valuasi stok | Harga terakhir / snapshot (Metode B, ADR-011) |
| Lokasi hitung | **View/fungsi DB on-the-fly** (bukan tabel tersimpan) |
| Granularitas | **Per-batas-periode** (butuh opname di ujung; tahan opname bolong di tengah) |
| Tanggal barang masuk | **`surat_jalan.created_at`** (hari surat jalan dibuat = "hari dibeli") |
| Tampilan | **Tiga tingkat:** Omzet → −HPP → Laba Kotor → −Expenses → Laba Bersih |

## Tujuan & Non-Tujuan

**Tujuan:**
- Snapshot harga beli per item saat surat jalan dibuat.
- Hitung HPP per outlet untuk rentang periode (per-batas), tahan opname bolong.
- Tampilkan Laba Kotor (Omzet−HPP) + Laba Bersih (−Expenses) di Profitabilitas, scoped untuk mitra.

**Non-tujuan (fase lanjut):**
- Rincian HPP **per tanggal** (grafik harian) — hanya total periode dulu.
- Auto-deduction BOM per penjualan.
- Rata-rata bergerak / FIFO (tetap Metode B).
- HPP di app lain selain owner-dashboard.

## Arsitektur

### 1. Snapshot harga — kolom + trigger SECURITY DEFINER

Kolom baru di `surat_jalan_item`:
```sql
ALTER TABLE surat_jalan_item
  ADD COLUMN harga_snapshot NUMERIC NOT NULL DEFAULT 0 CHECK (harga_snapshot >= 0);
```

Diisi otomatis saat item dibuat lewat **trigger BEFORE INSERT SECURITY DEFINER** (pembuat surat jalan = kitchen/pusat **tidak boleh baca** `bahan_baku_harga` yang admin-only → harus definer):
```sql
CREATE OR REPLACE FUNCTION fill_harga_snapshot() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(NEW.harga_snapshot, 0) = 0 THEN
    SELECT COALESCE(harga_beli, 0) INTO NEW.harga_snapshot
    FROM bahan_baku_harga WHERE bahan_baku_id = NEW.bahan_baku_id;
    NEW.harga_snapshot := COALESCE(NEW.harga_snapshot, 0);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_fill_harga_snapshot
  BEFORE INSERT ON surat_jalan_item
  FOR EACH ROW EXECUTE FUNCTION fill_harga_snapshot();
```
Robust untuk semua jalur insert (SuratJalanForm client, RPC apa pun). Harga 0 bila belum di-set admin (HPP kurang-hitung; wajar).

### 2. View building-block (pola `sales_daily_spv`)

**Nilai stok harian** (dari opname finalized × harga snapshot terbaru ≤ tanggal):
```sql
CREATE OR REPLACE VIEW hpp_nilai_stok_harian_spv WITH (security_barrier = true) AS
SELECT op.outlet_id, op.tanggal, SUM(oi.qty_fisik * lp.harga) AS nilai_stok
FROM opname op
JOIN opname_item oi ON oi.opname_id = op.id
JOIN LATERAL (
  SELECT sji.harga_snapshot AS harga
  FROM surat_jalan_item sji JOIN surat_jalan sj ON sj.id = sji.surat_jalan_id
  WHERE sj.outlet_id = op.outlet_id AND sji.bahan_baku_id = oi.bahan_baku_id
    AND (sj.created_at AT TIME ZONE 'Asia/Jakarta')::date <= op.tanggal
    AND sji.harga_snapshot > 0
  ORDER BY sj.created_at DESC LIMIT 1
) lp ON true
WHERE op.status = 'finalized' AND op.tipe = 'harian' AND oi.qty_fisik IS NOT NULL
GROUP BY op.outlet_id, op.tanggal;
```

**Barang masuk harian** (qty terverifikasi × snapshot, tanggal = surat jalan dibuat):
```sql
CREATE OR REPLACE VIEW hpp_barang_masuk_harian_spv WITH (security_barrier = true) AS
SELECT sj.outlet_id,
       (sj.created_at AT TIME ZONE 'Asia/Jakarta')::date AS tanggal,
       SUM(sji.qty_terima * sji.harga_snapshot) AS nilai_masuk
FROM surat_jalan sj JOIN surat_jalan_item sji ON sji.surat_jalan_id = sj.id
WHERE sji.qty_terima IS NOT NULL
GROUP BY sj.outlet_id, (sj.created_at AT TIME ZONE 'Asia/Jakarta')::date;
```

### 3. Fungsi HPP periode (per-batas, scoped)

`get_hpp_periode(p_from, p_to)` — SECURITY DEFINER, dibatasi `accessible_outlet_ids()` (owner/admin → semua, mitra → 1 outlet; pola sama `get_current_targets`):
```sql
CREATE OR REPLACE FUNCTION get_hpp_periode(p_from date, p_to date)
RETURNS TABLE(outlet_id uuid, hpp numeric)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH stok_awal AS (
    SELECT DISTINCT ON (outlet_id) outlet_id, nilai_stok
    FROM hpp_nilai_stok_harian_spv WHERE tanggal < p_from
    ORDER BY outlet_id, tanggal DESC
  ),
  stok_akhir AS (
    SELECT DISTINCT ON (outlet_id) outlet_id, nilai_stok
    FROM hpp_nilai_stok_harian_spv WHERE tanggal <= p_to
    ORDER BY outlet_id, tanggal DESC
  ),
  masuk AS (
    SELECT outlet_id, SUM(nilai_masuk) AS total
    FROM hpp_barang_masuk_harian_spv WHERE tanggal BETWEEN p_from AND p_to
    GROUP BY outlet_id
  )
  SELECT o.id,
    COALESCE(sa.nilai_stok,0) + COALESCE(m.total,0) - COALESCE(se.nilai_stok,0)
  FROM outlets o
  LEFT JOIN stok_awal sa ON sa.outlet_id = o.id
  LEFT JOIN stok_akhir se ON se.outlet_id = o.id
  LEFT JOIN masuk m ON m.outlet_id = o.id
  WHERE o.id IN (SELECT public.accessible_outlet_ids());
$$;
GRANT EXECUTE ON FUNCTION get_hpp_periode(date, date) TO authenticated;
```
`DISTINCT ON ... ORDER BY tanggal DESC` = "opname finalized terdekat ≤ batas" (fallback opname bolong). Stok awal = opname terakhir **sebelum** `p_from`; stok akhir = opname terakhir **≤** `p_to`.

### 4. Hook `useHpp` (pola `useSalesDaily`)

`apps/admin-dashboard/src/hooks/useHpp.ts` — panggil RPC, kembalikan `{ rows: {outlet_id, hpp}[], loading, error }`. Filter `outletId` client-side (scope sudah dijamin fungsi). `queryKey: ['hpp', from, to, outletId]`, `staleTime: 2*60_000`.

### 5. Helper murni + halaman Profitabilitas

Helper `apps/admin-dashboard/src/lib/profit.ts` (dapat di-unit-test):
```ts
export function computeProfit(omzet: number, hpp: number, expenses: number) {
  const labaKotor = omzet - hpp
  const labaBersih = labaKotor - expenses
  return {
    labaKotor, labaBersih,
    marginKotor: omzet > 0 ? (labaKotor / omzet) * 100 : 0,
    marginBersih: omzet > 0 ? (labaBersih / omzet) * 100 : 0,
  }
}
```

`profit/page.tsx` — tambah `const hpp = useHpp(filter, outlets)`; `totalHpp = Σ hpp.rows.hpp`; ganti perhitungan jadi `computeProfit(totalOmzet, totalHpp, totalExpenses)`. UI:
- KPI: tambah kartu **HPP** & **Laba Kotor** (+ margin kotor) di samping Laba Bersih.
- Tabel per-outlet: tambah kolom **HPP** & **Laba Kotor**; `net` per outlet = `omzet − hpp − expense`.
- Breakdown map: seed `hpp: 0` per outlet, isi dari `hpp.rows`.

## Aliran Data

```
Buat Surat Jalan → insert surat_jalan_item → trigger definer isi harga_snapshot (dari bahan_baku_harga)
Verifikasi terima → qty_terima terisi
Opname harian finalized → qty_fisik per bahan
Owner buka Profitabilitas (pilih periode)
  → useHpp → rpc get_hpp_periode(from,to)
      → stok_awal (opname ≤ from) + Σ barang_masuk(from..to) − stok_akhir (opname ≤ to), per outlet accessible
  → computeProfit(omzet, hpp, expenses) → Laba Kotor & Laba Bersih + margin
```

## Error Handling / Edge Cases

- **Harga belum di-set** → snapshot 0 → item itu tak menyumbang HPP (undercount). Diterima; admin diarahkan isi harga di Master Bahan Baku.
- **Opname bolong di tengah periode** → tak berpengaruh (per-batas hanya lihat ujung).
- **Tak ada opname sama sekali ≤ batas** → `nilai_stok` NULL → `COALESCE(...,0)`; HPP = barang masuk saja (over-estimate) sampai ada opname. Konsisten & tak error.
- **Surat jalan belum diverifikasi** (`qty_terima` NULL) → belum dihitung sampai verifikasi.
- **Mitra** → `get_hpp_periode` & view scoped via `accessible_outlet_ids()`; hanya 1 outlet.
- **`total_amount`/omzet 0** → margin 0 (guard `omzet > 0`).

## Testing

- **`profit.test.ts`** (vitest, pure) — `computeProfit`: laba kotor/bersih & margin; kasus omzet 0; hpp > omzet (laba kotor negatif).
- **Smoke SQL** (manual, dicatat di plan) — skenario Item A: SJ Senin @7.000, SJ Kamis @10.000, opname finalized; verifikasi `get_hpp_periode` untuk rentang Sen–Rab memakai 7.000 dan tahan bila opname Selasa dihapus (per-batas tetap benar).
- **Type-check + build** admin-dashboard hijau.

## Isolasi & Dampak

- **Aditif:** hanya +1 kolom `surat_jalan_item.harga_snapshot` + trigger; sisanya objek baru (2 view, 1 fungsi, 1 hook, 1 helper, edit 1 halaman).
- `surat_jalan`, `opname`, `ledger_stok`, `bahan_baku` **tak diubah** strukturnya.
- View/fungsi memakai pola definer + `accessible_outlet_ids()` yang sudah ada → owner/admin/mitra konsisten, tak menyentuh app lain.
- `bahan_baku_harga` tetap admin-only; harga hanya terekspos sebagai **agregat HPP** (bukan harga per bahan) ke owner/mitra lewat fungsi — tak membocorkan harga satuan.

## Catatan Migration

- Aditif; ikuti playbook history-drift (`migration list` → `repair` bila perlu → `db push`).
- Urutan objek: kolom+trigger → 2 view → fungsi (fungsi bergantung view).
