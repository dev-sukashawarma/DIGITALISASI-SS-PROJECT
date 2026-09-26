# Cutoff Transisi Outlet Internal ke Kemitraan — Design Spec
_Date: 2026-09-26_

## 1. Latar Belakang & Masalah

Outlet **MITRA SAWANGAN** (`id: 550e8400-e29b-41d4-a716-446655440008`, slug: `sawangan-depok`) beroperasi sejak Juni 2026 sebagai cabang internal milik Pusat (`type: 'outlet'`). Pada tanggal 26 September 2026, profil kemitraan baru ("Mitra Sawangan") dibuat dan dikaitkan ke ID outlet tersebut.

Sistem Dashboard Kemitraan (`/dashboard/owner/kelola-mitra` dan `/dashboard/mitra`) menarik pesanan dan pengeluaran semata-mata berdasarkan `outlet_ids` pada profil mitra tanpa batasan tanggal mulai efektif (*cutoff date*). Akibatnya:
1. Omzet era internal (Juli – 25 September 2026) sebesar puluhan juta rupiah ikut tersedot ke dashboard kemitraan.
2. Perhitungan akrual BEP/ROI di `mitraRoi.ts` menghitung laba rugi bulan Agustus & September saat outlet masih beroperasi sebagai cabang internal.
3. Di Laba Rugi Owner (`ProfitView.tsx`), pemisahan scope `internal` vs `mitra` berpotensi tidak akurat untuk periode historis jika nama outlet sudah berlabel "MITRA".

Ketentuan bisnis yang disepakati: **Kemitraan Outlet Sawangan efektif dihitung mulai hari ini, 26 September 2026**. Seluruh transaksi sebelum tanggal tersebut tetap menjadi hak dan catatan cabang internal Pusat.

---

## 2. Pendekatan & Solusi Teknis

Sistem menerapkan **Solusi Terintegrasi** dengan menjadikan `tanggal_mulai` di tabel `mitra_investments` (dan `tanggal_pks` di `mitra_profiles`) sebagai *Single Source of Truth* batas tanggal aktif kemitraan.

---

## 3. Komponen Perubahan

### A. Data Setup (Database)
1. **Entri `mitra_investments` untuk Sawangan:**
   - `outlet_id`: `'550e8400-e29b-41d4-a716-446655440008'`
   - `tanggal_mulai`: `'2026-09-26'`
   - `nilai_investasi`: `0` (dapat disesuaikan di kemudian hari melalui form investasi)
   - `persentase_bagi_hasil`: `100` (atau sesuai skema BEP adaptif)
   - `management_fee`: `3`
   - `is_profit_sharing_active`: `true`
2. **Sinkronisasi `mitra_profiles`:**
   - Update profil `Mitra Sawangan` dengan `tanggal_pks = '2026-09-26'`.

### B. Database RPC (`get_mitra_orders_summary`)
File migrasi Supabase baru:
- Pada CTE `orders_filtered`:
  ```sql
  WHERE o.status = 'completed'
    AND o.outlet_id = ANY(p_outlet_ids)
    AND o.outlet_id != '00000000-0000-0000-0000-000000000000'
    AND o.created_at >= GREATEST(
      p_from,
      COALESCE((
        SELECT (mi.tanggal_mulai::text || ' 00:00:00+07')::timestamptz
        FROM public.mitra_investments mi
        WHERE mi.outlet_id = o.outlet_id
        LIMIT 1
      ), p_from)
    )
    AND o.created_at <= p_to
  ```
- Memastikan transaksi sebelum tanggal cutoff tidak pernah dihitung dalam pendapatan kemitraan.

### C. Server Actions Finansial Mitra (`mitraPnl.ts`)
1. Membaca `mitra_investments` per target outlet.
2. Menyaring OPEX (`petty_cash_expenses` dan `expenses`):
   - Jika expense memiliki `expense_date < outletCutoffDate`, abaikan dari laporan mitra.
3. Menyaring waste (`stok_waste_reports`):
   - Hanya menyertakan laporan waste yang dibuat $\ge$ `outletCutoffDate`.
4. Menyaring settlement platform (`platform_settlements`):
   - Hanya menyertakan settlement pada tanggal $\ge$ `outletCutoffDate`.

### D. Akrual BEP & ROI Realtime (`mitraRoi.ts`)
1. Menentukan `outletStartMonth = (inv?.tanggal_mulai || '2026-08').slice(0, 7)`.
2. Untuk setiap iterasi bulan `m.key`:
   - Jika `m.key < outletStartMonth`: lewati perhitungan akrual bulan tersebut untuk outlet yang bersangkutan (menghasilkan akrual Rp 0 untuk bulan sebelum tanggal mulai).
   - Untuk Sawangan (`tanggal_mulai = 2026-09-26`), bulan Agustus 2026 (`2026-08`) otomatis dilewati dan tidak menghasilkan akrual phantom.

### E. Sensitivitas Tanggal pada Scope Laba Rugi Owner (`outletOwnership.ts` / `ProfitView.tsx`)
1. Mendukung pemisahan scope berdasarkan tanggal transaksi:
   - Jika satu outlet beralih status di tanggal $D$, transaksi dengan tanggal $< D$ dikelompokkan ke `scope: 'internal'`.
   - Transaksi dengan tanggal $\ge D$ dikelompokkan ke `scope: 'mitra'`.
2. Menjamin integritas laporan laba rugi Pusat untuk bulan-bulan sebelum peralihan.

---

## 4. Rencana Verifikasi

1. **Verifikasi Database:**
   - Memastikan baris `mitra_investments` untuk Sawangan tersimpan dengan `tanggal_mulai = '2026-09-26'`.
2. **Uji Coba RPC `get_mitra_orders_summary`:**
   - Memanggil RPC untuk Sawangan dengan rentang 1–25 September 2026: harus menghasilkan 0 order / Rp 0.
   - Memanggil RPC untuk Sawangan dengan rentang 26 September 2026: harus menghasilkan data order hari ini.
3. **Uji Coba Halaman Dashboard Kemitraan (`/dashboard/owner/kelola-mitra`):**
   - Filter "Bulan Ini": Omzet Sawangan hanya mencakup transaksi hari ini (26 September 2026), tidak ada kebocoran omzet internal dari awal September.
   - Tab BEP/ROI: Tidak ada akrual profit dari bulan Agustus 2026 untuk Sawangan.
