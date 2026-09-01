# Verifikasi Ujung-ke-Ujung — Retail Gateway Tahap 1a

**Tujuan:** membuktikan tujuh mata rantai tersambung sebelum satu baris kode Android ditulis.

```
login → katalog → validasi → tagihan Xendit → webhook → pesanan di kasir → stok terpotong
```

**Aturan pakai:** kerjakan fase berurutan. Setiap langkah punya hasil yang diharapkan. **Kalau hasilnya berbeda, berhenti di situ** — jangan lanjut ke fase berikutnya, karena kegagalan di hulu akan menyamar jadi kegagalan lain di hilir.

**Waktu:** Fase 1-4 sekitar satu jam, **wajib sebelum jam 12:00** saat outlet tutup. Fase 5-6 setelah outlet buka.

---

## Fase 0 — Sebelum menyentuh apa pun

**0.1 Siapkan nilai yang akan dipakai berulang**

```bash
export SB_URL="https://<project>.supabase.co"
export SB_KEY="<SERVICE_ROLE_KEY>"
export GW="https://<domain-gateway>"
export CRON_SECRET="<nilai yang akan di-set di Coolify>"
```

**0.2 Catat keadaan awal — ini yang dibandingkan nanti**

```bash
supabase db query "SELECT COUNT(*) AS pesanan_app FROM orders WHERE source = 'app';" --linked
```
Diharapkan: `0`. Kalau bukan nol, sudah ada percobaan sebelumnya — catat angkanya sebagai basis.

**0.3 Pastikan Coolify TIDAK auto-deploy dari `main`**

Periksa di panel Coolify, aplikasi `retail-gateway`: apakah "Automatic Deployment" menyala untuk branch `main`?

- **Menyala** → matikan dulu, atau jangan push `main` sampai Fase 1-2 selesai. Gateway yang hidup sebelum skema `retail` ada akan gagal di setiap permintaan.
- **Mati** → aman, lanjut.

---

## Fase 1 — Terapkan migration

**Jendela wajib: sebelum jam 12:00, outlet tutup.** `CREATE INDEX` pada `public.orders` mengunci penulisan selama pembangunan indeks; tabel itu memuat seluruh riwayat transaksi 19 outlet.

**1.1 Periksa file akan ter-parse sebelum menyentuh produksi**

```bash
cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT"
grep -c "IF NOT EXISTS" supabase/migrations/20300119000000_retail_app_tahap1.sql
```
Diharapkan: `≥ 8` — seluruh pernyataan idempoten, aman dijalankan ulang.

**1.2 Terapkan**

```bash
supabase db push
```

Kalau terhalang migration remote-only milik developer lain: **jangan** jalankan `migration repair` sepihak. Buka Supabase SQL Editor, tempel isi file `20300119000000_retail_app_tahap1.sql`, jalankan, lalu tandai applied hanya untuk timestamp itu.

**1.3 Verifikasi objeknya benar-benar ada — jangan percaya `migration list`**

```bash
supabase db query "SELECT table_name FROM information_schema.tables WHERE table_schema='retail' ORDER BY 1;" --linked
```
Diharapkan: dua baris — `customers`, `order_drafts`

```bash
supabase db query "SELECT column_name FROM information_schema.columns WHERE table_name='menu_items' AND column_name IN ('tampil_di_app','foto_app','deskripsi_app') ORDER BY 1;" --linked
```
Diharapkan: tiga baris

```bash
supabase db query "SELECT column_name FROM information_schema.columns WHERE table_name='outlets' AND column_name='app_enabled';" --linked
```
Diharapkan: satu baris

```bash
supabase db query "SELECT column_name FROM information_schema.columns WHERE table_name='orders' AND column_name='pickup_code';" --linked
```
Diharapkan: satu baris

**1.4 Verifikasi hak akses — ini yang paling sering terlewat**

```bash
supabase db query "SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_schema='retail' AND grantee='service_role' ORDER BY 1,2;" --linked
```
Diharapkan: beberapa baris untuk `service_role` (`SELECT`, `INSERT`, `UPDATE`, `DELETE`).
**Kalau kosong: berhenti.** Blok `GRANT` tidak jalan, dan seluruh gateway akan mati.

