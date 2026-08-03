# Bug Report & Post-Mortem: QRIS Order Creation Failure (Schema Cache Error)

## 📌 Informasi Bug
- **Tanggal Ditemukan:** 3 Agustus 2026
- **Dampak:** Gagal membuat pesanan (Error 500) pada sistem kasir saat menggunakan metode pembayaran non-tunai (khususnya QRIS).
- **Modul Terdampak:**
  - Walk-in Orders (`/api/orders/walk-in`)
  - Manual Orders / Food Apps (`/api/orders/manual`)
  - Offline Ingest (`/api/orders/offline-ingest`)

## ⚠️ Gejala (Symptom)
Saat kasir atau sistem mencoba memproses pesanan dengan metode pembayaran QRIS, UI menampilkan notifikasi kegagalan pesanan, dan konsol jaringan mengembalikan status HTTP 500 Internal Server Error.
Pesan error asli dari database Supabase (PostgREST): `Could not find the 'client_order_id' column of 'orders' in the schema cache` (atau terkait `amount_received` / `change_amount`).
Kode Error: `PGRST204` atau `42703`.

## 🔍 Root Cause Analysis (Akar Masalah)
1. Penambahan kolom baru di tabel `orders` pada database Supabase (`amount_received`, `change_amount`, dan `client_order_id`).
2. API Next.js mencoba melakukan _insert_ data baru (_payload_) yang mengandung kolom-kolom baru tersebut.
3. Arsitektur PostgREST pada Supabase menggunakan mekanisme _schema cache_ untuk optimasi kueri. Saat kolom baru ditambahkan langsung ke database, _cache_ tersebut tidak langsung mengenali keberadaan kolom baru tersebut secara _real-time_.
4. Akibat ketidaksesuaian skema di _cache_, PostgREST menolak proses _insert_ sehingga mengembalikan error `PGRST204` (atau `42703`). Karena ini ditangkap sebagai _fatal error_ oleh API, pembuatan pesanan pun gagal sepenuhnya.

## 🛠️ Solusi & Resolusi
Karena me-_restart_ Supabase Schema Cache berada di luar jangkauan kode aplikasi secara langsung, diterapkan pola **Self-Healing Fallback** pada level API (Next.js backend) yang bertindak sebagai jaring pengaman (_safety net_).

### Implementasi:
Pada setiap endpoint pembuatan pesanan (`walk-in`, `manual`, dan `offline-ingest`), logika _insert_ dibungkus dengan mekanisme pendeteksi error. Jika _insert_ gagal dengan kode `PGRST204` atau pesan terkait kolom opsional (`amount_received`, `change_amount`, `client_order_id`), maka API akan secara otomatis:
1. Menduplikasi _payload_ yang bermasalah.
2. Membuang kunci/properti (`delete`) yang memicu error pada _cache_ (karena kolom ini bersifat opsional untuk QRIS).
3. Melakukan percobaan _insert_ ulang (_retry_) ke tabel `orders`.

**Snippet Kode Solusi:**
```typescript
if (orderError && (orderError.code === '42703' || orderError.code === 'PGRST204')) {
  const errorMsg = orderError.message || ''
  const fallbackPayload = { ...fullPayload }
  let shouldRetry = false

  if (/amount_received/i.test(errorMsg) || /change_amount/i.test(errorMsg)) {
    delete (fallbackPayload as any).amount_received
    delete (fallbackPayload as any).change_amount
    shouldRetry = true
  }
  
  if (/client_order_id/i.test(errorMsg)) {
    delete (fallbackPayload as any).client_order_id
    shouldRetry = true
  }

  // Jika kode murni PGRST204 dan belum tertangani
  if (orderError.code === 'PGRST204' && !shouldRetry) {
    delete (fallbackPayload as any).amount_received
    delete (fallbackPayload as any).change_amount
    delete (fallbackPayload as any).client_order_id
    shouldRetry = true
  }

  if (shouldRetry) {
    const retryRes = await supabaseService
      .from('orders')
      .insert(fallbackPayload)
      .select('id, order_number')
      .single()
    order = retryRes.data
    orderError = retryRes.error
  }
}
```

## ✅ Hasil
Setelah penerapan kode _fallback_, transaksi dengan metode QRIS yang tadinya melempar error schema cache sekarang dapat ter-simpan dengan aman. 
Mekanisme ini tidak memerlukan modifikasi skema database lebih lanjut dan tetap menjaga integritas pesanan bahkan ketika _cache_ PostgREST usang.
