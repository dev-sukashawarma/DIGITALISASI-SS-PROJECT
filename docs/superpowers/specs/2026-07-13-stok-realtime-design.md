# Stok Realtime Menyeluruh — Design

**Status:** Draft for review
**Date:** 2026-07-13
**App:** `apps/stok`

## Goal

Seluruh permukaan `apps/stok` yang saat ini bergantung pada polling atau refresh manual harus update secara instan (dalam hitungan detik) tanpa reload halaman, mengikuti pola yang sudah dibuktikan bekerja di `apps/absensi` (Session 2026-07-10: Absensi Realtime Menyeluruh).

Berlaku untuk seluruh role yang punya akses app `stok`: **admin, spv, kitchen, leader, crew** (lihat `packages/auth/src/access.ts`). Karena semua subscription difilter oleh RLS (`accessible_outlet_ids()`) yang sama dengan query biasa, satu implementasi otomatis benar untuk semua role — admin/spv/kitchen melihat lintas 19 outlet, leader melihat outlet binaannya, crew melihat outletnya sendiri.

## Analisis Kondisi Saat Ini (Case Table)

| # | Surface / Halaman | Tabel/View sumber data | Kondisi saat ini | Masalah (case) | Solusi realtime |
|---|---|---|---|---|---|
| 1 | Monitoring-Live (papan TV, 19 outlet) | `monitoring_view_spv`, `ledger_feed_spv`, `stockout_forecast_spv` (view di atas `stok_balance`+`ledger_stok`) | Polling `refetchInterval` 15-60s | Papan TV ditonton tanpa interaksi user → status stok bisa telat sampai 60 detik saat outlet ramai | Subscribe `stok_balance`+`ledger_stok` → invalidate query, debounce 2-3 detik per channel. Tambah fallback poll 2 menit khusus board ini sebagai jaring pengaman kalau koneksi realtime putus |
| 2 | SPV/Leader/Crew Dashboard | sama seperti #1 | Polling (`staleTime`), `useAutoRefresh` sengaja di-disable (`TODO: debug infinite loop`) | Dashboard hanya refresh saat user pindah halaman/refocus tab; auto-refresh mati total | Ganti mekanisme polling dengan realtime invalidate (sumber sama #1). `useAutoRefresh` jadi dead code → dihapus |
| 3 | Permintaan Bahan — list per outlet | `permintaan_bahan` | Sudah realtime (`usePermintaanList`) | — | Tidak ada perubahan |
| 4 | Permintaan Bahan — antrian approval | `permintaan_bahan` | Fetch sekali saat mount, tanpa subscribe/polling | Approver (leader/SPV/kitchen) tidak tahu ada request baru masuk kecuali refresh manual | Tambah subscribe realtime ke `permintaan_bahan` (semua outlet accessible), pola sama seperti `usePermintaanList` |
| 5 | Ledger & Riwayat Transaksi | `ledger_transaksi_ringkas` (view di atas `ledger_stok`) | Polling implisit (`staleTime` saja) | Entry ledger baru tak muncul sampai user pindah tab/refresh | Subscribe `ledger_stok` (filter outlet) → invalidate query ledger |
| 6 | Opname | `opname`, `opname_item` | Polling implisit (`staleTime` saja) | Draft/hasil opname dari device lain tak sinkron real-time | Subscribe `opname`+`opname_item` (filter outlet) → invalidate query |
| 7 | Waste Approval — antrian approver | `stok_waste_reports` | Fetch sekali saat mount, tanpa subscribe/polling | Approver tidak tahu ada laporan waste baru kecuali klik "Refresh" manual | Subscribe `stok_waste_reports` (status=PENDING, outlet accessible) → invalidate |
| 8 | Waste — status untuk crew pelapor | `stok_waste_reports` | Tidak ada UI sama sekali untuk crew lihat status laporan sendiri | Crew submit waste lalu tak pernah tahu disetujui/ditolak tanpa tanya manual | Halaman baru "Riwayat Waste Saya" + subscribe realtime ke laporan milik sendiri, toast saat status berubah |
| 9 | `useStokBalance` (dipakai WasteApprovalPage untuk cek saldo) | `stok_balance` | Polling manual `setInterval` 30s | Saldo yang ditampilkan saat approve waste bisa stale 30 detik | Ganti ke realtime invalidate (`stok_balance` sudah ada di publication dari fix pos-kasir) |

**Catatan lintas-tabel:**
- View tidak bisa langsung masuk publication Postgres → semua subscribe ke tabel dasar, lalu invalidate query React Query yang membaca view.
- RLS (`accessible_outlet_ids()`) tetap jadi gerbang di layer realtime — otomatis benar per role tanpa logic tambahan.

## Arsitektur

### Lib realtime (baru, port dari `apps/absensi/src/lib/realtime/`)

`apps/stok/src/lib/realtime/`:
- `createDebouncer` — batch banyak event jadi satu invalidate per jendela waktu (murni, unit-test)
- `subsSignature` — nama channel stabil per scope (bukan `Date.now()`), agar tak membuat channel baru tiap render dan tak bentrok antar-instance hook yang sama
- `useRealtimeChannel` — hook subscribe raw callback ke satu atau banyak tabel dalam satu channel
- `useRealtimeInvalidate` — varian khusus React Query: event postgres_changes → debounce → `queryClient.invalidateQueries`

