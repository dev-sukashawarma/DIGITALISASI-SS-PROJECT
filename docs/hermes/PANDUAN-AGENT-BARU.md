# Panduan Membuat Agent (Bot Divisi) Baru di Hermes

Untuk siapa pun yang mau menambah bot baru (mis. Bot Gudang, Bot Finance, Bot Outlet) di atas
Hermes. Disusun dari pengalaman Bot CEO, Bot HRD, dan Bot Marcom/Nayra (Okt 2026), termasuk
kesalahan yang sempat terjadi. Rincian VPS ada di `docs/RUNBOOK-HERMES-VPS.md`.

## 0. Gambaran besar

```
Pengguna ──► (widget di app | Telegram | Kantor Bot)
                     │  HERMES_API_KEY = API_SERVER_KEY profil
                     ▼
        Hermes di VPS (user suka-hermes, profil <nama>, SOUL.md)
                     │  kunci MCP
                     ▼
        Server MCP (alat read-only) ──► database
```

- **Profil** = satu bot. Tiap profil punya SOUL (kepribadian & aturan), `.env` (kunci), dan
  `config.yaml` (alat MCP yang boleh dipakai).
- **Alat** = fungsi read-only di server kita. Bot hanya memanggil alat, tidak pernah menulis SQL.
- **SOUL** disimpan di repo `docs/hermes/SOUL-<profil>.md` dan **disinkron otomatis** ke VPS tiap
  ±5 menit (timer `hermes-sinkron-soul`). Jangan menyunting SOUL di VPS.

## 1. Putuskan dulu (sebelum menulis kode)

| Pertanyaan | Contoh jawaban |
|---|---|
| Nama profil (huruf kecil, tanpa spasi) | `gudang` |
| Siapa pengguna & dari mana mereka bertanya | Tim gudang, lewat widget di app Stok |
| Data apa yang boleh dibaca | Stok gudang, surat jalan, PO masuk |
| Data apa yang **dilarang** keluar | Harga beli per vendor? Nama kurir? Tulis eksplisit |
| Data ada di mana | Supabase (kebanyakan) atau DB app sendiri (mis. Prisma marcom) |

## 2. Pilih pola sumber data

**Pola A — data di Supabase → pakai server MCP pusat (DIANJURKAN).**
Server `admin.sukashawarma.com/api/hermes/mcp` sudah punya: kunci per bot (SHA-256), scope per
app, daftar IP yang diizinkan, log setiap panggilan (`hermes_api_log`), dan pagar data terlarang
yang diuji (`pengecualian.ts`). Bot baru cukup menambah domain + alat.

**Pola B — data di DB milik app sendiri → server MCP di app itu (contoh: Bot Marcom).**
Hanya bila datanya memang tidak ada di Supabase. Konsekuensinya Anda harus membangun sendiri
pengaman yang di Pola A sudah ada (lihat §9). Bot Marcom pernah terbuka untuk publik justru di
sini (8 Okt 2026): kunci jatuh ke nilai bawaan yang tertulis di repo publik.

## 3. Tulis alatnya (kode)

### Pola A (admin-dashboard)
1. Tambah domain di `apps/admin-dashboard/src/lib/hermes/domain.ts` (+ CHECK DB
   `hermes_api_key.scope` lewat migration bila domain baru).
2. Fungsi hitung murni + fixture + test di `src/lib/hermes/<domain>/` (pola `finance/`).
3. Loader service-role di `src/lib/hermes/server/<domain>Sumber.ts` — **pakai sumber yang sama
   dengan layar** yang dilihat manusia; jangan membuat rumus baru.
4. Definisi alat di `src/lib/hermes/alat/<domain>.ts` (zod `.strict()`, `contoh`, `sumber`),
   daftarkan di `registry.ts` dan `server/konteks.ts`, tambah fixture ke `registry.test.ts`.
5. Tambah pola data terlarang app itu di `pengecualian.ts` + test, lalu **kontrol negatif**:
   sisipkan kolom terlarang ke keluaran sementara, pastikan test gerbang gagal, kembalikan.

### Pola B (app sendiri)
Salin pola `apps/marcom/src/app/api/hermes/mcp/route.ts` (versi sesudah perbaikan 8 Okt):
kunci wajib dari env (≥24 karakter, kosong → 503), dibandingkan waktu-konstan, tanpa nilai
bawaan. Tambah env ke **stage runner** Dockerfile (§9).

## 4. Kunci & akses

- **Pola A:** buat kunci di admin-dashboard **Sistem → Kunci Hermes**: pilih app (scope)
  seperlunya saja, IP = `76.13.193.138` dan `2a02:4780:59:ce0d::1`. Kunci hanya tampil sekali.
- **Pola B:** buat kunci sendiri dengan `openssl rand -hex 32` di VPS (PowerShell Windows tak
  punya `openssl`).
