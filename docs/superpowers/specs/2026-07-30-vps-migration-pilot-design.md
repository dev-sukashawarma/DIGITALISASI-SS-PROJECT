# Migrasi Bertahap ke VPS — Pilot admin-dashboard + Supabase Self-Host Kandidat Produksi

**Status:** Draft disetujui — siap masuk fase writing-plans.
**Tanggal:** 2026-07-30
**Konteks:** Suka Shawarma Outlet Suite. Produksi saat ini di shared hosting connectindo (cPanel + CloudLinux Node Selector + LiteSpeed), lihat CLAUDE.md bagian Deployment. Ada dokumen lama `docs/planning-migrasi-dedicated-server.md` (on-premise fisik, contingency, belum dieksekusi) — dokumen ini **berbeda**: migrasi ke VPS (bukan server fisik sendiri), dan sudah untuk dieksekusi (mulai dari pilot).

---

## 1. Ringkasan & Tujuan

Migrasi bertahap dari shared hosting cPanel ke VPS, dengan **dua jalur paralel namun independen**:

1. **Jalur App:** `admin-dashboard` jadi pilot pertama pindah ke VPS (dikelola Coolify), tetap connect ke Supabase Cloud (produksi tak berubah). App lain (stok, distribusi, absensi, dst.) menyusul setelah pilot ini terbukti stabil — pola yang sama diulang per-app.
2. **Jalur Database:** Supabase self-host disiapkan di VPS yang sama sebagai **kandidat produksi**, disinkronkan harian (cron dump/restore Postgres + storage sync) dari Supabase Cloud. Tujuannya membuktikan kelayakan self-host sebelum dipromosikan jadi produksi sungguhan — **keputusan cutover DB itu sendiri di luar scope pilot ini.**

**Alasan migrasi** (kontrol/fleksibilitas, performa, biaya jangka panjang): shared hosting cPanel sekarang punya banyak gotcha operasional (npm wrapper CloudLinux, `server.cjs` manual, `next.config.js` ke-overwrite tiap `git pull`, tanpa CI/CD, build sempat mentok resource NPROC — lihat CLAUDE.md bagian Deployment & memory `deploy-resource-limits`). VPS + Coolify memberi kontrol proses penuh, deploy via git push, dan skala biaya yang lebih dapat diprediksi.

App lain (portal, stok, distribusi, dst.) tetap di cPanel selama transisi — SSO tetap jalan lintas server karena cookie domain `.sukashawarma.com` adalah mekanisme browser, bukan bergantung server fisik mana yang melayani tiap subdomain (lihat memory `sso-cookie-domain-gotcha`).

`pos-kasir` **tidak** ikut migrasi hosting web ini — rencana jangka panjangnya adalah native Android, jadi memindahkannya ke VPS lalu membongkarnya lagi kemudian dianggap sia-sia. Namun pos-kasir tetap konsumen Supabase yang sama seperti app lain (lihat §9 Di Luar Scope untuk implikasinya ke jalur database).

---

## 2. Arsitektur Target

```
Internet
   │
[Cloudflare] (opsional, disarankan) — DNS, TLS, sembunyikan IP
   │
   ├── admin.sukashawarma.com ──→ VPS baru (IP VPS, Hostinger KVM 2, lokasi Indonesia)
   │        │
   │        [Coolify] (reverse proxy Traefik + TLS otomatis di dalamnya)
   │        ├── admin-dashboard (Next.js, deploy via git push)
   │        └── Supabase self-host (docker-compose: Postgres+Auth+Realtime+Storage+Kong+Studio)
   │              ▲
   │              └── cron dump/restore harian ← Supabase Cloud (pg_dump + storage sync)
   │
   ├── app.sukashawarma.com        ──→ cPanel (103.77.106.237) — tetap (portal/launcher; nama subdomain terverifikasi via DNS lookup, bukan "portal.sukashawarma.com")
   ├── stok.sukashawarma.com       ──→ cPanel — tetap
   ├── distribusi.sukashawarma.com──→ cPanel — tetap
   ├── absensi.sukashawarma.com    ──→ cPanel — tetap
   └── (app lain)                  ──→ cPanel — tetap
```

**Poin kunci:**
- **admin-dashboard di VPS tetap connect ke Supabase Cloud** (env `NEXT_PUBLIC_SUPABASE_URL` tak berubah dari produksi sekarang) — Supabase self-host di VPS adalah instance *terpisah*, bukan yang dipakai admin-dashboard produksi.
- Supabase self-host punya URL/port sendiri, hanya diakses untuk keperluan pengujian/evaluasi, tidak dipakai app produksi mana pun selama pilot ini.
- Cookie domain `.sukashawarma.com` tetap berlaku lintas cPanel↔VPS karena itu murni mekanisme browser (Set-Cookie domain attribute), bukan jaringan internal server — dua server fisik berbeda bisa melayani subdomain berbeda tanpa masalah SSO, selama env `NEXT_PUBLIC_COOKIE_DOMAIN=.sukashawarma.com` konsisten di semua app saat build.

