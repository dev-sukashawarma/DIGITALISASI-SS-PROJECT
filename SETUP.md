# Setup Local Development — Outlet Suite

## 1. Environment Variables

Copy `.env.local.example` → `.env.local` (gitignored):

```bash
cp .env.local.example .env.local
```

Isi values di `.env.local`:

### Outlet Suite Supabase (akun BARU)
1. Buka Supabase dashboard → project Outlet Suite
2. Settings → API → copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Anon Public Key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Service Role Key** → `SUPABASE_SERVICE_ROLE_KEY`

### Ecosystem Supabase (read-only)
Dapatkan dari owner — service key untuk read akses ke Ecosystem project:
- **Project URL** → `ECOSYSTEM_SUPABASE_URL`
- **Service Role Key (read-only)** → `ECOSYSTEM_SERVICE_ROLE_KEY`

**⚠️ JANGAN paste keys di chat / commit ke git!** File `.env.local` sudah di `.gitignore`.

## 2. Install Dependencies

```bash
yarn install
# or: npm install
```

## 3. Supabase Migrations

Jalankan migration ke project Outlet Suite (setelah M0 tasks selesai):

```bash
npx supabase db push
```

## 4. Verify Connection

Testing Supabase connection (dalam Next.js app):

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const { data, error } = await supabase.from('outlets').select().limit(1)
console.log(data, error)
```

---

## Struktur Monorepo

```
├── packages/
│   ├── design-system/         # @suka/design-system — tokens + components
│   └── offline-queue/         # @suka/offline-queue — utility reusable
├── apps/
│   ├── absensi/               # M1
│   ├── stok/                  # M2
│   ├── distribusi/            # M3
│   └── owner-dashboard/       # M4
├── supabase/
│   ├── migrations/            # SQL migrations (outlets, outlet_staff, RLS, etc)
│   └── seed.sql              # Initial data (outlets seed dari Ecosystem)
└── .env.local                 # ⚠️ gitignored — setup lokal
```

## Next Steps

1. ✅ Isi `.env.local` dgn Supabase keys
2. ⏳ M0 implementation plan (akan di-output setelah ini)
3. ⏳ Execute M0 tasks (setup monorepo, design-system, migrations, app shell)
