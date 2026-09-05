# @suka/sales-board — Papan Monitoring Penjualan Harian

Papan view-only untuk TV/desktop: pcs terjual, transaksi, omzet kotor item,
ranking 20 outlet, dan perbandingan terhadap rata-rata hari-yang-sama bulan lalu.

Spec: `docs/superpowers/specs/2026-09-03-sales-board-realtime-design.md`

## Menjalankan lokal

```bash
cp .env.example .env.local   # isi URL + service role key
yarn workspace @suka/sales-board dev   # http://localhost:3040
```

## Env var (WAJIB di panel Coolify)

| Var | Stage | Catatan |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | builder + runner | |
| `SUPABASE_SERVICE_ROLE_KEY` | **runner** | Server-only. Dibaca `/api/board` saat runtime. |

`SUPABASE_SERVICE_ROLE_KEY` **tidak** ber-prefix `NEXT_PUBLIC_` dan tidak boleh
dibaca dari komponen klien mana pun.

## Catatan penting

- Papan ini **publik tanpa login** (keputusan owner 2026-09-03). Menambahkan
  auth nanti cukup memasang pemeriksaan sesi di `src/app/api/board/route.ts` —
  isi papannya tak berubah.
- **Tidak** memakai realtime `postgres_changes`: itu mengharuskan `anon` bisa
  `SELECT orders`, yang akan membuka seluruh isi tabel order ke publik.
- Omzet di papan = `SUM(order_items.subtotal)` (**omzet kotor item**), jadi
  tidak identik dengan laporan omzet admin-dashboard yang memperhitungkan
  diskon tingkat-order.
- Order import Pawoon (`external_order_id IS NOT NULL`) **tidak** dihitung.
- Data dihitung mulai **1 Agustus 2026**.
