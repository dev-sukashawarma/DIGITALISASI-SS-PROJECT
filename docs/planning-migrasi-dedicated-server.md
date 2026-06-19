# Planning: Bikin Server Sendiri (On-Premise Dedicated Server)

**Status:** Contingency / Jaga-jaga — **belum untuk dieksekusi.** Disimpan sebagai opsi cadangan kalau suatu saat butuh pindah ke infra milik sendiri.
**Tanggal:** 2026-06-19
**Konteks:** Suka Shawarma Outlet Suite (Next.js apps: stok, distribusi, absensi, owner-dashboard + Supabase). 19 outlet. Rencana: **bangun server fisik sendiri**, hosting semua app + database di mesin milik sendiri.

> ⚠️ Catatan: ini bukan rencana aktif. Produksi saat ini di shared hosting connectindo (lihat CLAUDE.md). Dokumen ini = referensi kalau kondisi berubah (regulasi data on-site, ada tim ops, traffic/biaya tumbuh besar). Saat itu tiba, baca ulang §6 (risiko) & §7 (pertanyaan terbuka) dulu.

> Dokumen ini = satu jalur eksekusi membangun server sendiri: kebutuhan hardware, software, jaringan/infrastruktur, langkah teknis, operasional, dan perkiraan biaya.

---

## 1. Lingkup Keputusan Awal

Karena bikin server sendiri, asumsi:
- **Database Supabase di-self-host** di server sendiri (Postgres + Auth + Realtime + Storage). Kalau mau database tetap di Supabase Cloud, beban server jauh lebih ringan — tandai keputusan ini di awal.
- Server diletakkan di **kantor/ruang server sendiri** (on-premise), bukan colocation. (Kalau mau dititip di data center/colo, hardware sama, beda di listrik/internet/AC yang ditanggung DC.)
- Semua app jalan di 1 mesin (bisa dipisah nanti kalau beban tumbuh).

---

## 2. Kebutuhan Hardware

### Server utama
| Komponen | Spesifikasi yang Disarankan | Catatan |
|----------|----------------------------|---------|
| **CPU** | 8 core / 16 thread (mis. Xeon E-series / Ryzen 7-9 / EPYC entry) | Postgres + Node + Realtime |
| **RAM** | 32 GB (minimum 16 GB) ECC | Postgres rakus RAM; ECC cegah korup data |
| **Storage OS+App** | 1× 500 GB NVMe SSD | Sistem & aplikasi |
| **Storage DB** | 1× 500 GB – 1 TB NVMe (idealnya terpisah dari OS) | I/O Postgres tinggi, pisahkan |
| **Storage Backup** | 1× 1–2 TB HDD/SSD (atau NAS) | Backup lokal, JANGAN di disk DB |
| **RAID** | RAID 1 (mirror) untuk disk DB | Redundansi kalau 1 disk mati |
| **PSU** | Redundant power supply (kalau rack server) | Opsional tapi bagus |
| **Form factor** | Tower atau Rack 1U/2U | Tower cukup untuk kantor |

### Infrastruktur pendukung (WAJIB untuk on-premise)
| Item | Fungsi | Catatan |
|------|--------|---------|
| **UPS** | Backup listrik saat mati lampu | Minimal tahan 15–30 menit untuk shutdown aman. Sangat krusial — mati mendadak = risiko korup Postgres |
| **Koneksi internet IP statis** | Akses publik ke server | Wajib paket bisnis dgn **IP publik statis** dari ISP |
| **Internet redundan (2 ISP)** | Failover kalau 1 ISP down | Sangat disarankan; outlet bergantung real-time |
| **Pendingin / AC ruangan** | Server panas 24/7 | Ruang server butuh suhu stabil |
| **Router/Firewall hardware** | NAT, port forward, proteksi | MikroTik / pfSense |
| **Switch** | Jaringan lokal | Kalau perlu |

### Domain & DNS
- Domain `sukashawarma.com` sudah ada → arahkan A record subdomain ke **IP publik statis** server.
- Disarankan pasang **Cloudflare** di depan (gratis): sembunyikan IP asli, CDN, proteksi DDoS, TLS.

