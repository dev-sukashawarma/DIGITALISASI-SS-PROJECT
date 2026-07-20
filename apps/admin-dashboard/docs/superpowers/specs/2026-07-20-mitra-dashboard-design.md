# Dashboard Mitra — Design Spec
_Date: 2026-07-20_

## Latar Belakang

Role `MITRA` sudah ada di sistem (`navConfig.ts`, `RoleContext.tsx`), namun belum memiliki halaman khusus. Saat ini MITRA diredirect ke `/dashboard/owner` dalam mode read-only, tanpa informasi yang relevan bagi mereka sebagai investor/franchisee.

Fitur ini membangun portal khusus mitra yang menampilkan informasi outlet, orderan, tim, investasi, bukti transfer bulanan, dan form saran — semuanya dalam satu dashboard berbasis kartu dengan drawer detail.

---

## Pendekatan: Dashboard Cards + Drawer Detail (Opsi B)

Halaman utama menampilkan kartu per-outlet yang dimiliki mitra. Klik kartu → drawer slide-in dengan 5 tab konten detail. Admin memiliki halaman terpisah untuk mengelola data mitra.

---

## Scope

### 1. Halaman Baru

| Halaman | Route | Akses |
|---|---|---|
| Dashboard Mitra | `/dashboard/mitra` | MITRA only |
| Admin Kelola Mitra | `/dashboard/owner/kelola-mitra` | ADMIN only |

### 2. Perubahan Existing

- **`RoleContext.tsx`**: MITRA dialihkan ke `/dashboard/mitra` (bukan `/dashboard/owner`)
- **`ClientRedirect.tsx`**: Update redirect map untuk MITRA
- **`navConfig.ts`**: Tambah group nav "Portal Mitra" untuk role MITRA, update route-guard allowed list
- **`/dashboard/dashboard/page.tsx`**: Update redirect map MITRA

---

## Database Schema

### Tabel Baru di Supabase

```sql
-- 1. Profil mitra — satu mitra bisa banyak outlet
CREATE TABLE mitra_profiles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nama_mitra  text NOT NULL,
  outlet_ids  uuid[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. Data investasi per outlet
CREATE TABLE mitra_investments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id        uuid NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  nilai_investasi  numeric(15,2) NOT NULL DEFAULT 0,
  tanggal_mulai    date NOT NULL,
  catatan          text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- 3. Bukti transfer bulanan (admin upload)
CREATE TABLE mitra_transfers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id  uuid NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  bulan      date NOT NULL,          -- tanggal 10 bulan berjalan
  nominal    numeric(15,2) NOT NULL,
  bukti_url  text NOT NULL,          -- Supabase Storage URL
  catatan    text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Saran dari mitra
CREATE TABLE mitra_suggestions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id),
  outlet_id     uuid REFERENCES outlets(id),
  isi_saran     text NOT NULL,
  status        text NOT NULL DEFAULT 'baru',  -- 'baru' | 'dibaca' | 'ditanggapi'
  tanggapan     text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
```

### Row Level Security (RLS)

- `mitra_profiles`: Mitra hanya bisa SELECT row miliknya (`user_id = auth.uid()`)
- `mitra_investments`: Mitra hanya bisa SELECT outlet yang ada di `mitra_profiles.outlet_ids`
- `mitra_transfers`: Same scope sebagai investments
- `mitra_suggestions`: Mitra bisa SELECT + INSERT miliknya; ADMIN bisa SELECT + UPDATE semua

### ROI Calculation

ROI dihitung di frontend dari data yang sudah ada:

```
Total Omzet Outlet (dari orders) ÷ Nilai Investasi × 100 = ROI %
```

Tidak disimpan ke DB karena bersifat kalkulasi dinamis.

---

## Komponen UI

### `/dashboard/mitra` — Halaman Utama

**Layout:**
```
┌─────────────────────────────────────────────────┐
│  👋 Selamat datang, [nama_mitra]                 │
│  Anda memiliki N outlet aktif                   │
└─────────────────────────────────────────────────┘

┌─────────────────────┐  ┌─────────────────────┐
│ 🏪 MITRA CEMPAKA    │  │ 🏪 MITRA BINTARO     │
│ Jl. Cempaka No. 5   │  │ Jl. Bintaro No. 3    │
│─────────────────────│  │─────────────────────│
│ 💰 ROI    : 14.2%   │  │ 💰 ROI    : 11.8%   │
│ 📦 Invest : Rp150jt │  │ 📦 Invest : Rp120jt │
│ 🟢 Aktif            │  │ 🟢 Aktif            │
│ [Lihat Detail →]    │  │ [Lihat Detail →]    │
└─────────────────────┘  └─────────────────────┘
```

