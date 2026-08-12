# Laporan Perbaikan Build (Aplikasi Stok)

Dokumen ini merangkum rentetan error yang terjadi saat proses deployment di Coolify untuk aplikasi **stok** (berbasis Next.js 16 menggunakan Turbopack) dan solusi yang telah diterapkan.

---

Aplikasi stok mengalami dua masalah *module-not-found* beruntun selama proses build menggunakan Turbopack.

### A. Masalah Import `@suka/auth` (Workspace Package)
**Symptom:**
Turbopack gagal *resolve* package internal `@suka/auth`.

**Root Cause:**
`package.json` dari `packages/auth` hanya memiliki kondisi `"default"` di *field* `"exports"`. Turbopack (dan beberapa bundler modern) membutuhkan kondisi *export* yang spesifik untuk meresolusi package dari workspace.

**Fix yang Diterapkan:**
Menambahkan kondisi spesifik di `packages/auth/package.json`:
```json
"exports": {
  ".": {
    "types": "./src/index.ts",
    "source": "./src/index.ts",
    "import": "./src/index.ts",
    "require": "./src/index.ts",
    "default": "./src/index.ts"
  }
}
```

### B. Masalah Alias Path `@/*`
**Symptom:**
Error gagal import file internal (seperti tipe data di `@/lib/types/mutasi`).

**Root Cause:**
`tsconfig.json` di aplikasi `stok` mendefinisikan `"baseUrl": "."` dan paths `@/*` ke `./src/*`. Namun, karena perintah build dijalankan via *yarn workspace* dari *root monorepo*, Turbopack secara keliru meresolusi `.` ke root folder `/repo` alih-alih folder aplikasi `/repo/apps/stok`. Hal ini menyebabkan impor `@/lib/...` mencari direktori `lib` di root project.

**Fix yang Diterapkan:**
Menambahkan konfigurasi eksplisit alias untuk Turbopack di `apps/stok/next.config.mjs` menggunakan API *native* dari Turbopack (karena API `webpack()` standar menyebabkan *crash instan* di Next.js 16 Turbopack mode).

*File yang diubah (`apps/stok/next.config.mjs`):*
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... config lainnya
  
  // Turbopack native alias — Next.js 16 uses Turbopack by default for builds.
  // tsconfig paths are misresolved from monorepo root; this ensures @/* always
  // points to the correct apps/stok/src/ directory.
  turbopack: {
    resolveAlias: {
      '@': './src',
    },
  },
}

export default nextConfig;
```
Konfigurasi ini memastikan alias `@` selalu secara konsisten diarahkan ke folder `src` dari aplikasi `stok`, mengesampingkan resolusi `tsconfig` yang membingungkan akibat eksekusi dari root workspace.