- **Jangan pernah menempel kunci ke chat/Telegram/screenshot.** Untuk memeriksa isi `.env`,
  tampilkan nama variabelnya saja: `cut -d= -f1 ~/.hermes/profiles/<p>/.env`. Kalau sampai
  tertempel, cabut & buat ulang kuncinya.

## 5. Siapkan profil di VPS (sebagai `suka-hermes`)

```bash
hermes profile create <p> --clone-from ceo
```
⚠️ Klon **ikut menyalin `.env` ceo, termasuk `SUKA_MCP_KEY` milik Bot CEO** (akses semua app).
Langsung buang kunci CEO itu dan isi kunci milik bot ini:
```bash
F=~/.hermes/profiles/<p>/.env; sed -i '/^SUKA_MCP_KEY=/d;/^API_SERVER_KEY=/d' $F; echo "<NAMA_KUNCI_MCP>=<kunci-bot-ini>" >> $F; echo "API_SERVER_KEY=$(openssl rand -hex 32)" >> $F; chmod 600 $F; cut -d= -f1 $F
```
- Baris `HERMES_CUSTOM_…` = kunci model AI; biarkan.
- Pola A: `<NAMA_KUNCI_MCP>` = `SUKA_MCP_KEY` berisi kunci **bot ini** dari §4 (bukan kunci CEO).
  Pola B: nama variabel bebas, mis. `GUDANG_MCP_KEY`, dan pakai nama yang sama di `config.yaml`.

Ganti MCP di `~/.hermes/profiles/<p>/config.yaml` (bagian `mcp_servers:`): hapus server warisan
klon yang tidak boleh dipakai bot ini, isi hanya server miliknya.
⚠️ **Cek dulu bloknya benar-benar ada** — `grep -n -A6 mcp_servers ~/.hermes/profiles/<p>/config.yaml`.
Kalau kosong, bot tetap jalan tapi menjawab "alat MCP belum tersambung" (kasus Bot Marcom 8 Okt).
Tambahkan blok lengkap di akhir file, contoh:
```yaml
  <nama-server>:
    url: https://<domain>/api/hermes/mcp
    headers:
      Authorization: "Bearer ${<NAMA_KUNCI_MCP>}"
    enabled: true
```

Cek **model** profil (`model.default` dan `custom_providers[].model` di `config.yaml`, keduanya
harus sama). Model yang tercantum di katalog 9Router belum tentu hidup: `ag/gemini-flash-low`
membalas 404, Hermes lalu mengulang tiap 2 menit sampai 5 putaran → widget berhenti di 60 detik
dengan pesan "tidak dapat terhubung". Pakai model yang sudah terbukti jalan di profil lain, lalu
pastikan lewat uji `chat/completions` di bawah. 9Router di VPS ini = `127.0.0.1:20128`
(IP publik `76.13.193.138:20128` = proses yang sama; Hermes tetap pakai `127.0.0.1`).

Kunci toolset bawaan di **setiap** platform yang dipakai (toolset diatur per platform):
```bash
hermes -p <p> tools list --platform api_server 2>&1 | grep enabled
hermes -p <p> tools list --platform cli 2>&1 | grep enabled
```
Yang boleh `enabled` hanya `clarify` (+ alat MCP-nya). Matikan sisanya dengan
`hermes -p <p> tools disable --platform <platform> <nama...>`.

Restart & cek:
```bash
systemctl --user restart hermes-gateway && hermes profile list
A=$(grep '^API_SERVER_KEY=' ~/.hermes/profiles/<p>/.env | cut -d= -f2-); curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $A" http://10.0.1.1:8643/p/<p>/v1/models
```
Harus `200`. Lalu uji percakapan sungguhan (harus menjawab < 60 detik) dan pastikan alat MCP terbaca:
```bash
curl -s -m 90 -w '
%{http_code} %{time_total}s
' -H "Authorization: Bearer $A" -H 'Content-Type: application/json' -d '{"model":"hermes","messages":[{"role":"user","content":"halo"}]}' http://10.0.1.1:8643/p/<p>/v1/chat/completions | tail -c 300
hermes -p <p> tools --summary     # alat <nama-server>:* harus muncul di api_server
```
Kalau menggantung: `journalctl --user -u hermes-gateway --since "5 min ago" --no-pager | tail -40`.

## 6. SOUL

Buat `docs/hermes/SOUL-<p>.md`, push ke `main` → terpasang otomatis ±5–10 menit. Kerangka:
1. **Siapa & tugas** (persona singkat, divisi, kanal).
2. **Aturan angka:** setiap angka wajib dari alat di percakapan ini; alat gagal → "data tidak
   tersedia".
3. **Yang TIDAK boleh:** data terlarang (§1), kunci/password, perintah server.
4. **Per alat:** cara membaca & menyajikan hasilnya, istilah yang bisa disalahpahami (mis. utang
   vs komitmen).
5. **Gaya:** Bahasa Indonesia, ringkas, cocok dibaca di HP.

