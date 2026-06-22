# E2E Test — Role `spv`

> Prasyarat bersama: lihat [README.md](README.md). Akun: baris **spv**.
> Jobdesk: Supervisor pembina **lintas semua 19 outlet**, monitoring/evaluasi (read-heavy).

## Cakupan
spv akses **absensi, stok, distribusi** — semua outlet (via view definer SPV).
Tidak akses pos-kasir, owner-dashboard, admin.

---

## TC-SPV-01 — Login & launcher
- [ ] Login portal → launcher menampilkan: **Absensi, Stok, Distribusi**.
- [ ] Tidak ada kartu pos-kasir / owner-dashboard / admin.

## TC-SPV-02 — Absensi lintas outlet
- [ ] `/dashboard/rekap` → rekap absensi crew **semua outlet** (bukan 1).
- [ ] `/dashboard/papan-kehadiran` → papan kehadiran lintas outlet tampil.
- [ ] `/dashboard/checklist-monitor` → monitoring checklist outlet tampil.

## TC-SPV-03 — Stok lintas outlet (monitoring)
- [ ] `/stok/monitoring-live` → papan **semua 19 outlet** (bukan 1).
- [ ] `/stok/monitoring` → ringkasan stok lintas outlet.
- [ ] `/stok/ledger` → ledger pergerakan stok lintas outlet dapat dilihat.
- [ ] `/stok/monitoring-live/[outlet-id]` → drill-down detail per outlet jalan.

## TC-SPV-04 — Distribusi
- [ ] `/distribusi/riwayat` → riwayat surat jalan antar outlet tampil.
- [ ] `/distribusi/pengiriman` → status pengiriman dapat dipantau.

## TC-SPV-05 — Batasan
- [ ] POS Kasir → ditolak.
- [ ] Owner Dashboard → ditolak.
- [ ] Admin Dashboard → ditolak.
- [ ] Tidak ada fungsi kelola akun / atur threshold (itu wewenang admin).

---

## Kemungkinan masalah & troubleshooting

| Gejala | Penyebab mungkin | Tindakan |
|--------|------------------|----------|
| Stok/absensi hanya menampilkan **1 outlet** untuk SPV | View definer SPV tak dipakai / SPV ter-set `outlet_id` + role salah | Pastikan query pakai `monitoring_view_spv`/`ledger_feed_spv` (definer, bypass RLS); cek `outlet_staff.role='spv'` |
| SPV tak lihat outlet tertentu | Data `monitoring_view_spv` belum agregat outlet itu / threshold-ORP drift | Lihat memory "Monitoring Views Threshold & ORP Drift" |
| SPV pernah ter-set role `leader` (kasus lama) | Data outlet_staff salah role | Lihat catatan CLAUDE.md sesi 2026-06-17 (SPV punya role leader di kitchen) |
| Ledger lintas outlet error/kosong | Query langsung ke `ledger_stok` kena RLS `ledger_read` | Gunakan view definer, jangan query tabel mentah untuk cross-outlet |
| Launcher kurang/lebih app | `ROLE_APP_ACCESS.spv` ≠ `['absensi','stok','distribusi']` | Cek `packages/auth/src/access.ts` |
| Halaman lambat saat pindah app | `SUPABASE_JWT_SECRET` belum di-set | Set di env app |

## Hasil
| Tester | Tanggal | Status (✅/❌/⚠️) | Catatan |
|--------|---------|------|---------|
| | | | |
