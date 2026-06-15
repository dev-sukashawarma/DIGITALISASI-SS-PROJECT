# Portal — Suka Shawarma

Login tunggal + app launcher per role.

## Dev lokal

```bash
cp .env.example .env.local
# Isi NEXT_PUBLIC_SUPABASE_URL & ANON_KEY
# Biarkan NEXT_PUBLIC_COOKIE_DOMAIN kosong saat lokal
yarn dev   # http://localhost:3010
```

## Deploy (cPanel)

1. Buat subdomain `app.sukashawarma.com` → docroot otomatis
2. Setup Node.js App: root = subdomain folder, startup = `server.cjs`
3. Upload `.env.local` (berisi service key — jangan echo di terminal)
4. Install + build dari monorepo root:
   ```bash
   cd /home/sukashaw/suka-app && npm install
   cd apps/portal && npm run build
   ```
5. Buat `server.cjs` di docroot (lihat CLAUDE.md pola deploy cPanel)
6. Set env `NEXT_PUBLIC_COOKIE_DOMAIN=.sukashawarma.com` di panel Node app
7. SAVE → RESTART
