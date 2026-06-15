# Setup Local Development — Outlet Suite

## 1. Environment Variables

Create `.env.local` with Supabase credentials (not in git):

```bash
# For each app, create apps/[app-name]/.env.local with:
NEXT_PUBLIC_SUPABASE_URL=https://[your-project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_PORTAL_URL=https://app.sukashawarma.com
NEXT_PUBLIC_COOKIE_DOMAIN=           # Empty for local dev (per-port cookies)
```

**⚠️ JANGAN commit `.env.local`** — already in `.gitignore`.

## 2. Install Dependencies

```bash
yarn install
# or: npm install
```

## 3. Database Migrations

Initialize Supabase local (optional):

```bash
# View migration status
npx supabase migration list

# Push migrations to remote (requires SUPABASE_ACCESS_TOKEN)
npx supabase db push
```

## 4. Run Local Dev Server

```bash
# Start all apps in dev mode
yarn dev

# Or start specific app
cd apps/stok && yarn dev
# Runs on: http://localhost:3001 (stok)
```

**Apps & ports:**
- Portal: http://localhost:3000
- Stok: http://localhost:3001
- Absensi: http://localhost:3002
- Distribusi: http://localhost:3003
- Owner-Dashboard: http://localhost:3004
- POS-Kasir: http://localhost:3005

## 5. Test SSO Login Locally

1. Navigate to http://localhost:3000 (portal)
2. Login with Supabase test account
3. Launcher shows role-filtered apps
4. Click app → navigates to that app's localhost
5. No re-login needed (shared session via cookies)

---

## Project Structure

```
├── packages/
│   ├── auth/                  # @suka/auth (shared SSO, 13 exports)
│   ├── design-system/         # @suka/design-system (tokens + components)
│   └── offline-queue/         # @suka/offline-queue (utility)
├── apps/
│   ├── portal/                # SSO login + app launcher
│   ├── absensi/               # Attendance system
│   ├── stok/                  # Stock management
│   ├── distribusi/            # Shipment management
│   ├── owner-dashboard/       # Analytics & reporting
│   └── pos-kasir/             # Point-of-sale
├── supabase/
│   ├── migrations/            # Database schema (8 SSO migrations)
│   └── functions/             # Edge functions
└── docs/
    ├── ROLE-JOBDESK.md        # Role definitions & access matrix
    └── superpowers/           # Specs & implementation plans
```

## Deployment

See [`DEPLOY-CPANEL.md`](DEPLOY-CPANEL.md) for production deployment to cPanel (13 steps).

## Troubleshooting

**Cookie domain issue locally?**
- Leave `NEXT_PUBLIC_COOKIE_DOMAIN` empty for local dev
- Each localhost:port gets its own cookies (per-port)
- Set to `.sukashawarma.com` only in production (DEPLOY-CPANEL.md)

**Type errors in build?**
```bash
yarn type-check
```

**Need to see live data?**
- Supabase project must have migrations applied: `npx supabase db push`
- Test data must be seeded in Supabase console
