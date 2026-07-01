# Panduan Penambahan Akun Karyawan / Admin via Script

Dokumen ini menjelaskan cara menggunakan script bawaan untuk menambahkan akun baru secara langsung ke database Supabase (bypass interface pendaftaran jika sedang tidak tersedia). Hal ini sangat berguna untuk membuat akun "Super" atau akun "Admin HR" awal.

## Prasyarat

Pastikan file `.env.local` di root proyek sudah terisi dengan:
```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key-anda>
```

> [!WARNING]
> Jangan gunakan `NEXT_PUBLIC_SUPABASE_ANON_KEY` untuk script ini. Script ini membutuhkan `SUPABASE_SERVICE_ROLE_KEY` agar dapat menembus RLS (Row Level Security) dan membuat user di auth.users secara instan.

## 1. Membuat Akun Admin HR (Template)

Terdapat script bash sederhana yang siap dijalankan untuk membuatkan akun **Admin HR** (`admin_hr`) yang berpusat di "Kantor Pusat".

Jalankan perintah berikut di terminal:
```bash
./scripts/seed-admin-hr.sh
```

**Konfigurasi Bawaan Script `seed-admin-hr.sh`:**
- Email: `hr.admin@sukashawarma.com`
- Password: `sukashawarmaHR2026!`
- Role: `admin_hr`
- Outlet: `ffffffff-ffff-ffff-ffff-ffffffffffff` (UUID statis Kantor Pusat)

Jika Anda ingin mengubah email atau data lainnya, cukup buka file `scripts/seed-admin-hr.sh` dan ubah argumen pada perintah `node "$SCRIPT" ...`.

## 2. Membuat Akun Secara Kustom (CLI)

Di balik layar, `seed-admin-hr.sh` mengeksekusi script Node.js bernama `create_user.mjs`. Anda bisa langsung menggunakan script Node ini untuk membuat user dengan role apapun (seperti `staff_pusat`, `admin`, `leader`, dll) secara dinamis.

**Sintaks:**
```bash
node scripts/create_user.mjs --email <EMAIL> --password <PASSWORD> --name <NAMA> --username <USERNAME> --role <ROLE> --outlet <OUTLET_ID>
```

**Contoh: Membuat Akun Staff Pusat**
```bash
node scripts/create_user.mjs \
  --email "staff.pusat@sukashawarma.com" \
  --password "rahasia123" \
  --name "Budi Staff" \
  --username "budi_pusat" \
  --role "staff_pusat" \
  --outlet "ffffffff-ffff-ffff-ffff-ffffffffffff"
```

## Referensi Role Valid
Pastikan nilai argumen `--role` sesuai dengan role yang didukung sistem:
- `admin`
- `admin_hr`
- `owner`
- `spv`
- `leader`
- `crew`
- `kiosk`
- `kitchen`
- `mitra`
- `staff_pusat`