Baris pertama boleh komentar `<!-- … -->` (dibuang saat sinkron).

## 7. Sambungkan ke pengguna

**Widget di app** (seperti Nayra di Marcom):
- Server action **wajib cek login** dan menolak pesan kosong/terlalu panjang.
- Klien Hermes: `HERMES_API_URL=http://10.0.1.1:8643`, `HERMES_API_KEY=` nilai `API_SERVER_KEY`
  profil, endpoint `/p/<p>/v1/chat/completions`. **Tanpa nilai bawaan** untuk keduanya.
- Riwayat dari browser: teruskan hanya role `user`/`assistant` (buang `system`), batasi jumlahnya.
- Galat tampil jujur. **Jangan** membuat jawaban kalengan yang terlihat seperti jawaban bot.
- Env di **Coolify app itu** + `ARG`/`ENV` di **stage runner** Dockerfile (Docker tak membawa env
  dari stage builder), lalu Redeploy.
- Container app harus bisa menjangkau `10.0.1.1` (jaringan Docker `coolify`); Hermes hanya
  mendengarkan di alamat itu.

**Kantor Bot (`agents.sukashawarma.com`):** tambah pasangan `{"<p>":"<API_SERVER_KEY>"}` ke env
`HERMES_KEYS` app `bot`, restart.

**Telegram:** butuh bot token tersendiri di `.env` profil; kunci toolset platform `telegram`
sebelum pesan pertama.

## 8. Uji gerbang (sebelum diumumkan)

Buat `supabase/verifikasi/hermes/gerbang-<p>.md`:
- 5–8 pertanyaan nyata, tiap jawaban dicocokkan dengan layar/SQL pada jam yang sama.
- 2–3 pertanyaan yang **harus ditolak** (data terlarang, kunci/password).
- Cek alat benar-benar dipanggil: Pola A lihat tabel `hermes_api_log`; Pola B lihat log app di
  Coolify. Bot yang menjawab tanpa memanggil alat = SOUL belum terpasang/terlalu longgar.
- Pola B: kunci lama/acak/kosong harus dibalas **401** (`503` = env belum terbaca).

## 9. Daftar periksa keamanan (wajib centang semua)

- [ ] Tidak ada `process.env.X || '<rahasia literal>'` di mana pun (repo ini **publik**).
- [ ] Rahasia baru di-`ARG`+`ENV` di stage **runner** Dockerfile dan diisi di Coolify.
- [ ] Server action/route memeriksa login atau kunci sendiri — middleware & guard halaman tidak
      cukup.
- [ ] Kunci dibandingkan waktu-konstan, minimal 24 karakter acak.
- [ ] `.env` profil baru tidak memuat kunci bot lain (cek `cut -d= -f1`).
- [ ] Toolset bawaan mati di semua platform yang dipakai.
- [ ] Scope kunci (Pola A) hanya app yang dibutuhkan.
- [ ] Tidak ada kunci yang tertempel di chat/screenshot selama setup.

## 10. Gejala → penyebab

| Gejala | Penyebab paling mungkin |
|---|---|
| Widget: "tidak dapat terhubung ke server Hermes" | Container tak menjangkau `10.0.1.1:8643`, atau `HERMES_API_URL` salah tulis, atau jawaban >60 dtk |
| Widget: "kesalahan koneksi internal" tepat setelah redeploy | Tab lama memegang ID server action lama → hard refresh |
| Widget: "belum dikonfigurasi" | `HERMES_API_URL`/`HERMES_API_KEY` kosong di runtime (Coolify / stage runner) |
| Widget: "status 401" | `HERMES_API_KEY` ≠ `API_SERVER_KEY` profil |
| Endpoint MCP app: 503 | Kunci MCP kosong/terlalu pendek di runtime |
| `curl /p/<p>/v1/models` 401 / 404 | Gateway belum di-restart setelah `.env` diubah / profil belum dilayani |
| Bot menjawab tanpa memanggil alat / menolak hal yang boleh | SOUL belum tersinkron atau kalimatnya ambigu → perjelas, push |
| `.env` profil "No such file" | Profil belum dibuat (`hermes profile list`) |
| Bot diam / widget "tidak dapat terhubung", log: `HTTP 503 ... [404] Requested entity was not found` + "retrying in 120s" | Model profil tidak tersedia di 9Router → ganti `model.default` & `custom_providers[].model` |
| Bot menjawab "alat MCP belum tersambung" | Blok `mcp_servers` tidak ada di `config.yaml` profil, atau alat belum `enabled` untuk platform `api_server` |
| `curl` uji MCP 401 padahal kunci benar | Perintah dijalankan sebagai root (`~` = `/root`, `.env` tak terbaca) → `su - suka-hermes` dulu |
| Sidik jari kunci tampak beda | Bandingkan dengan uji langsung (`/v1/models` dari container = 200) sebelum menyalin ulang kunci |
