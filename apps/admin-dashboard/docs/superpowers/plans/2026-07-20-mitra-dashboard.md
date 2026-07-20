# Dashboard Mitra Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Membangun portal khusus MITRA yang menampilkan outlet, orderan, tim, investasi, bukti transfer bulanan, dan form saran — plus halaman admin untuk mengelola data mitra.

**Architecture:** Dua halaman baru: `/dashboard/mitra` (kartu outlet + drawer detail per outlet) dan `/dashboard/owner/kelola-mitra` (admin CRUD). Data disimpan di 4 tabel Supabase baru. Notifikasi push menggunakan Edge Function `send-push` yang sudah ada.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (PostgreSQL + Storage + Edge Functions), Tailwind CSS, Lucide icons, `@suka/auth`.

## Global Constraints

- Semua path file dimulai dari root: `apps/admin-dashboard/`
- Gunakan pattern yang sudah ada: server component fetch data lalu client component render UI
- Ikuti naming convention: PascalCase komponen, kebab-case folder route
- Bahasa UI: Bahasa Indonesia
- Semua query Supabase menggunakan `createClient()` dari `@/lib/supabase`
- Auth: gunakan `useAuth()` dari `@suka/auth`
- Role type: `'ADMIN_HR' | 'OWNER' | 'ADMIN' | 'MITRA'`
- Test runner: Vitest (`npx vitest run`)
- Format currency: `Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })`

---

### Task 1: SQL Migration + Supabase Storage

Jalankan manual di Supabase SQL Editor. File ini hanya referensi.

- [ ] Buka Supabase Dashboard > SQL Editor, jalankan SQL berikut:

CREATE TABLE IF NOT EXISTS mitra_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nama_mitra text NOT NULL,
  outlet_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS mitra_investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  nilai_investasi numeric(15,2) NOT NULL DEFAULT 0,
  tanggal_mulai date NOT NULL,
  catatan text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(outlet_id)
);

CREATE TABLE IF NOT EXISTS mitra_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  bulan date NOT NULL,
  nominal numeric(15,2) NOT NULL,
  bukti_url text NOT NULL,
  catatan text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(outlet_id, bulan)
);

CREATE TABLE IF NOT EXISTS mitra_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  outlet_id uuid REFERENCES outlets(id),
  isi_saran text NOT NULL,
  status text NOT NULL DEFAULT 'baru' CHECK (status IN ('baru', 'dibaca', 'ditanggapi')),
  tanggapan text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mitra_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE mitra_investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mitra_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE mitra_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mitra_profiles_select_own" ON mitra_profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "mitra_profiles_admin_all" ON mitra_profiles FOR ALL USING (EXISTS (SELECT 1 FROM outlet_staff WHERE outlet_staff.user_id = auth.uid() AND outlet_staff.role IN ('admin','owner')));

CREATE POLICY "mitra_investments_select_own" ON mitra_investments FOR SELECT USING (outlet_id = ANY(SELECT unnest(outlet_ids) FROM mitra_profiles WHERE user_id = auth.uid()));
CREATE POLICY "mitra_investments_admin_all" ON mitra_investments FOR ALL USING (EXISTS (SELECT 1 FROM outlet_staff WHERE outlet_staff.user_id = auth.uid() AND outlet_staff.role IN ('admin','owner')));

CREATE POLICY "mitra_transfers_select_own" ON mitra_transfers FOR SELECT USING (outlet_id = ANY(SELECT unnest(outlet_ids) FROM mitra_profiles WHERE user_id = auth.uid()));
CREATE POLICY "mitra_transfers_admin_all" ON mitra_transfers FOR ALL USING (EXISTS (SELECT 1 FROM outlet_staff WHERE outlet_staff.user_id = auth.uid() AND outlet_staff.role IN ('admin','owner')));

CREATE POLICY "mitra_suggestions_select_own" ON mitra_suggestions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "mitra_suggestions_insert_own" ON mitra_suggestions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "mitra_suggestions_admin_all" ON mitra_suggestions FOR ALL USING (EXISTS (SELECT 1 FROM outlet_staff WHERE outlet_staff.user_id = auth.uid() AND outlet_staff.role IN ('admin','owner')));

- [ ] Buat bucket Storage: Supabase > Storage > New Bucket, name: `mitra-transfers`, Public: No
- [ ] Jalankan storage policies di SQL Editor:

