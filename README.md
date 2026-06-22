# DIGITALISASI SS — Sukashawarma Outlet Suite

Suite digital **operasional outlet** Sukashawarma (19 outlet Jabodetabek). Sistem terintegrasi dengan **SSO login terpadu** di portal, dengan kontrol akses berbasis role (admin, owner, spv, leader, kasir, crew, kiosk).

## 📋 Quick Links

- **Setup & Deployment:** [`DEPLOY-CPANEL.md`](DEPLOY-CPANEL.md) (13-step cPanel deployment guide)
- **Architecture:** [`CLAUDE.md`](CLAUDE.md) (system design, roles, deployment notes)
- **Role Matrix:** [`docs/ROLE-JOBDESK.md`](docs/ROLE-JOBDESK.md) (7 roles, access matrix, responsibilities)
- **SSO Design:** [`docs/superpowers/specs/2026-06-13-login-sso-per-role-design.md`](docs/superpowers/specs/2026-06-13-login-sso-per-role-design.md)
- **Legacy Docs:** [`docs/PRD.md`](docs/PRD.md), [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/FLOWS.md`](docs/FLOWS.md), [`docs/adr/`](docs/adr/)

## 🏗️ Applications (6 Subdomains)

| App | Purpose | Users | URL |
|-----|---------|-------|-----|
| **Portal** | SSO login + app launcher | All roles | `app.sukashawarma.com` |
| **Absensi** | Employee attendance + checklists | All roles | `absensi.sukashawarma.com` |
| **Stok** | Stock monitoring & ledger | SPV, Kepala, Admin | `stok.sukashawarma.com` |
| **Distribusi** | Shipment management & signatures | SPV, Kepala, Admin | `distribusi.sukashawarma.com` |
| **Owner Dashboard** | Revenue & analytics reporting | Owner, Admin | `owner.sukashawarma.com` |
| **POS Kasir** | Point-of-sale & kiosk | Kasir, Kiosk, Admin | `kasir.sukashawarma.com` |

## 🛠️ Tech Stack

- **Database/Backend:** Supabase (Postgres + Auth + RLS + Edge Functions + pg_cron)
- **Frontend:** Next.js 15 + TypeScript + TailwindCSS
- **Shared Auth:** `@suka/auth` package (unified SSO, role matrix, JWT validation)
- **Session:** Shared cookie domain (`.sukashawarma.com`) for seamless cross-app SSO
- **Deployment:** cPanel + CloudLinux + LiteSpeed (Node.js 24.15.0)

## 📁 Project Structure

```
├── CLAUDE.md                  # System design & architecture decisions
├── DEPLOY-CPANEL.md           # Deployment guide (13 steps, troubleshooting)
├── CONTEXT.md                 # Glossary & domain terminology
├── docs/
│   ├── ROLE-JOBDESK.md        # 7 roles, access matrix, responsibilities
│   ├── adr/                   # Architecture Decision Records
│   └── superpowers/           # Specs & implementation plans
├── packages/
│   ├── auth/                  # @suka/auth (shared, 13 exports)
│   ├── design-system/         # SUKA design tokens
│   └── offline-queue/         # Offline queueing pattern
├── apps/
│   ├── portal/                # SSO entry point
│   ├── absensi/               # Attendance system
│   ├── stok/                  # Stock management
│   ├── distribusi/            # Shipment management
│   ├── owner-dashboard/       # Analytics & reporting
│   └── pos-kasir/             # Point-of-sale
└── supabase/migrations/       # Database schema (8 SSO migrations)
```

## ⚠️ Keamanan
- **JANGAN commit key Supabase** (`service_role`/`anon`). Pakai `config.example.js` / `.env.example`; file asli di-`.gitignore`.
- Migrasi: additive, sertakan DOWN, uji di staging dulu. Project Ecosystem (produksi) **read-only**.

## Alur kerja
- Branch per modul: `feat/m0-foundation`, `feat/m1-absensi`, dst → PR ke `main`.
- Perubahan tabel inti (`outlet_staff`, `outlets`, ledger) wajib review dev lain.
