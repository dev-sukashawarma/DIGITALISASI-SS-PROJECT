# 🚀 Dokumentasi CI/CD & Deploy SUKASHAWARMA (GHCR ke Coolify)

## 📌 Ringkasan Arsitektur Baru

Project website Sukashawarma dikembangkan menggunakan **Astro 7 (Static Site Generation / SSG)**.

Sebelumnya, build dijalankan langsung di VPS via Nixpacks. Hal ini membebani CPU & RAM VPS Hostinger karena harus mengunduh paket Node dan mengompilasi Astro di server produksi.

Kini mekanisme deployment disamakan dengan **admin-dashboard, absensi, finance, inventori, stok, dll**:
1. **GitHub Actions** melakukan checkout, build Astro SSG ke HTML/CSS/JS statis di dalam container Docker.
2. Image hasil build berbasis **Nginx Alpine** (~25MB) di-push ke **GitHub Container Registry (GHCR)**:
   `ghcr.io/dev-sukashawarma/digitalisasi-ss-project/sukashawarma:latest`
3. GitHub Actions memanggil API webhook Coolify:
   `https://coolify.sukashawarma.tech/api/v1/deploy?uuid=jz9pnxnvxf9q7yck6fk2trt0`
4. VPS Hostinger hanya melakukan `docker pull` image yang sudah jadi dan me-restart container.
5. GitHub Actions menjalankan verifikasi **Smoke Test** memastikan website `https://sukashawarma.com` live dan merespons HTTP 200.

---

## ⚙️ Pengaturan di Coolify

| Parameter | Nilai |
| :--- | :--- |
| **Application UUID** | `jz9pnxnvxf9q7yck6fk2trt0` |
| **Build Pack** | `Docker Image` |
| **Image** | `ghcr.io/dev-sukashawarma/digitalisasi-ss-project/sukashawarma:latest` |
| **Exposed Port** | `80` |
| **Domains** | `https://sukashawarma.com`, `https://www.sukashawarma.com` |

---

## 🛠️ Komponen File

1. **`SUKASHAWARMA/Dockerfile`**:
   - Multi-stage build (`node:22-bookworm-slim` untuk build -> `nginx:alpine` untuk web server).
   - Ukuran image sangat kecil, RAM runtime hanya ~5MB.
2. **`SUKASHAWARMA/nginx.conf`**:
   - Gzip aktif untuk teks, CSS, JS, SVG, JSON.
   - Cache immutable 1 tahun untuk asset `/_astro/*`.
   - Routing `try_files` untuk clean URLs SSG dan fallback 404.
3. **`.github/workflows/deploy-sukashawarma-coolify.yml`**:
   - Workflow otomatis yang terpicu saat ada push ke `SUKASHAWARMA/**` di branch `main` atau via manual `workflow_dispatch`.