**1.5 Pastikan publik TIDAK dapat akses**

```bash
supabase db query "SELECT COUNT(*) AS bocor FROM information_schema.role_table_grants WHERE table_schema='retail' AND grantee IN ('anon','authenticated');" --linked
```
Diharapkan: `0`. Kalau bukan nol, tabel pelanggan terbuka ke publik — **berhenti dan perbaiki.**

---

## Fase 2 — Expose skema ke PostgREST

**2.1 Tambahkan di panel**

Supabase Dashboard → **Settings → API → Exposed schemas** → tambahkan `retail` di samping `public` dan `graphql_public` → Save.

**2.2 Verifikasi benar-benar terlayani**

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "apikey: $SB_KEY" -H "Authorization: Bearer $SB_KEY" \
  -H "Accept-Profile: retail" \
  "$SB_URL/rest/v1/customers?limit=1"
```
Diharapkan: `200`

| Hasil | Artinya |
|---|---|
| `200` | Lanjut |
| `404` | Skema belum ter-expose — ulangi 2.1, tunggu ±30 detik, coba lagi |
| `406` | Skema ter-expose tapi `Accept-Profile` ditolak — periksa ejaan `retail` |
| `401` | Kunci salah — pastikan `SB_KEY` adalah service_role, bukan anon |

**2.3 Pastikan anon TIDAK bisa membacanya**

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>" \
  -H "Accept-Profile: retail" \
  "$SB_URL/rest/v1/customers?limit=1"
```
Diharapkan: `401` atau `403` — **bukan** `200`. Kalau `200`, data pelanggan terbuka ke publik.

---

## Fase 3 — Deploy gateway

**3.1 Set delapan env var di panel Coolify**

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SESSION_SECRET              (acak, minimal 32 karakter)
GOOGLE_ANDROID_CLIENT_ID
XENDIT_SECRET_KEY
XENDIT_WEBHOOK_TOKEN
CRON_SECRET
```

Variabel yang tidak dideklarasikan di panel **tidak dikirim sebagai build-arg**, dan akan `undefined` di runtime tanpa pesan apa pun. Periksa kedelapannya ada sebelum deploy.

**3.2 Deploy, lalu cek denyut**

```bash
curl -s "$GW/api/health"
```
Diharapkan: `{"status":"ok","service":"retail-gateway"}`

**3.3 Buktikan secret server-only benar-benar sampai ke runtime**

Ini yang menangkap insiden Docker multi-stage. Endpoint outlet memakai service role:

```bash
curl -s -o /dev/null -w "%{http_code}\n" "$GW/api/v1/outlets"
```

| Hasil | Artinya |
|---|---|
| `200` | Service role dan skema retail sampai ke runtime — bagus |
| `502` | Query gagal — periksa log kontainer; kemungkinan besar `SUPABASE_SERVICE_ROLE_KEY` kosong |
| `500` | Gateway melempar sebelum query — env var hilang sama sekali |

**3.4 Cek gerbang cron menolak tanpa rahasia**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$GW/api/cron/expire-drafts"
```
Diharapkan: `401`

```bash
curl -s -X POST "$GW/api/cron/expire-drafts" -H "authorization: Bearer $CRON_SECRET"
```
Diharapkan: `{"dihanguskan":0}`

**3.5 Cek webhook menolak tanpa token**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$GW/api/webhooks/xendit" \
  -H "content-type: application/json" -d '{"external_id":"uji","status":"PAID"}'
```
Diharapkan: `401`

**3.6 Jadwalkan cron**

Buat scheduled task di Coolify, tiap 5 menit:

```bash
curl -s -X POST https://<domain-gateway>/api/cron/expire-drafts -H "authorization: Bearer <CRON_SECRET>"
```

**3.7 Daftarkan webhook di dashboard Xendit**

URL: `https://<domain-gateway>/api/webhooks/xendit` · Callback token: nilai `XENDIT_WEBHOOK_TOKEN`

---

## Fase 4 — Nyalakan outlet pilot

**4.1 Pilih dan nyalakan**

