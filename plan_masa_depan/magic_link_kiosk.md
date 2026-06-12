# Rencana Implementasi: Magic Link & QR Code Kiosk

Sesuai ide brilian Anda, kita akan membuat proses *setup* perangkat absen menjadi sangat mulus tanpa perlu SPV *login* di perangkat toko. SPV cukup menggunakan HP pribadinya untuk men-*generate* akses, lalu perangkat toko tinggal *scan*.

## Flow Arsitektur Baru

1. **Akses dari HP Pribadi SPV:** SPV membuka Dashboard dari HP pribadinya di mana ia sudah *login*.
2. **Generate Magic Link:** Di menu Pengaturan, SPV menekan tombol **"Generate Akses Kiosk"**.
3. **Tampil QR Code & Link:** Sistem akan memunculkan sebuah **Magic Link** (URL acak yang sangat panjang dan aman berbasis UUID, contoh: `https://.../kiosk/550e8400-e29b...`) beserta sebuah **QR Code**.
4. **Scan dari Perangkat Toko:** SPV mengambil HP/Tablet yang akan dijadikan Kiosk Absen di toko, lalu mengarahkan kameranya untuk men-*scan* QR Code di layar HP pribadinya.
5. **Kiosk Otomatis Aktif:** HP toko akan otomatis membuka *Magic Link* tersebut dan langsung terkunci menjadi layar kamera absensi. Tidak perlu *login* apa pun di HP toko!

## Proposed Changes

### [MODIFY] `apps/absensi/src/app/dashboard/DashboardSettings.tsx`
Mengubah blok "Pengaturan Layar Kiosk" menjadi fitur **Magic Link Generator**:
- Menambahkan *State* untuk memunculkan modal/bagian *QR Code*.
- Mengambil URL asli web Anda saat itu (misal `localhost:3000` atau domain asli nantinya).
- Menampilkan gambar QR Code menggunakan tag `<img>` yang dihubungkan ke penyedia QR *Generator* publik.
- Menambahkan tombol "Salin Link" jika SPV ingin mengirim *Magic Link* tersebut via WhatsApp ke staf.