CREATE POLICY "admin_upload_mitra_transfers" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'mitra-transfers' AND EXISTS (SELECT 1 FROM outlet_staff WHERE outlet_staff.user_id = auth.uid() AND outlet_staff.role IN ('admin','owner')));
CREATE POLICY "mitra_download_own_transfers" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'mitra-transfers' AND (EXISTS (SELECT 1 FROM outlet_staff WHERE outlet_staff.user_id = auth.uid() AND outlet_staff.role IN ('admin','owner')) OR split_part(name,'/',1)::uuid = ANY(SELECT unnest(outlet_ids) FROM mitra_profiles WHERE user_id = auth.uid())));
CREATE POLICY "admin_delete_mitra_transfers" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'mitra-transfers' AND EXISTS (SELECT 1 FROM outlet_staff WHERE outlet_staff.user_id = auth.uid() AND outlet_staff.role IN ('admin','owner')));

- [ ] Verifikasi: 4 tabel baru muncul di Table Editor, bucket `mitra-transfers` muncul di Storage
- [ ] Commit: `git commit -m "chore: add mitra migration SQL (run manually in Supabase)"`

---

### Task 2: Update Redirect dan Route Guard MITRA

Files:
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/app/dashboard/ClientRedirect.tsx`
- Modify: `src/components/layout/RoleContext.tsx`

- [ ] Di `src/app/dashboard/page.tsx`, ubah `MITRA: '/dashboard/owner'` menjadi `MITRA: '/dashboard/mitra'`
- [ ] Di `src/app/dashboard/ClientRedirect.tsx`, ubah `MITRA: '/dashboard/owner'` menjadi `MITRA: '/dashboard/mitra'`
- [ ] Di `src/components/layout/RoleContext.tsx`, cari useEffect route-guard MITRA (baris ~66), ubah array allowed:
  const allowed = ['/dashboard/mitra']
  if (!allowed.some((a) => pathname === a || pathname.startsWith(a + '/'))) { router.replace('/dashboard/mitra') }
- [ ] Verifikasi: login sebagai mitra > diarahkan ke /dashboard/mitra. Akses /dashboard/owner manual > diredirect kembali.
- [ ] Commit: `git commit -m "feat(mitra): redirect MITRA to /dashboard/mitra and update route guard"`

---

### Task 3: Update navConfig dan Test

Files:
- Modify: `src/components/layout/navConfig.ts`
- Modify: `src/components/layout/navConfig.test.ts`

- [ ] Di `navConfig.ts`, tambah `Handshake` ke import lucide-react
- [ ] Hapus `'MITRA'` dari group Bisnis (roles array di group dan item Ringkasan Bisnis)
- [ ] Tambah group baru setelah Bisnis:
  { title: 'Portal Mitra', icon: Handshake, roles: ['MITRA'], items: [{ href: '/dashboard/mitra', label: 'Dashboard Saya', shortLabel: 'Dashboard', icon: LayoutDashboard, roles: ['MITRA'] }] }
- [ ] Tambah item di group Bisnis untuk ADMIN/OWNER:
  { href: '/dashboard/owner/kelola-mitra', label: 'Kelola Mitra', shortLabel: 'Mitra', icon: Handshake, roles: ['OWNER', 'ADMIN'] }
- [ ] Update `navConfig.test.ts` - ganti ekspektasi MITRA dari 4 halaman owner menjadi 1 halaman /dashboard/mitra, dan group dari 'Bisnis' ke 'Portal Mitra' berisi 1 item
- [ ] Jalankan: `npx vitest run src/components/layout/navConfig.test.ts` > Expected: PASS
- [ ] Commit: `git commit -m "feat(mitra): add Portal Mitra nav group"`

---

### Task 4: Halaman /dashboard/mitra (Kartu Outlet)

Files:
- Create: `src/app/dashboard/mitra/page.tsx`
- Create: `src/app/dashboard/mitra/MitraDashboardView.tsx`
- Create: `src/app/dashboard/mitra/MitraOutletCard.tsx`

- [ ] Buat `src/app/dashboard/mitra/page.tsx` - server component yang fetch mitra_profile, outlets, mitra_investments, dan omzet bulan ini dari orders
- [ ] Buat `src/app/dashboard/mitra/MitraOutletCard.tsx` - card dengan nama outlet, alamat, badge aktif, ROI bulan ini, nilai investasi, tombol Lihat Detail
- [ ] Buat `src/app/dashboard/mitra/MitraDashboardView.tsx` - client component dengan header welcome + grid kartu + state selectedOutletId (drawer placeholder dulu)
- [ ] Verifikasi: /dashboard/mitra menampilkan kartu outlet dengan benar
- [ ] Commit: `git commit -m "feat(mitra): add /dashboard/mitra with outlet cards"`

---

### Task 5: Drawer Detail (6 Tab)

Files:
- Create: `src/app/dashboard/mitra/tabs/TabInfoOutlet.tsx`
- Create: `src/app/dashboard/mitra/tabs/TabOrderan.tsx`
- Create: `src/app/dashboard/mitra/tabs/TabTim.tsx`
- Create: `src/app/dashboard/mitra/tabs/TabInvestasi.tsx`
- Create: `src/app/dashboard/mitra/tabs/TabTransfer.tsx`
- Create: `src/app/dashboard/mitra/tabs/TabSaran.tsx`
- Create: `src/app/dashboard/mitra/MitraOutletDrawer.tsx`
- Modify: `src/app/dashboard/mitra/MitraDashboardView.tsx`

- [ ] Buat TabInfoOutlet: tampilkan alamat, telepon, jam operasional, tipe outlet dalam card rows
- [ ] Buat TabOrderan: fetch orders by outlet_id, tampilkan list dengan pagination 15/hal, badge status berwarna
- [ ] Buat TabTim: fetch outlet_staff by outlet_id, tampilkan nama + role + badge aktif
- [ ] Buat TabInvestasi: fetch mitra_investments + total omzet kumulatif dari orders, hitung ROI = omzet/investasi*100
- [ ] Buat TabTransfer: fetch mitra_transfers, tampilkan list dengan preview gambar on-click + tombol download
- [ ] Buat TabSaran: form kirim saran (INSERT mitra_suggestions) + riwayat saran dengan status dan tanggapan admin
- [ ] Buat MitraOutletDrawer: drawer slide dari kanan, 6 tab pill, render tab aktif
- [ ] Update MitraDashboardView: import dan render MitraOutletDrawer dengan backdrop overlay
- [ ] Verifikasi: klik kartu outlet > drawer muncul, semua 6 tab berfungsi
- [ ] Commit: `git commit -m "feat(mitra): add outlet drawer with 6 tabs"`

---

### Task 6: Halaman Admin /dashboard/owner/kelola-mitra

Files:
- Create: `src/app/dashboard/owner/kelola-mitra/page.tsx`
- Create: `src/app/dashboard/owner/kelola-mitra/KelolaMitraView.tsx`
- Create: `src/app/dashboard/owner/kelola-mitra/MitraFormDialog.tsx`
- Create: `src/app/dashboard/owner/kelola-mitra/TransferUploadDialog.tsx`
- Create: `src/app/dashboard/owner/kelola-mitra/SaranInbox.tsx`
- Create: `src/app/dashboard/owner/kelola-mitra/actions.ts`

- [ ] Buat actions.ts dengan Server Actions: upsertMitraProfile, upsertInvestasi, saveMitraTransfer, balasSaran (update DB + kirim push ke Edge Function send-push)
- [ ] Buat MitraFormDialog: form input user_id + nama mitra + multi-select outlet, panggil upsertMitraProfile
- [ ] Buat TransferUploadDialog: select outlet + input bulan (type=month) + nominal + file upload ke storage mitra-transfers + panggil saveMitraTransfer
- [ ] Buat SaranInbox: list saran masuk dengan badge status, form balas inline yang panggil balasSaran (termasuk push notification ke mitra)
- [ ] Buat KelolaMitraView: 3-tab layout (Daftar Mitra / Upload Transfer / Inbox Saran), tabel mitra dengan tombol edit, badge counter saran baru di tab
- [ ] Buat page.tsx: server component fetch mitras + outlets + suggestions, enrich suggestions dengan nama outlet
- [ ] Verifikasi: /dashboard/owner/kelola-mitra accessible oleh ADMIN, semua CRUD jalan
- [ ] Commit: `git commit -m "feat(mitra): add kelola-mitra admin page"`

---

### Task 7: Verifikasi Final

- [ ] `npx vitest run src/components/layout/navConfig.test.ts` > PASS
- [ ] `npx tsc --noEmit` > no errors
- [ ] Checklist manual: MITRA login > /dashboard/mitra, semua 6 tab drawer jalan, admin bisa CRUD + upload + balas saran + notif terkirim, route guard blokir MITRA dari /dashboard/owner
- [ ] `git commit -m "feat(mitra): complete Dashboard Mitra feature"`