```bash
supabase db query "UPDATE outlets SET app_enabled = true WHERE name = '<Nama Outlet Pilot>' RETURNING id, name;" --linked
```
Diharapkan: satu baris. **Catat `id`-nya** — dipakai di seluruh fase berikutnya sebagai `OUTLET_ID`.

**4.2 Terbitkan menu ke aplikasi — pilih sedikit dulu, jangan semua**

Varian dan paket **belum didukung** (`package_choices` selalu null). Terbitkan hanya item sederhana:

```bash
supabase db query "UPDATE menu_items SET tampil_di_app = true WHERE outlet_id = '<OUTLET_ID>' AND is_available = true AND name IN ('<Menu 1>','<Menu 2>','<Menu 3>') RETURNING id, name, price;" --linked
```

**4.3 Pastikan tidak ada item ber-`is_available` NULL yang ikut**

Gateway gagal-tertutup: item ber-`is_available` NULL akan hilang dari aplikasi.

```bash
supabase db query "SELECT name, is_available FROM menu_items WHERE outlet_id = '<OUTLET_ID>' AND tampil_di_app = true AND is_available IS DISTINCT FROM true;" --linked
```
Diharapkan: kosong. Kalau ada, set `is_available = true` untuk item itu.

**4.4 Verifikasi katalog terlihat dari luar**

```bash
curl -s "$GW/api/v1/catalog?outlet_id=<OUTLET_ID>" | head -c 400
```
Diharapkan: `{"items":[...]}` berisi menu yang baru diterbitkan, dengan `price` berupa angka (bukan `null`).

```bash
curl -s "$GW/api/v1/outlets" | head -c 300
```
Diharapkan: outlet pilot muncul dengan `is_active: true`.

**4.5 Catat stok bahan baku SEBELUM transaksi — ini pembanding untuk uji terpenting**

Kolom penghubung resep ke menu adalah **`resep.menu_item_ref` bertipe TEXT** (bukan `menu_item_id` uuid), dan resep punya `scope` `global` atau `outlet`. Sudah diverifikasi ke `supabase/migrations/20260609000700_create_resep.sql`.

```bash
supabase db query "
SELECT bb.id, bb.nama, sb.saldo, ri.qty_per_porsi
FROM resep r
JOIN resep_item ri ON ri.resep_id = r.id
JOIN bahan_baku bb ON bb.id = ri.bahan_baku_id
JOIN stok_balance sb ON sb.bahan_baku_id = bb.id AND sb.outlet_id = '<OUTLET_ID>'
WHERE r.menu_item_ref = '<MENU_ID>'
  AND r.is_active = true
  AND (r.scope = 'global' OR r.outlet_id = '<OUTLET_ID>')
ORDER BY bb.nama;" --linked
```

**Salin hasilnya, termasuk `qty_per_porsi`** — itu yang menentukan berapa saldo seharusnya berkurang.

Kalau kosong, menu itu tidak punya resep aktif. **Pilih menu lain yang punya**, karena uji pemotongan stok adalah inti verifikasi ini. Untuk melihat menu mana yang punya resep:

```bash
supabase db query "
SELECT r.menu_item_ref, r.nama, r.scope, COUNT(ri.id) AS jumlah_bahan
FROM resep r JOIN resep_item ri ON ri.resep_id = r.id
WHERE r.is_active = true
GROUP BY 1,2,3 ORDER BY 2 LIMIT 20;" --linked
```

**4.6 Pastikan outlet pilot ikut pemotongan BOM**

```bash
supabase db query "SELECT name, is_bom_enabled FROM outlets WHERE id = '<OUTLET_ID>';" --linked
```
Diharapkan: `is_bom_enabled` bernilai `true`. Kalau `false`, stok tidak akan terpotong dan langkah 6.5 pasti gagal — nyalakan dulu, atau pilih outlet pilot lain.

---

## Fase 5 — Transaksi sungguhan

Pakai **mode uji Xendit lebih dulu**. Setelah lolos, ulangi dengan nilai kecil sungguhan.

**5.1 Dapatkan token sesi**

Belum ada aplikasi Android, jadi ambil ID token Google secara manual lewat OAuth Playground atau `gcloud`, lalu:

