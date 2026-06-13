# Restyle UI Kiosk Pelanggan — Minimalist, Modern, Elegan

**Tanggal:** 2026-06-07
**Scope:** Halaman & komponen yang dilihat pelanggan (kiosk). Admin & kasir TIDAK termasuk.
**Sifat perubahan:** Restyle visual + penyesuaian layout ringan. Fungsi, alur, data, dan logika TIDAK berubah. Warna primary tetap amber.

## Tujuan

Mengubah tampilan kiosk pelanggan menjadi lebih minimalist, modern, dan elegan — tetap hangat dan ramah untuk orang awam (mudah dipakai di layar sentuh). Mengurangi "keramaian" visual desain saat ini (gradient berlebih, shadow tebal beragam, radius sangat besar, font super tebal di mana-mana, elemen dekoratif).

## Prinsip Desain

1. **Hemat aksen amber** — amber 500 tetap warna utama, tapi dipakai lebih selektif (tombol aksi utama, harga, highlight aktif) supaya menonjol.
2. **Hierarki tipografi jelas** — judul `font-bold`/`font-semibold`, harga `font-bold`, body `font-normal`/`font-medium`. Hentikan pemakaian `font-black`/`font-extrabold` menyeluruh.
3. **Konsistensi bentuk** — radius diseragamkan ke `rounded-2xl` (kartu) / `rounded-xl` (elemen kecil). Hentikan campuran `rounded-[2rem]` / `rounded-3xl`.
4. **Shadow halus & konsisten** — satu bahasa shadow lembut, hilangkan `shadow-2xl`/`shadow-xl` dekoratif.
5. **Whitespace lega** — beri ruang napas antar elemen.
6. **Satu aksi utama per layar** — tombol primer jelas dan besar (ramah sentuh).
7. **Hilangkan dekorasi non-fungsional** — ikon ber-gradient, garis fade, overlay berlebih.

## Bagian 1 — Design System (`app/globals.css`)

Fondasi yang membuat semua halaman konsisten.

- **Warna primary:** tetap amber 500. Background tetap krem lembut (`#FFFBF5`) namun dipakai bersih/netral.
- **Radius:** standar kartu `rounded-2xl`; elemen kecil (badge, tombol pill kecil) `rounded-xl`/`rounded-full` sesuai konteks. Hapus `rounded-[2rem]`/`rounded-3xl` dari komponen pelanggan.
- **Shadow:** definisikan/pakai satu shadow kartu halus yang konsisten (mis. `shadow-card` yang sudah ada, dibuat lebih lembut). Hapus shadow tebal dekoratif.
- **Tombol:** `.btn-primary` dirapikan — bobot font diturunkan ke `font-semibold`/`bold` (bukan `extrabold`), shadow lebih halus, radius `rounded-2xl`. `.btn-secondary`/`.btn-ghost` diselaraskan.
- **Card:** `.card` memakai radius & shadow baru yang konsisten.
- Komponen utility lain (`.input`, `.badge`, dll) diselaraskan seperlunya.

Catatan: ubah token/utility di `globals.css` lebih dulu agar perubahan menyebar konsisten; baru sesuaikan kelas per-komponen.

## Bagian 2 — Kartu Produk (`components/MenuItem.tsx`) — fokus khusus

Redesign agar modern, minimalist, elegan:

- Kartu putih bersih, `rounded-2xl`, border tipis netral, satu shadow halus; hover lebih halus (translasi kecil + shadow naik sedikit, tanpa efek berlebihan).
- Area gambar: rasio konsisten, sudut atas mengikuti radius kartu. Pertahankan placeholder ikon untuk item tanpa gambar. Hilangkan/haluskan overlay gradient hitam di bawah gambar (hanya jika benar-benar perlu untuk keterbacaan).
- Badge "Habis" dan badge jumlah di keranjang: dibuat lebih kalem & konsisten dengan sistem baru.
- Konten: nama `font-semibold`/`bold` ukuran terukur, deskripsi `text-gray` ringan, harga amber `font-bold`. Spacing lebih lega.
- Tetap ramah sentuh: seluruh kartu tetap dapat di-tap menuju detail.

## Bagian 3 — Halaman & Komponen Lain (kiosk)

Semua mengikuti design system Bagian 1.

1. **Home / `components/KioskUI.tsx`** — header disederhanakan; judul section ("Best Seller" & nama kategori) tanpa ikon ber-gradient dan garis fade — cukup teks dengan aksen tipis (mis. garis amber kecil). Grid kartu lebih lega. Bar keranjang mobile & overlay diselaraskan (kurangi `shadow-2xl`, gradient).
2. **`components/CategoryFilter.tsx`** — sudah minimal; rapikan spacing/keselarasan saja.
3. **`components/Cart.tsx`** — selaraskan dengan sistem baru (lanjutan perubahan add-on sebelumnya yang sudah ada).
4. **`app/menu/[id]/page.tsx`** (detail) — sederhanakan kartu info & daftar "Extra"; tombol qty dan "Tambah ke Keranjang" tetap besar/ramah sentuh, gaya dikalemkan.
5. **`app/recommendations/page.tsx`** — kartu rekomendasi & tombol diseragamkan; bar aksi bawah dikalemkan.
6. **`app/checkout/page.tsx`** — kartu ringkasan & blok metode bayar disederhanakan; warna per-metode (emerald/blue/purple) dibuat lebih kalem namun tetap dapat dibedakan.
7. **`app/payment/qris/page.tsx`** & **`app/order-success/page.tsx`** — diselaraskan dengan bahasa visual baru.
8. **`components/AttractScreen.tsx`** (layar idle) — diselaraskan.
9. **`components/RecommendationStrip.tsx`** — diselaraskan bila perlu.

## Non-Goals (di luar scope)

- Halaman admin (`app/admin/**`, `components/AdminNav.tsx`) dan kasir (`app/kasir/**`, `components/KasirNav.tsx`).
- Perubahan fungsi, alur navigasi, struktur data, query, atau logika apa pun.
- Penggantian warna primary.
- Penambahan/penghapusan fitur.

## Kriteria Sukses

- Tampilan kiosk terasa lebih bersih, lega, dan elegan; amber tetap dominan sebagai aksen.
- Radius, shadow, dan bobot font konsisten di seluruh halaman pelanggan.
- Tombol aksi utama jelas & besar; mudah dipakai orang awam di layar sentuh.
- Semua fungsi berjalan persis seperti sebelumnya (tidak ada regresi perilaku).
- Tidak ada perubahan pada halaman admin/kasir.