---

## 3. Sinkronisasi Data (Postgres + Storage) untuk Supabase Self-Host

Cron job harian (jam sepi trafik, mis. 03:00 WIB) di VPS menjalankan dua langkah berurutan, satu arah (Cloud → self-host), **tidak pernah sebaliknya**:

1. **Postgres:** `pg_dump` dari Supabase Cloud → `pg_restore` (drop & recreate) ke self-host Postgres. Mencakup schema `public` (tabel, RLS, RPC, views) dan schema `auth` (untuk konsistensi login user kalau kandidat produksi dites end-to-end). Kompatibilitas versi Postgres/extension Cloud vs self-host perlu diverifikasi saat implementasi.
2. **Storage:** sinkron bucket (`face-refs` dan bucket lain) dari Supabase Cloud Storage (S3-compatible API) ke Storage self-host, pakai `rclone sync` atau `aws s3 sync` — copy satu arah, sama seperti Postgres.

**Cron dipilih (bukan logical replication):** lebih sederhana, mudah dipantau, gagal-aman (retry di jadwal berikutnya tanpa merusak state). Staleness maksimal ~24 jam dianggap cukup untuk tujuan "kandidat produksi yang terus diuji", bukan hot-standby real-time. Logical replication ditolak karena rapuh terhadap migration schema yang sudah dikenal sering drift di project ini (lihat memory `supabase-migration-history-drift`) — replikasi bisa patah diam-diam saat migration jalan di Cloud.

**⚠️ Keamanan wajib:** karena cron ini menyalin **data produksi asli** (termasuk PII — foto wajah crew `face_descriptor`/`ref_photo_url`, data gaji/kasbon, dll) ke VPS baru, VPS harus di-harden setara server produksi **sejak hari pertama setup**, bukan diperlakukan sebagai "staging santai": firewall ketat (ufw), SSH key-only, akses Coolify & Postgres self-host dibatasi (bukan expose publik tanpa auth), TLS di semua endpoint termasuk Supabase Studio self-host.

---

## 4. Provider & Spek VPS

**Provider terpilih: Hostinger VPS KVM 2, lokasi data center Indonesia.**

- Spek: **2 vCPU / 8 GB RAM / 100 GB NVMe SSD**, 8TB bandwidth, dedicated IPv4, KVM isolation, **weekly backup bawaan** (relevan untuk §8).
- Harga: promo ~$6.99–9.99/bln (kontrak 12–24 bulan, ≈Rp112rb–160rb/bln), renewal ~$14.99/bln (≈Rp240rb/bln) — kurs asumsi ~Rp16rb/USD, konfirmasi harga persis saat checkout.
- Lokasi data center **Indonesia** dipilih secara eksplisit saat setup (bukan default) — menjaga latency rendah ke 19 outlet, alasan yang sama dengan kenapa produksi sekarang di connectindo. Hostinger juga punya lokasi lain (Singapore, India, Malaysia) tapi **tidak dipakai** untuk deployment ini.
- ⚠️ 2 vCPU cukup pas-pasan untuk menjalankan Postgres+Auth+Realtime+Storage+Kong+Studio (Supabase self-host) **+** admin-dashboard **+** Coolify sekaligus di satu mesin — CPU lebih mungkin jadi bottleneck duluan dibanding RAM di spek ini. Kalau pilot terasa lambat, opsi pertama adalah upgrade tier KVM berikutnya (KVM 4: 4 vCPU/16GB) via quick scaling Hostinger, bukan menyalahkan hal lain dulu.

---

## 5. Alur Deploy (Coolify + CI/CD)

```
Developer → git push ke branch (mis. main atau deploy/admin-dashboard)
                │
                ▼
        Coolify webhook terpicu otomatis
                │
                ▼
        Coolify build image (Docker, deteksi Next.js otomatis)
                │
                ▼
        Deploy container baru → health check → swap traffic (zero-downtime)
                │
                ▼
        admin.sukashawarma.com langsung update
```