```bash
curl -s -X POST "$GW/api/v1/auth/google" \
  -H "content-type: application/json" \
  -d '{"id_token":"<GOOGLE_ID_TOKEN>"}'
```
Diharapkan: `{"token":"...","expires_at":"...","customer":{...}}`

| Hasil | Artinya |
|---|---|
| `401 Login Google gagal` | ID token salah audience — pastikan client ID-nya yang terdaftar di provider Google Supabase |
| `500 Gagal menyiapkan profil` | Skema `retail` tidak terjangkau — kembali ke Fase 2 |

```bash
export TOKEN="<token dari balasan>"
```

**5.2 Validasi keranjang**

```bash
curl -s -X POST "$GW/api/v1/checkout/validate" \
  -H "authorization: Bearer $TOKEN" -H "content-type: application/json" \
  -d '{"outlet_id":"<OUTLET_ID>","items":[{"menu_item_id":"<MENU_ID>","name":"<Nama Menu>","unit_price":<HARGA>,"quantity":1}]}'
```
Diharapkan: `{"ok":true,"subtotal":<HARGA>,"discountAmount":0,"total":<HARGA>}`

Kalau `{"ok":false,"alasan":"keranjang_berubah"}` — `unit_price` yang Anda kirim tidak sama dengan harga di katalog. Ambil harga persisnya dari 4.4.

**5.3 Buat pesanan**

```bash
export COID=$(uuidgen | tr 'A-Z' 'a-z')
curl -s -X POST "$GW/api/v1/orders" \
  -H "authorization: Bearer $TOKEN" -H "content-type: application/json" \
  -d "{\"client_order_id\":\"$COID\",\"outlet_id\":\"<OUTLET_ID>\",\"items\":[{\"menu_item_id\":\"<MENU_ID>\",\"name\":\"<Nama Menu>\",\"unit_price\":<HARGA>,\"quantity\":1}]}"
```
Diharapkan: `{"order_id":"...","pickup_code":"NNNN","payment_url":"https://checkout.xendit.co/...","total_amount":<HARGA>,"expires_at":"..."}`

**Catat `pickup_code` dan `order_id`.**

**5.4 Uji idempotensi — kirim permintaan yang SAMA persis lagi**

Ulangi perintah 5.3 tanpa mengubah apa pun.

Diharapkan: balasan yang sama, **dengan `"duplicate":true`**, dan `payment_url` yang **sama persis**.

> Kalau `payment_url`-nya berbeda, artinya tagihan kedua dibuat — idempotensi bocor. **Berhenti dan laporkan.**

**5.5 Verifikasi belum ada apa pun di kasir**

```bash
supabase db query "SELECT COUNT(*) FROM orders WHERE client_order_id = '$COID';" --linked
```
Diharapkan: `0`. Pesanan **tidak boleh** masuk kasir sebelum dibayar.

**5.6 Bayar**

Buka `payment_url` di browser, selesaikan pembayaran.

---

## Fase 6 — Verifikasi tujuh mata rantai

**6.1 Draft berubah jadi dibayar**

```bash
curl -s "$GW/api/v1/orders/<ORDER_ID>" -H "authorization: Bearer $TOKEN"
```
Diharapkan: `"status":"dibayar"` dan `pos_order_number` terisi angka.

Kalau masih `menunggu_bayar` setelah 1 menit: webhook tidak sampai. Periksa log pengiriman di dashboard Xendit dan log kontainer gateway.

**6.2 Pesanan ada di kasir dengan bentuk yang benar**

```bash
supabase db query "
SELECT order_number, source, channel, sales_source, status, pickup_code,
       total_amount, external_order_id, client_order_id
FROM orders WHERE client_order_id = '$COID';" --linked
```

| Kolom | Harus bernilai |
|---|---|
| `order_number` | angka (ditetapkan trigger, bukan kita) |
| `source`, `channel`, `sales_source` | `app` |
| `status` | `preparing` |
| `pickup_code` | sama dengan yang diterima aplikasi di 5.3 |
| `external_order_id` | **`NULL`** |