**File baru:**
- `src/app/dashboard/mitra/page.tsx` — Server component, fetch mitra_profile + outlet data
- `src/app/dashboard/mitra/MitraDashboardView.tsx` — Client component, render kartu + drawer
- `src/app/dashboard/mitra/MitraOutletCard.tsx` — Kartu per outlet
- `src/app/dashboard/mitra/MitraOutletDrawer.tsx` — Drawer dengan tabs

### Drawer Detail (5 Tab)

| Tab | Komponen | Data Source |
|---|---|---|
| 📍 Info Outlet | `TabInfoOutlet.tsx` | `outlets` table |
| 🧾 Orderan | `TabOrderan.tsx` | `orders` table (filter by outlet_id) |
| 👥 Tim Saya | `TabTim.tsx` | `outlet_staff` table (filter by outlet_id) |
| 💰 Investasi & ROI | `TabInvestasi.tsx` | `mitra_investments` + kalkulasi ROI |
| 📤 Bukti Transfer | `TabTransfer.tsx` | `mitra_transfers` table |
| 💬 Saran | `TabSaran.tsx` | `mitra_suggestions` (INSERT form) |

---

### `/dashboard/owner/kelola-mitra` — Halaman Admin

**Fitur:**
1. **Daftar Mitra** — tabel semua mitra (nama, jumlah outlet, tanggal bergabung)
2. **Form Tambah/Edit Mitra** — nama mitra, pilih outlet (multi-select dari outlets)
3. **Kelola Investasi** — per outlet: set nilai investasi + tanggal mulai
4. **Upload Bukti Transfer** — pilih outlet, isi nominal, upload gambar/PDF, pilih bulan
5. **Inbox Saran** — tabel saran masuk, bisa update status + isi tanggapan

**File baru:**
- `src/app/dashboard/owner/kelola-mitra/page.tsx`
- `src/app/dashboard/owner/kelola-mitra/KelolaMitraView.tsx`
- `src/app/dashboard/owner/kelola-mitra/MitraTable.tsx`
- `src/app/dashboard/owner/kelola-mitra/MitraFormDialog.tsx`
- `src/app/dashboard/owner/kelola-mitra/TransferUploadDialog.tsx`
- `src/app/dashboard/owner/kelola-mitra/SaranInbox.tsx`

---

## Perubahan navConfig.ts

```ts
// Tambah group baru untuk MITRA
{
  title: 'Portal Mitra',
  icon: Handshake,
  roles: ['MITRA'],
  items: [
    { href: '/dashboard/mitra', label: 'Dashboard Saya', icon: LayoutDashboard, roles: ['MITRA'] },
  ],
},

// Tambah item di group Bisnis untuk ADMIN
{ href: '/dashboard/owner/kelola-mitra', label: 'Kelola Mitra', icon: Handshake, roles: ['ADMIN'] },
```

---

## Perubahan RoleContext & Redirect

```ts
// ClientRedirect.tsx & page.tsx
MITRA: '/dashboard/mitra',  // was: '/dashboard/owner'

// RoleContext.tsx — allowed routes for MITRA
const allowed = ['/dashboard/mitra']
```

---

## Supabase Storage

Bucket baru: `mitra-transfers`
- Path: `{outlet_id}/{bulan}/{filename}`
- Policy: ADMIN bisa upload; MITRA bisa download file outlet miliknya

---

## Urutan Implementasi

1. SQL migration — buat 4 tabel baru + RLS policies
2. Supabase Storage — buat bucket `mitra-transfers`
3. Update redirect & route-guard MITRA
4. Halaman `/dashboard/mitra` + komponen kartu
5. Drawer detail + semua tab
6. Halaman admin `/dashboard/owner/kelola-mitra`
7. Update navConfig
8. Update navConfig test

---

## Verification Plan

- [ ] MITRA login → diarahkan ke `/dashboard/mitra` (bukan `/dashboard/owner`)
- [ ] Kartu outlet muncul sesuai outlet yang di-assign admin
- [ ] Drawer terbuka dengan 5 tab lengkap
- [ ] Tab Orderan: history order tampil dan bisa difilter
- [ ] Tab Tim: nama crew/leader muncul
- [ ] Tab Investasi: nilai & ROI terhitung benar
- [ ] Tab Transfer: gambar bukti transfer bisa dibuka
- [ ] Tab Saran: form bisa disubmit, muncul di admin
- [ ] Admin di `/dashboard/owner/kelola-mitra` bisa CRUD data mitra
- [ ] Admin bisa upload bukti transfer, muncul di tab Mitra
- [ ] Route-guard: MITRA tidak bisa akses `/dashboard/owner` atau halaman lain
- [ ] `navConfig.test.ts` masih pass
