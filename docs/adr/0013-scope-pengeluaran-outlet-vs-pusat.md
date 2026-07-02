# ADR-013 — Scope Pengeluaran: Outlet vs Pusat (nullable outlet_id)

- Status: **Accepted**
- Tanggal: 2026-07-01
- Terkait: CONTEXT.md ("Pengeluaran/Expenses" — scope Outlet vs Pusat), ADR-0009 (omzet terpusat), ADR-0011 (HPP), ADR-0007/0001 (outlet_staff). Spec: `docs/superpowers/specs/2026-07-01-expenses-outlet-vs-pusat-design.md`.

## Konteks

Pengeluaran perusahaan punya dua sifat berbeda:
- **Pengeluaran Outlet** — biaya tanggung jawab satu outlet (gaji crew, promo, listrik, sewa, dll). Harus dibebankan ke P&L outlet tsb.
- **Pengeluaran Pusat** — biaya level perusahaan (**Pengeluaran Global**, **Gaji Staff Kantor**), **company-wide (satu nilai, bukan per-outlet)**. Harus **dikecualikan dari P&L per-outlet** (agar kinerja outlet/leader dinilai adil) tapi **tetap dihitung di P&L company-wide** (uang beneran keluar).

Tabel `expenses` awalnya `outlet_id NOT NULL` — memaksa setiap biaya nempel ke outlet, sehingga biaya pusat tak bisa direpresentasikan tanpa mencemari laba outlet.

## Keputusan

**`expenses.outlet_id` dijadikan nullable; `NULL` = Pengeluaran Pusat (company-wide).** Scope tidak disimpan sebagai kolom terpisah melainkan **ditentukan kategori** dan dikunci constraint:

```sql
CHECK ( (category IN ('pengeluaran_global','gaji_staff_kantor')) = (outlet_id IS NULL) )
```

Kategori pusat wajib `outlet_id NULL`; kategori outlet wajib punya `outlet_id`. Keunikan rekap bulanan dijaga unique index `(outlet_id, category, period_month) NULLS NOT DISTINCT`.

RLS: baris outlet dibaca per `accessible_outlet_ids()`; baris pusat (`NULL`) hanya owner/admin. Mitra/leader otomatis tak pernah lihat biaya pusat.

## Alternatif yang ditolak

- **Outlet dummy "Kantor Pusat" menampung biaya pusat** — outlet dummy akan bocor ke dropdown & tabel "Profitabilitas per Outlet" sebagai outlet rugi besar (ada expense, nol omzet), harus di-exclude manual di banyak tempat. Rapuh.
- **Tabel terpisah `expenses_pusat`** — bersih secara isolasi tapi menduplikasi struktur; setiap laporan company-wide harus UNION dua sumber. Kompleksitas tak sepadan untuk 2 kategori.
- **Kolom `scope` eksplisit** — redundan; scope sudah deterministik dari kategori, dan CHECK di atas sudah menjamin konsistensi tanpa kolom tambahan.

## Konsekuensi

- **Positif:** satu tabel, satu model; integritas scope terkunci constraint; reporting jelas (outlet = filter `outlet_id`, company = sertakan `NULL`); laba outlet vs perusahaan bisa dibedakan tegas.
- **Negatif / hati-hati:** `outlet_id NULL` menuntut semua query/laporan sadar-scope (lupa memfilter → biaya pusat bocor ke tampilan outlet, atau sebaliknya laba perusahaan overstated). Perlu ditegakkan di query layer + test.
- **Migrasi:** kategori enum lama (6) dibuang total tanpa mapping; data lama dikosongkan (`DELETE`) dan diisi ulang lewat form rekap bulanan baru. Aman karena data dummy sudah dihapus (migration `20260625110000`).