---

## 3. Kebutuhan Software / Stack

| Layer | Pilihan | Fungsi |
|-------|---------|--------|
| OS | **Ubuntu Server 24.04 LTS** | Sistem operasi server |
| Runtime | **Node.js 24 LTS** (nvm/nodesource) | Jalankan Next.js (samakan dgn produksi sekarang) |
| Process Manager | **PM2** | Auto-restart app, cluster mode, log (ganti Passenger) |
| Reverse Proxy | **Nginx** | Routing subdomain → port app, TLS, gzip |
| TLS/SSL | **Let's Encrypt + certbot** | Sertifikat HTTPS gratis auto-renew |
| Container | **Docker + docker-compose** | Untuk self-host Supabase (compose resmi) |
| Database | **PostgreSQL 15/16** (via stack Supabase) | + ekstensi Supabase, Auth, Realtime, Storage |
| Firewall | **ufw + fail2ban** | Buka 22/80/443 saja, blok brute-force |
| Backup | **pg_dump / WAL-G** + cron | Backup DB rutin, off-site |
| Monitoring | **Uptime Kuma / Netdata** | Uptime, CPU, RAM, disk + alert (Telegram/email) |
| CI/CD | **GitHub Actions → SSH deploy** | Otomatisasi deploy (ganti manual cPanel) |

### Arsitektur target
```
Internet
   │
[Cloudflare]  (DNS, TLS, sembunyikan IP, CDN) — disarankan
   │
[Router/Firewall] port forward 80/443 → server
   │
[Nginx :443] reverse proxy di server
   ├── stok.sukashawarma.com       → 127.0.0.1:3001 (PM2)
   ├── distribusi.sukashawarma.com → 127.0.0.1:3002 (PM2)
   ├── absensi.sukashawarma.com    → 127.0.0.1:3003 (PM2)
   ├── owner.sukashawarma.com      → 127.0.0.1:3004 (PM2)
   └── api Supabase self-host      → 127.0.0.1:8000 (Kong/Supabase)
```

---

## 4. Langkah Teknis (Fase per Fase)

### Fase 0 — Persiapan
- [ ] Beli & rakit hardware, pasang UPS, koneksi internet IP statis, AC.
- [ ] Inventarisasi semua app, env var, service role keys, subdomain.
- [ ] Catat IP publik statis dari ISP.

### Fase 1 — Setup OS & Hardening
- [ ] Install Ubuntu Server 24.04 LTS.
- [ ] Buat user non-root + sudo, **SSH key-only**, disable root & password login.
- [ ] `ufw` (izinkan 22/80/443), `fail2ban`.
- [ ] Set timezone, auto security update (`unattended-upgrades`).

### Fase 2 — Install Stack
- [ ] Node.js 24 + PM2, Nginx, certbot, Docker + docker-compose.
- [ ] Konfigurasi RAID 1 untuk disk DB, mount disk backup terpisah.

### Fase 3 — Database (Self-host Supabase)
- [ ] Deploy Supabase via docker-compose resmi.
- [ ] **Migrasi data dari Supabase Cloud:** `pg_dump` Cloud → restore ke self-host. Hati-hati: roles, RLS policies, extensions, schema `auth`, storage buckets.
- [ ] Jalankan ulang `supabase/migrations/` (ingat history drift → `migration repair` dulu).
- [ ] Re-create RLS, view definer, RPC `_svc`, helper `accessible_outlet_ids()`.
- [ ] Test auth (login), Realtime, Storage (foto absensi `ref_photo_url`).

### Fase 4 — Deploy Aplikasi
- [ ] `git clone` monorepo, `npm install`, build tiap app.
- [ ] PM2 ecosystem file → `pm2 start`, `pm2 startup` + `pm2 save` (auto-start saat reboot).
- [ ] Nginx server block per subdomain → port app, certbot issue TLS.
- [ ] **Penting (pelajaran SSO):** set `NEXT_PUBLIC_COOKIE_DOMAIN=.sukashawarma.com` & `SUPABASE_JWT_SECRET` di env tiap app **saat build**.

