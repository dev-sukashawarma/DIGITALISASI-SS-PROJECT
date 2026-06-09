# ADR-004 — Outlet Suite pakai Supabase project terpisah dari Ecosystem produksi

- Status: Accepted
- Tanggal: 2026-06-09
- Terkait: meng-amandemen ADR-002

## Konteks
Ekosistem existing (TiktokGo, POS SS, kiosk) berbagi satu Supabase project produksi yang sudah live (berisi `outlets`, `orders`, `admin_users`, `pos_cashiers`, dll). Modul baru suite outlet butuh banyak tabel & migrasi.

## Keputusan
Bangun modul baru di **Supabase project BARU di akun/org Supabase BERBEDA** ("Outlet Suite"), bukan extend project produksi. `outlets` (19) disinkron 1-arah dari Ecosystem ke Outlet Suite (via REST/service key, lintas-akun) dengan **mempertahankan uuid yang sama**. `outlet_staff` diisi **fresh** (enroll oleh SPV), tidak dimigrasi dari `pos_cashiers`/`admin_users`.

## Alternatif yang ditolak
- **Extend project produksi (1 Supabase)** — ditolak oleh owner demi isolasi: migrasi suite baru tidak boleh berisiko ke 3 app produksi yang live.

## Konsekuensi
- (+) Isolasi penuh; migrasi suite tidak bisa merusak produksi.
- (+) `outlet_staff` bersih dari awal.
- (−) **Amandemen ADR-002:** dashboard owner jadi lintas-project. Mitigasi: sinkron `outlets` + agregat sales dari Ecosystem → reporting schema Outlet Suite (via n8n), dashboard tetap baca 1 project. Lihat `docs/DB-MIGRATION-PLAN.md`.
- (−) Tambah 1 pipeline sinkron (outlets + sales rollup) yang harus dijaga.