Ini duplikasi sengaja dari pola absensi (bukan extract ke shared package) — realtime wiring erat dengan skema tabel spesifik tiap app, dan baru dipakai 2 app sehingga extract sekarang premature.

### Migration

`supabase/migrations/20260713100000_stok_realtime_publication.sql` — tambahkan ke publication `supabase_realtime`:
- `ledger_stok`
- `opname`
- `opname_item`
- `stok_waste_reports`

(`stok_balance` dan `permintaan_bahan` sudah ada di publication dari migration sebelumnya — tidak disentuh.)

Idempotent (guard `pg_publication_tables` seperti pola `20260626110000`).

## Perubahan per File

| File | Perubahan |
|---|---|
| `apps/stok/src/lib/realtime/*` (baru) | Port `createDebouncer`, `subsSignature`, `useRealtimeChannel`, `useRealtimeInvalidate` + unit test |
| `supabase/migrations/20260713100000_stok_realtime_publication.sql` (baru) | `ADD TABLE` untuk 4 tabel di atas |
| `src/hooks/useMonitoringData.ts` | Ganti `refetchInterval` → realtime invalidate (debounce 2-3s) untuk `useSPVMonitoringData`, `useLeaderMonitoringData`, `useCrewMonitoringData`, `useRecentLedger`, `useStockoutForecast`, `useWasteToday`. Tambah fallback poll 2 menit khusus query yang dipakai Monitoring-Live. Hapus pemanggilan `useAutoRefresh` yang mati |
| `src/hooks/useLedger.ts` | Tambah realtime invalidate ke `useLedgerTransaksiList` (filter outlet) |
| `src/hooks/useOpname.ts` | Tambah realtime invalidate ke `useOpnameList` (filter outlet) |
| `src/hooks/usePermintaan.ts` | Tambah subscribe realtime ke `useApprovalList` (global, semua outlet accessible approver) |
| `src/hooks/useStokBalance.ts` | Ganti `setInterval` manual → realtime invalidate berbasis `stok_balance` |
| `src/app/stok/waste-approval/page.tsx` | Tambah subscribe realtime ke antrian pending (status=PENDING) |
| `src/app/stok/waste-history/page.tsx` (baru) | Halaman "Riwayat Waste Saya" — list laporan waste milik crew sendiri (filter `reported_by = outletStaff.id`), status badge, alasan penolakan; realtime subscribe + toast saat status berubah dari PENDING |
| `src/components/monitoring/CrewDashboard.tsx` | Tambah quick action link ke `/stok/waste-history` (pola sama seperti link "Permintaan Bahan") |
| `src/hooks/useAutoRefresh.ts` | Dihapus (superseded oleh realtime; sebelumnya sudah `enabled: false` / dead code) |

## Debounce Strategy

Semua channel realtime pakai debounce 2-3 detik sebelum invalidate query — event ledger/stok bisa datang sangat cepat saat outlet ramai (tiap order kasir → `ledger_stok`); tanpa debounce bisa refetch berkali-kali per detik.

## Fallback Poll (khusus Monitoring-Live)

Monitoring-Live adalah papan TV yang ditonton tanpa interaksi (tak ada refocus/remount alami). Realtime channel bisa terputus tanpa terlihat. Untuk board ini saja, pertahankan fallback poll longgar (2 menit) sebagai jaring pengaman. Surface lain (ledger, opname, permintaan, waste) tidak perlu fallback poll — user aktif berpindah halaman/refocus secara alami memicu refetch React Query normal via `staleTime`.

## Halaman Baru: Riwayat Waste Saya

- **Route:** `/stok/waste-history`
- **Akses:** crew (dan role lain yang submit waste), scoped ke `reported_by = outletStaff.id` (RLS `waste_reports_read` sudah mengizinkan via `accessible_outlet_ids()`, filter tambahan di query untuk "milik saya saja")
- **Entry point:** quick action baru di `CrewDashboard.tsx`
- **Data:** `stok_waste_reports` urut `created_at` desc, tampilkan status (Pending/Approved/Rejected), alasan penolakan bila ada
- **Realtime:** subscribe ke perubahan baris milik sendiri → invalidate list; efek tambahan bandingkan status sebelum/sesudah untuk memicu toast "Waste report Anda disetujui/ditolak"

## Testing & Verifikasi

- Unit test: `createDebouncer`, `subsSignature` (murni, di-port sekaligus test-nya dari absensi, disesuaikan nama tabel)
- Manual smoke test 2-tab browser:
  1. Order kasir di outlet A → Monitoring-Live update tanpa refresh
  2. Crew ajukan permintaan bahan → approver (leader/SPV) lihat masuk instan di antrian
  3. Approver setujui waste report → crew pelapor lihat toast + status berubah instan di Riwayat Waste Saya
  4. Dua device input opname outlet sama → sinkron tanpa refresh
- `yarn type-check` bersih, build sukses

## Out of Scope

- Extract lib realtime ke shared package (`packages/realtime`) — ditunda sampai dipakai ≥3 app
- Push notification (browser notification API) untuk approval — toast in-app cukup untuk sekarang
- Redesign UI Waste Approval / Monitoring-Live — hanya wiring data, bukan perubahan visual
