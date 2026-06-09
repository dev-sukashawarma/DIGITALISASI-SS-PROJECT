# DIGITALISASI SS — Sukashawarma Outlet Suite

Suite digital **operasional outlet** Sukashawarma (19 outlet Jabodetabek). Sistem baru, terpisah dari HR pusat (SS-WEBAPP) dan dari app produksi existing (TiktokGo, POS).

> **Mulai dari sini:** [`docs/PRD.md`](docs/PRD.md) → [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (diagram struktur) → [`docs/FLOWS.md`](docs/FLOWS.md) (alur proses) → [`CONTEXT.md`](CONTEXT.md) (glossary) → [`docs/adr/`](docs/adr/) (keputusan) → [`docs/PREFLIGHT.md`](docs/PREFLIGHT.md) (gerbang sebelum eksekusi).

## Modul

| Modul | Isi | Track |
|-------|-----|-------|
| **M0** Foundation | `outlets`, `outlet_staff`, auth/RLS, design-system, offline pattern | Dev B |
| **M1** Absensi + Face Matching | clock-in wajah (face-api.js) + GPS + selfie | Dev A |
| **M2** Stok Bahan Baku | opname + ledger + monitoring/alert | Dev B |
| **M3** Supply Chain | Surat Jalan pusat→outlet + verifikasi terima | Dev A |
| **M4** Owner Dashboard | reporting hub (revenue, COGS, waste, kehadiran) | Dev B |

## Stack
- **DB/Backend:** Supabase Cloud (akun terpisah dari produksi) — Postgres + Auth + Storage + RLS + Edge Functions + pg_cron
- **Frontend:** Next.js + TypeScript (**static export**) + Tailwind, deploy ke **cPanel shared** (static), subdomain per modul
- **Otomasi/sinkron:** n8n
- **Design:** Design System SUKA (reuse)

## Struktur
```
├── CONTEXT.md                 # glossary domain
├── docs/                      # PRD, ADR, plan migrasi, preflight
├── packages/design-system/    # token SUKA reusable
├── apps/
│   ├── absensi/               # M1 (Dev A)
│   ├── stok/                  # M2 (Dev B)
│   ├── distribusi/            # M3 (Dev A)
│   └── owner-dashboard/       # M4 (Dev B)
└── supabase/migrations/       # skema bersama
```

## ⚠️ Keamanan
- **JANGAN commit key Supabase** (`service_role`/`anon`). Pakai `config.example.js` / `.env.example`; file asli di-`.gitignore`.
- Migrasi: additive, sertakan DOWN, uji di staging dulu. Project Ecosystem (produksi) **read-only**.

## Alur kerja
- Branch per modul: `feat/m0-foundation`, `feat/m1-absensi`, dst → PR ke `main`.
- Perubahan tabel inti (`outlet_staff`, `outlets`, ledger) wajib review dev lain.
