# POS Kasir — Fitur Pencatatan Pesanan Walk-in (Kasir Langsung)

**Tanggal:** 2026-07-01
**App:** `apps/pos-kasir`
**Status:** Design approved (interview-driven), implementasi Pendekatan A.

## Masalah

POS kasir belum punya jalur **penjualan langsung di tempat** (pelanggan datang ke
kasir). Yang ada hanya:
- Kiosk self-service (`/`, `/api/checkout`) — pelanggan pesan sendiri.
- Input Manual (`/kasir/order-manual`, `/api/orders/manual`) — **wajib pilih channel
  eksternal** (GoFood/GrabFood/ShopeeFood/TikTok Go), untuk mencatat order online.

Kasir tidak bisa mencatat pesanan walk-in seperti mesin kasir umumnya (pilih menu →
bayar tunai dengan kembalian / QRIS → cetak struk).

## Keputusan (hasil interview)

| Aspek | Keputusan |
|---|---|
| Skenario | Jalur BARU kasir walk-in (pelanggan datang langsung) |
| Pembayaran | Tunai (hitung kembalian) + QRIS |
| QRIS | Mekanisme sama seperti kiosk self-service: tampil QR + konfirmasi manual (tanpa payment gateway asli) |
| Status setelah bayar | `preparing` (masuk papan "Sedang Diproses" / dapur) |
| Struk | Cetak thermal via `window.print()` (layout 58/80mm) |
| Penempatan | Digabung ke halaman Input Manual sebagai 2 tab: "Kasir Langsung" & "Channel Online" |
| Promo | Ikut promo global & per-item; harga otoritatif dihitung ulang di server |
| Sumber | `source='pos'`, `sales_source='pos'`, `channel=null` |

## Arsitektur (Pendekatan A)

### 1. Data — migrasi aditif
`orders` mendapat 2 kolom nullable untuk jejak kas walk-in:
- `amount_received DECIMAL(10,2)` — uang tunai diterima (null untuk QRIS/non-walk-in).
- `change_amount DECIMAL(10,2)` — kembalian (null jika bukan tunai).

Aditif & nullable → tidak mempengaruhi kiosk/manual/online yang sudah ada.

### 2. API — `POST /api/orders/walk-in`
Kembaran `/api/orders/manual` tapi untuk penjualan di tempat:
- Autentikasi kasir + resolusi `outlet_id` (sama seperti manual).
- Harga & promo **otoritatif dari DB** (logika identik manual/checkout: item promo &
  global promo, abaikan harga dari client).
- Validasi: `payment_method ∈ {cash, qris}`, item 1–10, menu tersedia.
- Untuk `cash`: validasi `amount_received >= total`, hitung `change_amount`.
- Insert order: `status='preparing'`, `source='pos'`, `sales_source='pos'`,
  `channel=null`, simpan `amount_received`/`change_amount`.
- Response: `order_number`, `total_amount`, `change_amount`, plus rincian item untuk struk.

### 3. UI — `/kasir/order-manual` jadi 2 tab
Tab switch di atas halaman:
- **Kasir Langsung** (default baru): grid menu (dipakai bersama, tanpa selector
  channel) + panel pembayaran walk-in.
- **Channel Online**: flow existing (channel selector + `/api/orders/manual`) tak
  berubah.

Menu grid + keranjang di-refactor jadi komponen bersama sehingga tidak duplikat.

**Panel pembayaran walk-in:**
- Ringkasan item + total (setelah promo).
- Pilih metode: **Tunai** / **QRIS**.
- Tunai: input "Uang Diterima" + tombol cepat (Uang Pas, 50rb, 100rb, dst) →
  tampilkan **Kembalian** realtime. Submit disabled bila uang < total.
- QRIS: buka **modal QR** (reuse tampilan `/payment/qris`: QR statis + tombol
  konfirmasi "Pembayaran Diterima") → setelah konfirmasi, submit order.
- Nama pelanggan opsional.

### 4. Struk thermal — cetak via iframe khusus
`window.print()` global memakai `@page A4 landscape` (untuk laporan), bentrok dengan
struk. Solusi: util `printReceipt()` membuat **hidden iframe** ber-`@page size: 80mm
auto; margin: 0`, meng-inject markup struk (monospace, outlet, tanggal, nomor
antrian, item×qty, subtotal, diskon, total, tunai/kembalian atau QRIS), memanggil
`contentWindow.print()`, lalu membuang iframe. Terisolasi dari CSS print aplikasi.

Alur sukses walk-in: order dibuat → modal sukses (nomor antrian + kembalian) dengan
tombol **"Cetak Struk"** (auto-print sekali) & **"Transaksi Baru"**.

## Komponen & berkas
- `supabase/migrations/<ts>_orders_walkin_payment.sql` (+ `migration-walkin-payment.sql` mirror manual pattern)
- `app/api/orders/walk-in/route.ts` (baru)
- `app/kasir/order-manual/page.tsx` (tab + mode)
- `components/kasir/MenuGrid.tsx` (ekstrak dari page, dipakai 2 mode) — opsional bila refactor terlalu berisiko, boleh tetap inline dengan flag.
- `components/kasir/WalkInPayment.tsx` (panel tunai/QRIS + kembalian)
- `components/kasir/ReceiptModal.tsx` + `lib/printReceipt.ts`

## Testing
- Unit: hitung kembalian, validasi uang < total, agregasi total+promo (samakan dgn manual).
- Manual smoke: pilih menu → tunai (kembalian benar) → order muncul di "Sedang
  Diproses", struk tercetak; ulangi QRIS.
- `yarn type-check` bersih.

## Non-goals (YAGNI)
- Integrasi payment gateway asli (Midtrans/Xendit).
- Cetak Bluetooth ESC/POS native.
- Diskon manual per-transaksi (hanya promo terkonfigurasi).
- Split payment / multi-tender.