> **`external_order_id` WAJIB `NULL`.** Kalau terisi, trigger BOM akan melewati pesanan ini dan stok tidak akan terpotong. Ini perbaikan Critical dari review akhir — langkah ini yang membuktikannya benar-benar mendarat.

**6.3 Item pesanan berbentuk sama dengan pesanan kasir**

```bash
supabase db query "
SELECT oi.menu_item_name, oi.quantity, oi.unit_price, oi.subtotal, oi.package_choices
FROM order_items oi JOIN orders o ON o.id = oi.order_id
WHERE o.client_order_id = '$COID';" --linked
```
Diharapkan: nama menu apa adanya (dengan `|NOTE|` hanya bila ada catatan), `subtotal = unit_price × quantity`.

**6.4 Pesanan muncul di layar kasir**

Buka POS kasir di outlet pilot. Pesanan harus terlihat dengan nomor dari 6.2. Minta kasir mencarinya lewat kode ambil.

**6.5 UJI TERPENTING — stok bahan baku terpotong**

Jalankan ulang query dari 4.5 dan bandingkan dengan yang Anda salin.

Diharapkan: `saldo` **berkurang** sesuai resep.

> Kalau saldo **tidak berubah**, itu berarti trigger BOM melewati pesanan ini. Periksa tiga hal berurutan: apakah `external_order_id` benar-benar `NULL` (6.2), apakah `outlets.is_bom_enabled` bernilai true (4.6), dan apakah resepnya aktif (4.5). Sebelum ini hijau, **jangan buka pilot** — sistem akan menjual makanan tanpa mencatat bahannya.

**6.6 Webhook kembar tidak membuat pesanan kedua**

Di dashboard Xendit, kirim ulang webhook yang sama secara manual.

```bash
supabase db query "SELECT COUNT(*) FROM orders WHERE client_order_id = '$COID';" --linked
```
Diharapkan: tetap `1`.

**6.7 Draft yang tidak dibayar benar-benar hangus**

Buat satu pesanan lagi (5.3) tapi **jangan dibayar**. Tunggu 15 menit, biarkan cron jalan, lalu:

```bash
curl -s "$GW/api/v1/orders/<ORDER_ID_BARU>" -H "authorization: Bearer $TOKEN"
```
Diharapkan: `"status":"kadaluarsa"`

Lalu ulangi 5.3 dengan `client_order_id` yang **sama**:

Diharapkan: HTTP `409` dengan `{"error":"pesanan_kadaluarsa",...}` — bukan tautan bayar mati. Ini membuktikan kontrak yang akan diikuti aplikasi Android.

---

## Ringkasan hasil

| # | Mata rantai | Langkah | Lulus |
|---|---|---|---|
| 1 | Login Google → token sesi | 5.1 | ☐ |
| 2 | Katalog tersaji dari cache | 4.4 | ☐ |
| 3 | Validasi pra-bayar menolak yang salah | 5.2 | ☐ |
| 4 | Tagihan Xendit dibuat sekali saja | 5.3, 5.4 | ☐ |
| 5 | Webhook mengubah draft jadi dibayar | 6.1 | ☐ |
| 6 | Pesanan muncul di kasir, bentuk benar | 6.2, 6.3, 6.4 | ☐ |
| 7 | **Stok bahan baku terpotong** | 6.5 | ☐ |
| + | Webhook kembar tidak menggandakan | 6.6 | ☐ |
| + | Draft kedaluwarsa menolak dengan benar | 6.7 | ☐ |

**Sembilan hijau = gateway terbukti, Tahap 1b boleh dimulai.**

---

## Kalau harus mundur

Migration bersifat aditif, jadi tidak ada yang perlu di-rollback untuk memulihkan operasi POS. Untuk menghentikan pilot tanpa menyentuh skema:

```bash
supabase db query "UPDATE outlets SET app_enabled = false WHERE id = '<OUTLET_ID>';" --linked
```

Sejak saat itu gateway menolak seluruh pesanan baru untuk outlet itu, dan POS berjalan seperti sebelum app ada. Pesanan yang sudah dibayar tetap diproses.

Jangan `DROP SCHEMA retail` — draft dan profil pelanggan ada di sana, termasuk pesanan yang mungkin belum selesai.
