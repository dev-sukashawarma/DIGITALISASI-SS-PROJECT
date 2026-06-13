# SHAWARMA Self-Ordering Kiosk — Panduan Lengkap

## Struktur Folder

```
shawarma-kiosk/
├── app/
│   ├── layout.tsx              ← Root layout + metadata
│   ├── globals.css             ← Tailwind + komponen CSS kustom
│   ├── page.tsx                ← Halaman menu utama (customer)
│   ├── checkout/
│   │   └── page.tsx            ← Halaman konfirmasi & checkout
│   ├── order-success/
│   │   └── page.tsx            ← Halaman sukses setelah pesan
│   ├── admin/
│   │   ├── layout.tsx          ← Layout admin (dengan navbar)
│   │   ├── login/
│   │   │   └── page.tsx        ← Halaman login admin
│   │   ├── page.tsx            ← Dashboard pesanan admin
│   │   └── menu/
│   │       └── page.tsx        ← Manajemen menu admin
│   └── api/
│       └── checkout/
│           └── route.ts        ← API checkout (validasi harga server-side)
├── components/
│   ├── MenuItem.tsx            ← Kartu menu individual
│   ├── Cart.tsx                ← Komponen keranjang belanja
│   ├── CategoryFilter.tsx      ← Filter kategori
│   └── AdminNav.tsx            ← Navigasi admin
├── lib/
│   ├── supabase/
│   │   ├── client.ts           ← Supabase browser client
│   │   └── server.ts           ← Supabase server + service role client
│   └── validations.ts          ← Validasi input & format Rupiah
├── store/
│   └── cart.ts                 ← State cart (Zustand + localStorage)
├── types/
│   └── index.ts                ← TypeScript types
├── middleware.ts               ← Proteksi route /admin
├── supabase-schema.sql         ← SQL schema + data dummy
├── .env.local.example          ← Contoh environment variables
└── package.json
```

---

## Langkah 1: Setup Supabase

1. Buka [supabase.com](https://supabase.com) → Create new project
2. Tunggu project selesai dibuat (~2 menit)
3. Buka **SQL Editor** di sidebar kiri
4. Copy isi file `supabase-schema.sql` → Paste → klik **Run**
5. Verifikasi di **Table Editor** — pastikan ada tabel: `categories`, `menu_items`, `orders`, `order_items`

### Ambil API Keys

1. Buka **Settings** → **API** di Supabase dashboard
2. Catat:
   - **Project URL** (contoh: `https://abcdefgh.supabase.co`)
   - **anon/public key** (panjang, mulai dengan `eyJ...`)
   - **service_role key** (RAHASIA, jangan pernah expose ke frontend)

### Buat Admin User

1. Buka **Authentication** → **Users** → **Add user**
2. Isi email dan password admin
3. Klik **Create user**

---

## Langkah 2: Setup Project Lokal

```bash
# Masuk ke folder project
cd shawarma-kiosk

# Install dependencies
npm install

# Buat file .env.local dari contoh
copy .env.local.example .env.local
```

Edit file `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://XXXXX.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Langkah 3: Jalankan Development

```bash
npm run dev
```

Buka browser:
- **Kiosk Customer:** http://localhost:3000
- **Admin Login:** http://localhost:3000/admin/login
- **Admin Dashboard:** http://localhost:3000/admin (setelah login)

---

## Langkah 4: Deploy ke Vercel (Gratis)

### Cara 1: Via GitHub (Rekomendasi)

1. Push code ke GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: SHAWARMA Kiosk"
   git remote add origin https://github.com/USERNAME/shawarma-kiosk.git
   git push -u origin main
   ```

2. Buka [vercel.com](https://vercel.com) → **New Project**
3. Import repository dari GitHub
4. Tambahkan environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Klik **Deploy**

### Cara 2: Via Vercel CLI

```bash
npm install -g vercel
vercel login
vercel
```

---

## Alur Penggunaan

### Customer (Tidak Perlu Login)
1. Buka URL kiosk
2. Browse menu, pilih item dengan tombol **+**
3. Atur jumlah di kartu menu atau di cart
4. Klik **Pesan Sekarang** di cart
5. Isi nama (opsional) & catatan khusus
6. Klik **Pesan Sekarang** → pesanan dibuat
7. Lihat nomor antrian di halaman sukses

### Admin
1. Buka `/admin/login`, login dengan email & password
2. **Dashboard Pesanan:**
   - Lihat semua pesanan real-time (auto-refresh 15 detik)
   - Klik pesanan untuk expand detail
   - Update status: Menunggu → Diproses → Siap → Selesai
   - Batalkan pesanan jika diperlukan
3. **Manajemen Menu:**
   - Tambah/edit/hapus menu
   - Toggle ketersediaan item (Tersedia/Habis) dengan satu klik

---

## Keamanan

| Fitur | Implementasi |
|-------|-------------|
| Admin protected | Middleware Next.js + Supabase Auth |
| Customer tanpa login | RLS public SELECT untuk menu |
| Validasi harga | Server-side di `/api/checkout` menggunakan service_role |
| Validasi quantity | Cek `1 ≤ qty ≤ 10` di API route |
| Inject prevention | Parameterized queries via Supabase SDK |
| RLS | Enabled di semua tabel |
| Service role key | Hanya di server, tidak expose ke client |

---

## Dependensi

| Package | Versi | Fungsi |
|---------|-------|--------|
| next | 14.x | Framework React |
| @supabase/supabase-js | 2.x | Supabase client |
| @supabase/ssr | 0.x | Supabase untuk Next.js SSR/middleware |
| zustand | 4.x | State management cart |
| tailwindcss | 3.x | Styling |

Total: **5 runtime dependencies** — sangat ringan!
