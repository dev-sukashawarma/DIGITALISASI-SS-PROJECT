# PRD — Digitalisasi Sukashawarma (Suite Operasional Outlet)

> Status: Disetujui (2026-06-09) · Program-level PRD · Tim: 2 developer (vibe coding)
> Visual: [`ARCHITECTURE.md`](ARCHITECTURE.md) (struktur & ERD) · [`FLOWS.md`](FLOWS.md) (alur proses)

## Context

Sukashawarma adalah usaha F&B (fokus shawarma) dengan **19 outlet se-Jabodetabek**. Goal: digitalisasi hulu-ke-hilir. Hasil eksplorasi codebase menunjukkan ekosistem **sudah jauh lebih matang** dari brief awal — beberapa subsistem sudah production, beberapa greenfield.

**Re-scoping kunci:** suite ini = **sistem baru khusus operasional OUTLET** (staff outlet), **terpisah** dari SS-WEBAPP (itu untuk **karyawan pusat/HQ**, di luar scope). POS/Kasir baru akan **di-upload terpisah nanti** → suite ini tidak kopling ke `pos_cashiers` lama; cukup mendefinisikan identitas `outlet_staff` kanonik yang nanti di-link POS baru.

---

## Peta Kondisi Saat Ini (8 subsistem brief)

| # | Subsistem | Status | Lokasi / Stack |
|---|-----------|--------|----------------|
| 1 | Absensi staff outlet + face recognition | 🔴 **Greenfield (target suite ini)** | Existing absensi di SS-WEBAPP = HQ, bukan outlet. Face matching belum ada |
| 2 | Pesanan online | 🟢 Production (di luar scope build baru) | TiktokGo SS (~85%) + Self-Ordering kiosk (~65%), Supabase+Xendit+Fonnte |
| 3 | POS / Kasir | 🟡 Akan di-upload owner nanti | POS SS lama live; versi baru menyusul |
| 4 | Inventarisasi | 🔴 Greenfield | — |
| 5 | Manajemen stok bahan baku | 🔴 Greenfield | — |
| 6 | Monitoring bahan baku | 🔴 Greenfield | — |
| 7 | Dashboard owner (P&L/analitik) | 🟡 Partial | Ada dashboard operasional (Checklist PHP) & HR (SS-WEBAPP); **BI bisnis belum ada** |
| 8 | Pengiriman & verifikasi pusat→outlet | 🔴 Greenfield | — |

**Aset reuse:** Design System SUKA (`LINKTREE SS/SUKA Shawarma Design System`) — warna `--suka-orange #f29744`, `--suka-brown #701604`, font Lilita One + Plus Jakarta Sans. n8n sudah dipakai di ekosistem.

**Scope build baru:** #1, #4, #5, #6, #7, #8. (#2 sudah jalan; #3 ditunggu dari owner.)

---

## Keputusan Arsitektur (terkunci)

1. **Stack modul baru:** Supabase (Postgres + Auth + Storage + RLS + Edge Functions + pg_cron) + **Next.js/TypeScript (static export `output: 'export'`)** + Tailwind, deploy ke **server cPanel CloudLinux shared (penyedia lokal)** sebagai file statis, subdomain per modul. Logika server di Edge Functions/RLS/n8n (bukan SSR). Reuse Design System SUKA sebagai package bersama. → ADR-005
2. **Identitas terpadu `outlet_staff`** (role: `crew`, `kasir`, `spv`, `kepala_outlet`). Tidak kopling `pos_cashiers` lama. → ADR-001
3. **Face matching ringan:** face-api.js 1:1 di browser device outlet. Enroll oleh SPV. Anti-curang MVP = GPS radius + selfie audit + timestamp server. Liveness ditunda. → ADR-003
4. **Stok bahan baku = SATU domain, 3 muka:** Inventarisasi (opname) · Manajemen (ledger) · Monitoring (alert). Mulai manual/opname, BOM auto-deduction fase lanjut.
5. **Supply chain:** **1 Gudang Pusat** → Surat Jalan → outlet verifikasi terima → **stok masuk = qty terverifikasi**.
6. **Owner Dashboard = reporting hub Supabase** (materialized views + pg_cron, near-real-time berlapis). Compliance disinkron via n8n. HR pusat tidak diintegrasi. → ADR-002
7. **DB terpisah:** modul baru di **Supabase project BARU di akun/org Supabase berbeda** dari produksi (isolasi penuh, bukan extend); `outlets` disinkron 1-arah (uuid sama), `outlet_staff` enroll fresh. → ADR-004, lihat [`docs/DB-MIGRATION-PLAN.md`](DB-MIGRATION-PLAN.md)
8. **Pembagian kerja:** 2-track paralel by domain.

Detail keputusan: lihat [`docs/adr/`](adr/), plan migrasi DB di [`docs/DB-MIGRATION-PLAN.md`](DB-MIGRATION-PLAN.md), glossary di [`CONTEXT.md`](../CONTEXT.md).

---

## Spesifikasi Modul

### M0 — Foundation (shared, Dev B duluan, dipakai berdua)
- Skema inti Supabase: `outlets` (selaras 19 outlet existing), `outlet_staff` (identitas kanonik, role, status, face descriptor), auth & RLS per-outlet.
- Package **design-system** (token SUKA) sebagai dependency bersama.
- App shell Next.js + Supabase client + pola offline-queue reusable.
- **Output:** unblock M1 & M2.

