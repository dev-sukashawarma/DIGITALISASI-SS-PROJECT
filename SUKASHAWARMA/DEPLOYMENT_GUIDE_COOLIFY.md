# 🚀 Dokumentasi Deploy Astro ke Coolify (Monorepo)

## 📌 Ringkasan Masalah & Solusi

Project website Sukashawarma dikembangkan menggunakan **Astro 7 (Static Site Generation / SSG)** dan diletakkan di dalam folder `/SUKASHAWARMA` pada Monorepo `DIGITALISASI-SS-PROJECT.git`.

---

## 🛠️ Detail Masalah & Perbaikan

### 1. Error Encoding UTF-8 (`check_rpc.js`)
* **Penyebab:** Coolify mencoba melakukan scan pada root directory `/` dan membaca file non-UTF8 di folder admin-dashboard.
* **Solusi:** Mengatur **Base Directory** di Coolify menjadi `/SUKASHAWARMA`.

### 2. Node.js Version Incompatibility
* **Penyebab:** Astro 7 membutuhkan Node.js `>=22.12.0`, namun Nixpacks bawaan Coolify memilih Node.js v18.20.5.
* **Solusi:**
  - Menambahkan `"engines": { "node": "23" }` di `package.json` root & subfolder.
  - Membuat file `.nvmrc` dan `.node-version` berisi `23`.
  - Mengatur `NIXPACKS_NODE_VERSION=23` di Environment Variables Coolify.

### 3. Docker Cache Invalidation
* **Penyebab:** Docker di Coolify meng-cache layer lama yang berisi Node 18 sehingga perbaikan versi Node diabaikan.
* **Solusi:** Menambahkan file `nixpacks.toml` dengan konfigurasi:
  ```toml
  [phases.setup]
  nixPkgs = ["nodejs_23"]

  [variables]
  NIXPACKS_NODE_VERSION = "23"
  ```
  Ini memaksa Docker mereset cache dan mengunduh paket `nodejs_23` dari Nixpkgs.

---

## ⚙️ Pengaturan Standar di Coolify (Cheat Sheet)

Saat membuat atau mengedit Resource Astro Static di Coolify:

| Setting Field | Nilai Wajib |
| :--- | :--- |
| **Build Pack** | `Nixpacks` |
| **Is it a static site?** | `[x] Checked` (Centang) |
| **Base Directory** | `/SUKASHAWARMA` |
| **Publish Directory** | `/dist` |
| **Start Command** | *(Kosongkan)* |
| **Environment Variable** | `NIXPACKS_NODE_VERSION` = `23` |

---
*Dokumen ini dibuat otomatis sebagai panduan rujukan deployment Coolify.*