### Fase 5 — Jaringan Publik & Cutover
- [ ] Port forward 80/443 di router → server. Pasang DDNS/Cloudflare.
- [ ] Test via domain (bukan loopback) sebelum cutover.
- [ ] Turunkan TTL DNS dulu (300s), lalu arahkan A record subdomain → IP server.
- [ ] Smoke test semua app + SSO antar-subdomain. Hosting lama standby untuk rollback.

### Fase 6 — Operasional Rutin
- [ ] **Cron backup DB off-site** (ke object storage/NAS) + **test restore** rutin.
- [ ] Monitoring uptime + alert.
- [ ] CI/CD deploy otomatis.
- [ ] Runbook: cara restart, restore, rotate keys, prosedur saat mati listrik.

---

## 5. Perkiraan Biaya

> Kurs asumsi ~Rp16.000/USD. Indikatif — cek harga aktual saat beli.

### Biaya Awal (one-time)
| Item | Estimasi |
|------|----------|
| Server (8-core, 32 GB ECC, 2× NVMe + 1 HDD backup) | Rp25jt – 50jt |
| UPS (kapasitas memadai) | Rp3jt – 10jt |
| Router/Firewall (MikroTik) | Rp1,5jt – 5jt |
| Switch + kabel (jika perlu) | Rp500rb – 2jt |
| Rak server / meja (opsional) | Rp1jt – 5jt |
| **Total awal** | **~Rp30jt – 70jt** |

### Biaya Bulanan (recurring)
| Item | Estimasi/bln |
|------|-------------|
| Internet bisnis IP statis (1 ISP) | Rp1jt – 2jt |
| Internet ISP kedua (redundan, opsional) | Rp500rb – 1,5jt |
| Listrik (server + UPS + AC 24/7) | Rp500rb – 1,5jt |
| Object storage backup off-site (B2/Wasabi ~100GB) | ~Rp80rb |
| Cloudflare | Rp0 (free tier) |
| Domain (sudah ada) | — |
| **Total bulanan** | **~Rp2jt – 4,5jt/bln** |

### Biaya tersembunyi (jangan dilupakan)
- **Waktu engineer** setup awal + maintenance rutin (patch, backup, troubleshoot) — biaya terbesar yang sering dilupakan.
- **Tidak ada SLA** — kalau hardware/listrik/internet down, kamu sendiri yang tanggung downtime.
- Penggantian hardware (disk aus, kipas, UPS battery ~2-3 tahun).

---

## 6. Risiko & Mitigasi (On-Premise)

| Risiko | Mitigasi |
|--------|----------|
| Mati listrik mendadak → korup Postgres | UPS + auto-shutdown script + `pg` WAL |
| Internet ISP down → semua outlet tak akses | 2 ISP failover |
| Disk DB mati | RAID 1 + backup off-site harian |
| Server kena hack (terekspos publik) | Cloudflare (sembunyikan IP), firewall ketat, SSH key-only, fail2ban, update rutin |
| Overheat | AC ruangan + monitoring suhu |
| Tidak ada yang maintain | Tunjuk PJ ops + runbook tertulis |
| Backup tak pernah ditest | Jadwalkan test restore berkala |

⚠️ **Catatan jujur:** server sendiri = kontrol penuh + tanpa limit, **tapi semua tanggung jawab pindah ke kamu** (uptime, listrik, internet, security, backup). Pastikan ada **UPS, internet redundan, dan disiplin backup** sebelum cutover produksi — ini tiga titik gagal yang paling sering meremehkan.

---

## 7. Pertanyaan Terbuka (putuskan dulu)
1. Supabase ikut self-host, atau database tetap di Cloud? (menentukan spek RAM & beban ops)
2. Server ditaruh di kantor sendiri atau dititip colocation?
3. Pakai 1 atau 2 ISP (redundansi)?
4. Siapa penanggung jawab ops harian + on-call saat down?
5. Anggaran awal & bulanan yang disetujui?

**Last updated:** 2026-06-19
