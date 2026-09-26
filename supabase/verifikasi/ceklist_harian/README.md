# Uji backend ceklist harian

Uji RPC `submit_ceklist_harian` / `tinjau_ceklist_harian`, RLS, dan storage
`ceklist-harian-foto`, terhadap DB bersama (produksi). **Aman dijalankan ulang:**

- `t1_fungsi.mjs` — 27 kasus dalam SATU transaksi yang diakhiri `RAISE` → rollback
  total, termasuk antrean `pg_net` (tidak ada push terkirim). Menyamar lewat
  `request.jwt.claims`. `PRA=<berkas.sql> node t1_fungsi.mjs` menerapkan berkas itu
  dulu di transaksi yang sama — dry-run migration sebelum diterapkan sungguhan.
- `t2_race.mjs` — koneksi paralel sungguhan (A menahan 4 dtk, B menyerbu, C memotret
  `pg_locks`). Semua rollback. Lulus bila B menunggu di kunci `advisory` (kiriman
  pertama bersamaan) / `transactionid` (dua peninjau bersamaan). Mengunci sebentar
  outlet dummy KANTOR PUSAT dan laporan nyata 24 Sep 2026 (≤ 4 dtk).
- `t3_http.mjs` — jalur yang dipakai web/native dengan JWT per role (ditandatangani
  `SUPABASE_JWT_SECRET`): RLS baca, resolusi RPC bernama, storage. Satu foto 1×1
  diunggah lalu dihapus.

```bash
node supabase/verifikasi/ceklist_harian/t1_fungsi.mjs
```

Fixture memakai UUID staf/outlet nyata per 25 Sep 2026 (AM Muhtar Arifin & Mulyadi,
RM Indra Adam Sami, crew Fahmi Alaydrus, outlet tes). Perbarui bila staf berganti.