### M1 — Absensi Outlet + Face Matching *(prioritas #1, Dev A)*
- **Device:** HP/tablet Android per outlet (kamera depan + GPS, browser modern) — terkonfirmasi.
- Enroll wajah oleh SPV/Kepala Outlet (1–3 foto → descriptor), **dengan consent staff** (data biometrik, UU PDP).
- Clock-in/out: kamera live → face-api.js match 1:1 (threshold euclidean ~<0.5) + GPS radius outlet (default 75–100m) + timestamp server + selfie audit.
- Offline tolerance: descriptor cache lokal, absen masuk queue, sinkron saat online.
- **Privasi:** consent flow saat enroll + kebijakan retensi selfie audit (mis. 90 hari). Descriptor & selfie di Supabase Storage dgn RLS.
- Catatan: shift, jam masuk/keluar, status (tepat/telat/alpha), per `outlet_staff`.
- SPV view: rekap kehadiran, spot-check selfie.
- *Ditunda:* liveness aktif, payroll outlet.

### M2 — Domain Stok Bahan Baku (Dev B) — brief #4,#5,#6
- **Master bahan baku**: nama, satuan, kategori, reorder point per outlet.
- **Inventarisasi (opname)**: input stok fisik harian/mingguan → stok aktual + selisih.
- **Ledger pergerakan**: masuk (dari verifikasi shipment M3), keluar (pemakaian/waste), adjustment. Ber-aktor `outlet_staff`.
- **Monitoring/alert**: level stok semua outlet realtime; alert < reorder point; flag waste tinggi.
- Mulai manual/opname; siapkan hook untuk BOM auto-deduction fase lanjut.

### M3 — Supply Chain Pusat→Outlet (Dev A) — brief #8
- **Gudang Pusat**: admin buat **Surat Jalan** (outlet tujuan + item + qty dikirim).
- **Verifikasi terima** di outlet: cocokkan qty diterima vs dikirim, catat selisih, foto bukti opsional.
- Status: `dikirim → diterima_sebagian/lengkap → selisih_dicatat`.
- **Integrasi:** qty terverifikasi → otomatis "stok masuk" di ledger M2.

### M4 — Owner Dashboard / BI (Dev B) — brief #7
- Reporting hub Supabase: materialized views + pg_cron.
- KPI: revenue per outlet/hari, top item, jam ramai, **COGS & waste** (ledger stok), status distribusi, ringkasan kehadiran.
- Layered refresh: "hari ini" ~2 menit; historis jam/harian.
- Compliance (Checklist MySQL) disinkron via n8n → widget sekunder.

---

## Pembagian Tugas — 2-Track Paralel by Domain

| Fase | **Dev A — "Orang & Distribusi"** | **Dev B — "Bahan Baku & Insight"** |
|------|----------------------------------|------------------------------------|
| 1 | 🥇 **M1** Absensi Outlet + Face Matching | 🏗️ **M0** Foundation (outlet_staff, outlets, auth/RLS, design package, offline pattern) |
| 2 | **M3** Supply chain (Surat Jalan + verifikasi terima) | **M2** Domain Stok Bahan Baku (opname + ledger + monitoring/alert) |
| 3 | Integrasi M3→M2 (verifikasi terima → stok masuk) bareng Dev B | **M4** Owner Dashboard (reporting hub) |

**Aturan kolaborasi:** Dev B selesaikan M0 lebih dulu (unblock keduanya). Titik integrasi sedikit & eksplisit (shipment→stok ledger; semua aksi ber-aktor `outlet_staff`). Perubahan tabel inti (`outlet_staff`, `outlets`, ledger) butuh review dev lain.

---

## Struktur Repo (usulan)
```
sukashawarma-outlet-suite/
├── CONTEXT.md                 # glossary (ADR-driven)
├── docs/adr/                  # ADR-001..003
├── packages/design-system/    # token SUKA reusable
├── apps/absensi/              # M1 (Dev A)
├── apps/stok/                 # M2 (Dev B)
├── apps/distribusi/           # M3 (Dev A)
├── apps/owner-dashboard/      # M4 (Dev B)
└── supabase/migrations/       # skema bersama
```

---

## Rencana Eksekusi
1. ✅ Buat `CONTEXT.md` + `docs/adr/` (ADR-001..003) + `docs/PRD.md`.
2. Scaffold monorepo + Supabase project + package design-system (M0).
3. Tiap modul (M1–M4) brainstorm→spec→plan masing-masing sebelum implementasi.
4. Mulai Fase 1: Dev B → M0, Dev A → M1.

## Verifikasi
- **M0:** migrasi jalan, `outlet_staff` & RLS per-outlet teruji (outlet X tak bisa baca outlet Y), design package ter-import.
- **M1:** enroll staff → wajah benar match, wajah lain ditolak, di luar GPS ditolak, offline tersimpan & sinkron. Selfie audit di SPV view.
- **M2:** opname → stok aktual+selisih tercatat; ledger ubah saldo; alert saat < reorder point.
- **M3:** Surat Jalan 50kg → outlet verifikasi 48kg → discrepancy 2kg tercatat & stok masuk M2 = 48kg.
- **M4:** dashboard buka <1 dtk; angka konsisten dgn sumber; refresh terjadwal jalan.