- **Env var** (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_COOKIE_DOMAIN=.sukashawarma.com`, dll) diatur di UI Coolify per-app — lebih aman dari proses manual FileZilla `.env.local` yang dipakai cPanel sekarang, dan bisa diubah tanpa rebuild manual.
- **TLS otomatis** via Traefik + Let's Encrypt bawaan Coolify — tidak perlu setup certbot manual seperti rencana dedicated-server lama.
- **Rollback cepat** — Coolify menyimpan riwayat deployment, tinggal redeploy versi sebelumnya lewat UI, jauh lebih cepat dari cPanel (SSH + rebuild manual).
- CI/CD (auto build+deploy dari git push) termasuk **sejak pilot ini**, bukan ditunda — ini memang cara kerja bawaan Coolify, tidak perlu kerja ekstra.

---

## 6. DNS / Cutover untuk admin-dashboard

1. **Setup dulu, jangan buru-buru ubah DNS** — VPS+Coolify+admin-dashboard di-deploy lengkap, diakses sementara lewat subdomain uji terpisah (A record baru, tak ganggu yang lama) untuk smoke test penuh.
2. **Turunkan TTL DNS** record `admin.sukashawarma.com` yang sekarang (cPanel) ke 300s, tunggu propagasi — supaya cutover cepat berlaku dan gampang di-rollback.
3. **Smoke test lengkap** di subdomain uji: login SSO dari portal (cPanel) → admin-dashboard (VPS), semua role (owner/admin/mitra/admin_finance/admin_hr), fitur utama (sales dashboard, expenses, waste, profit, printer settings), console/network bersih, desktop & HP.
4. **Cutover:** ubah A record `admin.sukashawarma.com` dari IP cPanel → IP VPS. cPanel tetap standby (server lama tidak dimatikan) untuk rollback instan.
5. **Pantau 24-48 jam pertama** — error log Coolify, konfirmasi fungsi kritis dari user riil (owner/SPV/mitra).
6. Setelah stabil (minimal 1-2 minggu tanpa insiden), baru matikan/uninstall admin-dashboard dari cPanel.

---

## 7. Estimasi Biaya

### Biaya Awal (one-time)
| Item | Estimasi |
|---|---|
| Setup VPS + Coolify + Supabase self-host | Rp0 — murni waktu implementasi, tidak ada biaya provider tambahan |
| Domain/DNS | Rp0 (domain sudah ada) |

### Biaya Bulanan (recurring, tambahan di atas yang sudah berjalan)
| Item | Estimasi/bln |
|---|---|
| Hostinger VPS KVM 2 (2vCPU/8GB, lokasi Indonesia) | Rp112rb – 160rb (harga promo kontrak 12–24 bulan), naik ke ~Rp240rb saat renewal |
| Cloudflare | Rp0 (free tier) |
| Object storage off-site untuk backup dump Postgres/config Coolify (Backblaze B2/Wasabi) | Rp15rb – 30rb |
| **Total bulanan tambahan** | **~Rp127rb – 190rb/bln (promo) / ~Rp255rb – 270rb/bln (setelah renewal)** |

Supabase Cloud tetap jalan sebagai produksi (biaya lama, tidak berubah oleh pilot ini). cPanel connectindo juga tetap berjalan selama transisi (tidak dihitung sebagai penambahan). Estimasi ini jauh di bawah budget menengah <1jt yang ditentukan, dengan ruang upgrade ke tier KVM 4 (4vCPU/16GB, +~Rp150-250rb/bln) bila KVM 2 terasa ketat.

---

## 8. Rencana Backup

| Apa | Sumber kebenaran? | Strategi backup |
|---|---|---|
| **Supabase Cloud** (produksi sungguhan) | ✅ Ya | Ditangani Supabase Cloud (PITR sesuai plan langganan) — di luar scope VPS ini, tapi retention plan dicek ulang saat implementasi. |
| **Supabase self-host** (kandidat produksi, di VPS) | Tidak — salinan harian dari Cloud | Tidak perlu backup terpisah rumit — kalau corrupt/hilang, re-run cron dump/restore dari Cloud. Cukup pastikan cron logging & alert (Telegram/email) saat gagal berturut-turut. |
| **admin-dashboard di VPS** (kode + config) | Kode di git, config di Coolify | Kode aman di GitHub. Config Coolify (env var, connection settings) di-backup rutin via fitur export Coolify → object storage off-site (bukan disk VPS yang sama). |
| **Seluruh VPS** (fallback tambahan) | Bukan sumber kebenaran mana pun | Hostinger KVM 2 sudah termasuk **weekly backup bawaan** (snapshot VPS penuh) — lapisan tambahan di luar strategi di atas, berguna untuk pemulihan cepat kalau VPS corrupt, tapi **tetap dilengkapi backup off-site independen** untuk config Coolify (poin di bawah), karena snapshot bawaan provider tidak menggantikan salinan di luar provider itu sendiri. |

**Wajib sebelum go-live pilot:**
1. Backup off-site untuk konfigurasi Coolify (bukan di VPS yang sama, dan bukan cuma weekly snapshot bawaan Hostinger).
2. Alert otomatis kalau cron dump/restore Supabase self-host gagal.
3. Test restore berkala — backup yang tak pernah dicoba restore tidak bisa dipercaya.

**Tidak perlu di pilot ini** (karena Supabase Cloud tetap produksi): backup manual Postgres WAL/RAID/UPS fisik seperti rencana on-premise lama — baru relevan kalau/ketika self-host dipromosikan jadi produksi sungguhan.

---

## 9. Rencana Rollback

| Skenario | Rollback |
|---|---|
| admin-dashboard di VPS bermasalah setelah cutover DNS | Balikin A record `admin.sukashawarma.com` ke IP cPanel (masih standby, belum dihapus) — TTL rendah bikin ini berlaku cepat (~5 menit). |
| Bug spesifik hasil deploy Coolify | Redeploy versi sebelumnya dari riwayat Coolify — rollback dalam hitungan detik, tanpa sentuh DNS. |
| Supabase self-host corrupt/gagal sync | Tidak berdampak ke produksi — bukan sumber kebenaran. Re-run cron dump/restore manual, atau tunggu jadwal berikutnya. |
| VPS mati total (provider down) | Karena admin-dashboard tetap bergantung Supabase **Cloud** (bukan self-host), begitu DNS dibalikin ke cPanel, semua data tetap utuh — tak ada data loss, karena VPS tidak pernah jadi sumber kebenaran data selama pilot ini. |

Karena Supabase Cloud sengaja dijaga sebagai satu-satunya sumber kebenaran produksi selama pilot, **rollback app-level murni masalah routing (DNS/Coolify), tidak pernah menyentuh data** — ini alasan utama urutan "app dulu, DB baru kandidat terpisah" jauh lebih aman untuk pilot pertama dibanding menggabungkan keduanya sekaligus.

---

## 10. Testing & Validasi

**Sebelum cutover (di subdomain uji):**
- [ ] Build & deploy admin-dashboard sukses di Coolify
- [ ] Login SSO lintas server (portal cPanel → admin-dashboard VPS) jalan
- [ ] Semua role (owner/admin/mitra/admin_finance/admin_hr) akses sesuai scope
- [ ] Fitur inti: sales dashboard, expenses, waste, profit, printer settings — tak ada error console/network
- [ ] Performa dibanding cPanel (load time, TTFB) dicatat sebagai bukti hasil pilot

**Setelah cutover:**
- [ ] Monitor 24-48 jam pertama (error log Coolify)
- [ ] Konfirmasi ke user riil (owner/SPV) tak ada komplain fungsional

**Untuk Supabase self-host (jalur paralel, independen):**
- [ ] Cron dump/restore Postgres jalan tanpa error, data termuat lengkap
- [ ] Storage sync (rclone/s3 sync) jalan, file bisa diakses dari self-host
- [ ] RLS & RPC berperilaku identik dengan Cloud saat dites dengan akun uji
- [ ] Alert cron gagal terkirim saat sengaja disimulasikan gagal

---

## 11. Di Luar Scope (Next steps setelah pilot ini)

- **Migrasi app lain** (stok, distribusi, absensi, dst.) ke VPS — menyusul setelah pilot admin-dashboard terbukti stabil, pola yang sama diulang per-app.
- **Keputusan promosi Supabase self-host jadi produksi sungguhan** — milestone terpisah, butuh proses migrasi data yang jauh lebih hati-hati (bukan cron dump/restore harian) plus rencana downtime/cutover formal.
- **pos-kasir → native Android** — di luar scope *hosting web* migrasi ini (tidak dipindah ke VPS). Namun tetap konsumen Supabase yang sama seperti app lain — otomatis tercakup di jalur sinkronisasi DB (cron dump/restore Postgres+Storage menyalin **seluruh** database, bukan per-app). Implikasi: **keputusan promosi Supabase self-host jadi produksi sungguhan nanti wajib mempertimbangkan pos-kasir (apa pun bentuknya saat itu — web atau native) sebagai salah satu konsumen**, sama seperti stok/absensi/distribusi/finance — bukan keputusan yang bisa diambil sepihak hanya berdasar hasil pilot admin-dashboard ini.
- CI/CD lanjutan (staging environment otomatis per-PR, dst.) — bisa dikembangkan setelah pola dasar Coolify terbukti jalan.

---

**Last updated:** 2026-07-30
**Owner:** Dev Suka Shawarma
