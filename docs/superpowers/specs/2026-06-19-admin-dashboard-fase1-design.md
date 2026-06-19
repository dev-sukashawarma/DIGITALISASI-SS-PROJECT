# Admin Dashboard — Fase 1: Fondasi & Staff Management

**Tanggal:** 2026-06-19
**Status:** Disepakati (brainstorming)
**Scope:** Fase 1 dari roadmap Admin Dashboard (3 fase). Hanya untuk role `admin`.

---

## Konteks & Latar Belakang

Suite digital Suka Shawarma punya 5 app operasional (pos-kasir, absensi, stok, distribusi, owner-dashboard) + portal launcher SSO. Belum ada **dashboard administrasi terpusat** untuk role `admin` (IT/HR pusat). Saat ini admin tidak punya tempat khusus untuk mengelola staff lintas 19 outlet, reset kredensial, dan suspend akun.

Modul staff-management yang ada (`apps/absensi/manajemen-kru`) **scoped 1 outlet & hanya bikin `crew`** — tidak cukup untuk kebutuhan admin yang lintas outlet & semua role.

### Roadmap 3 Fase (konteks; hanya Fase 1 yang di-spec di sini)

- **Fase 1 (dokumen ini):** Fondasi/scaffold app + Staff Management + User Accounts (reset password, suspend, delete).
- **Fase 2:** Outlet Master Data + System Configuration (threshold stok per outlet).
- **Fase 3:** Audit & Activity Logs + Health & Monitoring.

---

## Keputusan Desain (hasil brainstorming)

| # | Keputusan | Pilihan |
|---|-----------|---------|
| Q1 | Pengguna dashboard | **Hanya `admin`** |
| Q4 | Strategi backend aksi admin | **Edge Functions baru khusus admin** (`admin-*`) |
| Q5 | Penugasan `kepala_outlet` multi-outlet (`staff_outlets`) | **Termasuk di Fase 1** |
| Q6 | Lokasi app | **App baru `apps/admin-dashboard`** (subdomain `admin.sukashawarma.com`) |
| — | Strategi delete | **Default suspend (soft, reversible)**; hard-delete tombol terpisah + konfirmasi tegas |

---

## Arsitektur

### App baru: `apps/admin-dashboard`

Next.js app router, **Node server** (sesuai ADR-008, bukan static export), subdomain `admin.sukashawarma.com`. Mengikuti pola `owner-dashboard`.

```
apps/admin-dashboard/
├── src/
│   ├── middleware.ts            → enforceAppAccess(req, 'admin-dashboard', { rootRewritePath: '/dashboard' })
│   ├── app/
│   │   ├── layout.tsx           → Providers (QueryClient, Auth, Toast)
│   │   ├── page.tsx             → redirect ke /dashboard
│   │   └── dashboard/
│   │       ├── layout.tsx       → Sidebar + Header (admin shell)
│   │       ├── page.tsx         → ringkasan (jumlah staff/outlet, quick links)
│   │       └── staff/
│   │           └── page.tsx     → Staff Management (modul utama Fase 1)
│   ├── components/              → StaffTable, StaffFilters, StaffForm, OutletMultiSelect, ResetPasswordDialog, StatusToggle
│   ├── hooks/                   → useStaff, useOutlets, useStaffMutations (React Query)
│   └── lib/
│       └── supabase.ts          → delegate ke @suka/auth createSupabaseBrowserClient() (hindari two-factory gotcha)
├── next.config.ts              → bersih (tanpa output:'export'), typescript.ignoreBuildErrors: true
├── tsconfig.json               → baseUrl:".", types: ["vitest/globals","@testing-library/jest-dom"]
└── package.json
```

### Perubahan di `packages/auth` (registrasi app ke SSO)

- `AppName` += `'admin-dashboard'`
- `ROLE_APP_ACCESS`: `admin → [..., 'admin-dashboard']` (hanya admin yang punya akses)
- `accessibleApps()` otomatis ikut (baca matriks)
- **Build wajib** `packages/auth` setelah edit (`dist/` di-consume; lihat suka-auth-dist-gotcha)

### Perubahan di `apps/portal` launcher

- `APP_URL`: `'admin-dashboard': process.env.NEXT_PUBLIC_APP_URL_ADMIN_DASHBOARD ?? 'https://admin.sukashawarma.com'`
- `APP_META`: `{ label: 'Admin', url, desc: 'Administrasi staff, akun & sistem' }`

### Auth guard

`enforceAppAccess(req, 'admin-dashboard', ...)` di middleware menolak non-admin (infrastruktur sudah ada). Localhost di-skip untuk dev.

---

## Backend — Edge Functions

4 Edge Function baru di `supabase/functions/`. Semua **validasi caller `role='admin'`** via token + service-role client. Memisahkan privilege admin dari `create-staff`/`delete-staff` lama (yang tetap SPV/outlet-scoped — **tidak disentuh, tanpa regresi**).

**Pola validasi caller (seragam, tiap function):**
```
token → admin.auth.getUser(token) → cek outlet_staff.role === 'admin'
  jika bukan admin → 403 Unauthorized
```

