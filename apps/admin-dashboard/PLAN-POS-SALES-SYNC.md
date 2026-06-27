# Plan — Hubungkan Penjualan POS ke Dashboard Owner

**Status:** Implementasi kode SELESAI. Menunggu eksekusi (deploy + backfill) yang butuh kredensial.
**Tanggal:** 2026-06-26

## Tujuan
Penjualan POS yang **paid + selesai** dari project *sistem order* (`qntuhtkujpwudcpudwbj`)
otomatis masuk ke tabel `orders` **DB Utama** (`khpkoreaaucvyqfhynfq`) → tampil di view SPV
(`sales_summary_spv`, `sales_hourly_spv`) dan dashboard owner.

## Temuan Analisis
- **Dua project Supabase terpisah.** Dashboard owner baca DB Utama; transaksi POS asli di sistem order.
- **ID outlet beda total** antar project (nama/slug tak sejajar 1:1) → butuh tabel pemetaan.
- **Sudah ada sync sebagian tapi rusak:** `webhook-sync-order` memfilter `status='completed'`,
  padahal sistem order memakai `'done'` → **59 order tunai/manual (~Rp 4,9 juta) tidak masuk**.
- View `sales_summary_spv` di remote sempat tertimpa versi 3-kolom (oleh
  `apps/pos-kasir/fix_sales_summary_spv.sql` lama) → error "column outlet_name does not exist".

## Keputusan (dikonfirmasi user)
1. Mekanisme: **ETL sync ke DB Utama** (idempoten, terjadwal).
2. Omzet = kolom **`total`** (termasuk service fee).
3. "paid & selesai" = `status='done'` **DAN** (`paid_at` terisi **ATAU** `payment_method ∈ {cash, manual}`).
4. **Tidak menghapus** data lama (backfill aditif saja).
5. Eksekusi: user memberi akses agar dijalankan via CLI.

## Pemetaan Outlet (22 ter-seed)
Otomatis via normalisasi nama. 6 outlet POS dipetakan ke versi **MITRA** di DB Utama
(Cibinong, Ciseeng, Citayam, Kalisari, Pekayon, Tebet). Cibubur ganda → 1 outlet.
Dilewati: `cabang baru buka`, `Suka Shawarma Test` (tak ada padanan).

## Artefak (sudah dibuat)
| File | Fungsi |
|---|---|
| `supabase/migrations/20260626160000_pos_sales_sync.sql` | `pos_outlet_map` + index unik + trigger order_number + `pos_sync_state` |
| `supabase/migrations/20260626160500_restore_sales_summary_spv.sql` | Pulihkan view lengkap |
| `supabase/functions/sync-pos-sales/index.ts` | Edge Function ETL idempoten (incremental + `?full=1`) |
| `supabase/functions/sync-pos-sales/RUNBOOK.md` | Langkah deploy + cron |
| `apps/admin-dashboard/src/hooks/useSalesSummary.ts` | Dashboard resilient thd view rusak (sumber `sales_hourly_spv`) |
| `apps/pos-kasir/fix_sales_summary_spv.sql` | Diperbaiki agar tak merusak (definisi lengkap) |

## Verifikasi pra-eksekusi (read-only, sudah dilakukan)
- ✅ 22 pemetaan outlet cocok bersih; 83 order kandidat done+paid.
- ✅ 71 `external_order_id` di DB Utama semua unik → index unik aman.
- ✅ Kolom wajib `orders` (`id, outlet_id, order_number, total_amount, source, sales_source`)
  terpenuhi; `order_number` diisi trigger via sequence (mulai 9.000.000, anti-bentrok).

## Langkah Eksekusi (urut)
1. `supabase login` + `supabase link --project-ref khpkoreaaucvyqfhynfq`
2. `supabase db push` — terapkan 2 migrasi (restore view + infra sync)
3. `supabase secrets set ORDER_SYS_URL=… ORDER_SYS_SERVICE_KEY=…`
4. `supabase functions deploy sync-pos-sales`
5. Backfill: `POST …/sync-pos-sales?full=1` (≈81 order masuk, 2 dilewati)
6. Cron 10 menit (pg_cron + pg_net) — lihat RUNBOOK
7. Verifikasi dashboard owner menampilkan omzet POS asli & cocok dgn sumber

## Kredensial yang dibutuhkan
- **Supabase Personal Access Token** (Account → Access Tokens) → untuk `login` & deploy.
- **DB Password** project DB Utama (Settings → Database) → untuk `link` & `db push`.

⚠️ Rotate/revoke token & service-role setelah selesai (sudah tercatat di riwayat chat).

## Backlog terkait
- App **owner-dashboard** (`apps/owner-dashboard/src/hooks/useSalesSummary.ts`) memakai view sama →
  kena error identik; terapkan perbaikan serupa bila perlu.
- Pembersihan data dummy/seed **ditunda** (28 order tanpa `external_order_id` = campuran uji & input manual).