| Function | Input | Aksi |
|----------|-------|------|
| `admin-create-staff` | name, username, password, role, outlet_id, outlet_ids? | createUser (email_confirm) + insert `outlet_staff` (role apa pun, outlet mana pun). Jika role=`kepala_outlet`, isi `staff_outlets` dari `outlet_ids`. Rollback auth user kalau insert gagal. |
| `admin-update-staff` | staff_id, name?, role?, outlet_id?, outlet_ids? | Update `outlet_staff`; sinkronkan `staff_outlets` (delete-insert) bila `kepala_outlet`. |
| `admin-reset-password` | staff_id, new_password | `auth.admin.updateUserById(staff_id, { password })`. |
| `admin-set-status` | staff_id, status (`active`/`inactive`/`on_leave`) | Update `outlet_staff.status` (suspend = soft, reversible). |

**Hard delete:** tetap pakai `delete-staff` existing. Di UI admin, hard-delete adalah tombol **terpisah** dengan konfirmasi tegas — bukan aksi default (hindari kehilangan data ledger/absensi yang FK ke staff). Default operasi nonaktif = `admin-set-status` → `inactive`.

Email staff di-generate dari username (pola `generateStaffEmail` existing).

---

## Database — Migration

Satu migration baru: `supabase/migrations/<ts>_admin_read_all_staff.sql`.

RLS `outlet_staff` saat ini hanya punya: read-self, SPV/kepala read-own-outlet (self-referencing). **Tidak ada policy admin read-all** → admin yang query langsung hanya dapat barisnya sendiri.

Karena policy existing self-referencing (rawan rekursi bila ditambah policy admin serupa), pakai helper `SECURITY DEFINER`:

```sql
CREATE FUNCTION is_admin() RETURNS boolean
  LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND role = 'admin')
$$;

CREATE POLICY outlet_staff_admin_read_all ON outlet_staff
  FOR SELECT TO authenticated USING (is_admin());
```

`is_admin()` definer → bypass RLS → tidak rekursi. Read path admin (list staff lintas outlet via browser client) jadi aman.

> Catatan: write path admin via Edge Function service-role (sudah punya policy `outlet_staff_service_role_insert/update`). `staff_outlets` write juga via service-role.

---

## Komponen UI

Adaptasi dari `absensi/manajemen-kru`, tapi **cross-outlet & semua role**.

| Komponen | Tanggung jawab |
|----------|----------------|
| `StaffTable` | Tabel (desktop) + kartu (mobile) daftar staff lintas outlet; kolom: Nama, Role, Outlet, Status, Aksi |
| `StaffFilters` | Filter by outlet + role + status + search nama (19 outlet, perlu filter) |
| `StaffForm` | Create/edit: nama, username, password, role (semua 7), outlet. Conditional `OutletMultiSelect` saat role=`kepala_outlet` |
| `OutletMultiSelect` | Multi-pilih outlet binaan (untuk `staff_outlets`) |
| `ResetPasswordDialog` | Set password baru → `admin-reset-password` |
| `StatusToggle` | Suspend/aktifkan (soft) + tombol hard-delete terpisah dgn konfirmasi |

**Hooks (React Query):**
- `useStaff` — list + filter (read langsung `outlet_staff` join `outlets`)
- `useOutlets` — daftar outlet untuk dropdown/multi-select
- `useStaffMutations` — create/update/reset/status/delete → invalidate `['staff']`

---

## Data Flow

**Create (contoh):**
```
StaffForm (client)
  → fetch admin-create-staff + Bearer session.access_token
  → Edge Function: validasi admin → createUser → insert outlet_staff (+ staff_outlets bila kepala_outlet)
  → return { ok, staff_id }
  → React Query invalidate ['staff'] → tabel refresh + toast
```

**Read:**
```
useStaff → browser client (RLS: is_admin() → lihat semua) → outlet_staff join outlets
```

---

## Testing (TDD)

Setup vitest + jsdom + testing-library (mirror tsconfig & deps `apps/stok` — playbook hardening).

- **Edge Function guard:** caller non-admin → 403 (semua 4 function). Rollback auth user saat insert `outlet_staff` gagal di `admin-create-staff`.
- **Component:** `StaffForm` menampilkan `OutletMultiSelect` **hanya** saat role=`kepala_outlet`; `StaffFilters` memfilter baris by outlet/role/status/search.
- **Hooks:** `useStaffMutations` invalidate `['staff']` setelah sukses.

---

## Verifikasi Selesai

- `yarn type-check` clean (root)
- `yarn build` admin-dashboard sukses
- Smoke test browser: login admin → `/dashboard/staff` → create (semua role + kepala_outlet multi-outlet) → edit → reset password → suspend → (hard-delete dgn konfirmasi)
- Non-admin login ditolak masuk admin-dashboard (guard)

---

## Out of Scope (Fase 1)

- Outlet/item master data, system config → Fase 2
- Audit log, health monitoring → Fase 3
- Owner read-only access ke admin-dashboard (admin-only)

---

**Owner:** Dev Suka Shawarma
**Terkait:** `docs/ROLE-JOBDESK.md` (matriks role), ADR-008 (Node server), `CLAUDE.md` (Outlet Model & RLS)
