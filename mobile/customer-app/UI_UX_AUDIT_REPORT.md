# Laporan Audit Komprehensif UI/UX & Validasi Visual
**Aplikasi:** Suka Shawarma Customer App (`mobile/customer-app`)  
**Metodologi:** `ui-visual-validator` × `ux-audit` × `ui-review`  
**Target Pembanding:** `design/*.png` (Mockup Desain Referensi) vs Tangkapan Layar Aplikasi Berjalan (`screen_*.png`, `cart_*.png`, `checkout_*.png`)  
**Tanggal Audit:** 9 September 2026

---

## 1. Ringkasan Eksekutif & Matriks Validasi Visual (`ui-visual-validator`)

> *Prinsip Utama: Asumsi dasar adalah target modifikasi desain **BELUM** tercapai sampai terbukti secara objektif melalui bukti visual konkret.*

### Matriks Status Layar

| Layar | Mockup Referensi | Bukti Layar Aplikasi | Status | Ketidaksesuaian Visual Utama |
| :--- | :--- | :--- | :--- | :--- |
| **Beranda (Home)** | `design/home-screen.png` | `screen_smooth_home.png` | ⚠️ **Tercapai Sebagian** | Grid 2-kolom "Menu Terlaris" (dengan tag favorit/spesial) dan kartu combo hilang; digantikan satu kolom kartu horizontal datar. |
| **Katalog (Menu)** | `design/home-screen.png` | `screen_smooth_menu_tab.png` | ⚠️ **Tercapai Sebagian** | Tombol filter di sebelah pencarian tidak ada. Kotak pencarian menyatu di header gelap, bukan kartu mengambang mandiri. |
| **Keranjang (Cart)** | `design/cart-screen.png` | `cart_screen_toppings.png` | ❌ **Belum Tercapai** | Header diubah menjadi blok cokelat tua masif; foto produk hilang; kolom voucher/kode promo tidak ada; tombol "+ Tambah Menu" hilang. |
| **Checkout** | `design/checkout-screen.png` | `checkout_screen.png` | ❌ **Belum Tercapai** | Header blok cokelat tua; banner hijau verifikasi stok/harga tidak ada; kartu data pemesan hilang; ikon partner QRIS (BCA/GoPay/OVO) tidak ada. |
| **Detail Menu** | `design/product-detail-screen.png` | `ItemDetailScreen.kt` | ❌ **Belum Tercapai** | Mockup menggunakan foto hero makanan *full-bleed* dengan tombol kembali/favorit melayang di atas gambar; kode menggunakan `PageBrandHeader` cokelat kaku. |
| **Pilih Outlet** | `design/outlet-picker-screen.png` | `screen_outlet_picker.png` | ✅ **Tercapai** | Top bar krem terang, tombol aksi melingkar, pencarian, jarak tempuh, dan tombol konfirmasi sesuai referensi. |
| **Status Pesanan** | `design/order-status-screen.png` | `OrderStatusScreen.kt` | ✅ **Tercapai** | Tahapan status, estimasi waktu, animasi live pulse, dan top bar krem terang sesuai desain. |

---

## 2. Analisis Pengukuran Visual Objektif

### A. Layar Beranda (`screen_smooth_home.png` vs `design/home-screen.png`)
*Berdasarkan bukti visual objektif:*
1. **Struktur Header**:
   - *Desain*: Latar belakang krem terang alami (`SukaCream`), bar atas ringkas dengan selector outlet dropdown, lonceng notifikasi, avatar inisial, dan kolom pencarian dengan tombol filter di samping kanan.
   - *Aplikasi*: Menggunakan `HomeBrandHeader` setinggi ~118dp dengan latar gradien cokelat tua (`SukaBrown`) melengkung di bawah (`RoundedCornerShape(bottomStart = 22.dp, bottomEnd = 22.dp)`).
2. **Hierarki Produk**:
   - *Desain*: Memiliki 2 tingkatan yang menarik selera makan:
     - Section *Menu Terlaris 🔥*: Grid 2 kolom dengan kartu vertikal (foto produk rasio 4:3, tag "FAVORIT" / "SPESIAL", deskripsi ringkas, harga cokelat tebal, tombol bulat `+`).
     - Section *Paket Combo Hemat 🥤*: Kartu horizontal dengan badge diskon "Hemat 15%" dan harga coret.
   - *Aplikasi*: Semua menu ditampilkan seragam dalam satu kolom kartu horizontal (`MenuCard`), menghilangkan dinamika visual dan hierarki katalog.
3. **Floating Cart Bar**:
   - Bilah keranjang mengambang ("1 Item di Keranjang • Total: Rp24.000") sudah rapi dan memiliki kontras yang baik, namun langsung menempel di atas bottom navigation bar tanpa gradien transparan pelindung.

### B. Layar Keranjang (`cart_screen_toppings.png` vs `design/cart-screen.png`)
*Berdasarkan bukti visual objektif:*
1. **Inversi Warna Header**:
   - *Desain*: Latar krem terang (`#FFF7ED`) dengan tombol kembali putih melingkar 40×40dp, judul cokelat "Keranjang Pesanan" (`LilitaOne`), subjudul "Order-ahead & Ambil di Toko", serta ikon tempat sampah di kanan atas.
   - *Aplikasi*: Header diubah menjadi blok cokelat pekat gelap dengan teks oranye kecil ("1 item dipilih"), menciptakan kesan berat dan tidak konsisten dengan layar Status Pesanan.
2. **Hilangnya Visual Makanan**:
   - *Desain*: Setiap baris item menampilkan foto makanan 80×80dp dengan badge porsi `1x`, chip opsi, catatan masak, dan tombol stepper jumlah (`- 1 +`).
   - *Aplikasi*: Foto makanan dihilangkan sama sekali. Hanya berupa teks nama item, harga, dan baris chip tambahan topping sederhana.
3. **Komponen Konversi yang Hilang**:
   - Kolom *Voucher & Kode Promo* (input teks + tombol "Terapkan" + badge diskon terpasang).
   - Tombol "+ Tambah Menu Lainnya" dengan garis putus-putus oranye.
   - Banner catatan persiapan pesanan ("*Pesanan disiapkan saat Anda bayar...*").

### C. Layar Checkout (`checkout_screen.png` vs `design/checkout-screen.png`)
*Berdasarkan bukti visual objektif:*
1. **Banner Kepercayaan (Trust Banner)**:
   - *Desain*: Terdapat banner hijau verifikasi "*Ketersediaan & Harga Terverifikasi (Real-time)*". Elemen ini penting untuk meredakan kekhawatiran pelanggan mengenai stok habis di kasir.
   - *Aplikasi*: Tidak ada.
2. **Data Pemesan**:
   - *Desain*: Kartu pemesan yang menampilkan Avatar, Nama Lengkap, Nomor WhatsApp, dan tombol "Ubah".
   - *Aplikasi*: Tidak ada kartu data pemesan. Pelanggan tidak dapat memastikan nomor WA mana yang akan menerima nomor antrean.
3. **Pilihan Pembayaran QRIS**:
   - *Desain*: Menampilkan logo ekosistem (BCA, GoPay, OVO, ShopeePay, Dana, LinkAja) dengan badge "Bebas Biaya".
   - *Aplikasi*: Hanya kotak oranye polos dengan teks "QRIS (Semua E-Wallet & Bank)".

---

## 3. Audit Pengalaman Pengguna (`ux-audit`)

### Evaluasi 10 Heuristik Usability Nielsen

| No | Prinsip Heuristik | Kondisi pada Aplikasi | Status |
| :-: | :--- | :--- | :-: |
| **1** | **Visibility of System Status** | Animasi denyut (pulse) pada status pesanan dan countdown QRIS 15 menit berjalan sangat baik. Namun verifikasi harga/stok real-time belum ada di checkout. | ⚠️ Cukup |
| **2** | **Match Between System & Real World** | Penggunaan istilah lokal sangat tepat (`Ambil di Outlet`, `Siap Saji 15-20 mnt`, format Rupiah standar Indonesia). | ✅ Baik |
| **3** | **User Control and Freedom** | Ditemukan **pelanggaran kritis**: Di `ProfileScreen`, `PageBrandHeader` diatur dengan `onKembali = null`. Jika pengguna membuka profil dari header layar lain, pengguna terjebak tanpa tombol kembali. | ❌ Gagal |
| **4** | **Consistency and Standards** | **Fragmentasi Header Sistem**: Separuh layar memakai header cokelat lengkung masif (`PageBrandHeader`), separuh lagi memakai top bar krem terang (`SukaCream`). | ❌ Gagal |
| **5** | **Error Prevention** | Ada dialog konfirmasi sebelum tindakan destruktif (kosongkan keranjang). Tombol checkout dinonaktifkan jika data tidak valid. | ✅ Baik |
| **6** | **Recognition Rather Than Recall** | Item keranjang di aplikasi tidak memiliki foto makanan, menyulitkan pengguna mengenali kembali item yang dipilih tanpa membaca teks secara detail. | ⚠️ Cukup |
| **7** | **Flexibility and Efficiency** | Touch target pada tombol bulat tambah menu (`+`) hanya berukuran **34×34dp**, di bawah standar minimum 44×44dp. | ⚠️ Cukup |
| **8** | **Aesthetic and Minimalist Design** | Terdapat pencampuran nilai padding dan spasi sembarang (6dp, 7dp, 8dp, 10dp, 12dp, 14dp) alih-alih konsisten pada kelipatan 6/8dp. | ⚠️ Cukup |
| **9** | **Help Users Recover from Errors** | Terdapat layar error (`ErrorState`) dengan tombol "Coba Lagi" saat gagal memuat data. | ✅ Baik |
| **10**| **Help and Documentation** | Ada empty state yang jelas saat keranjang kosong atau outlet tutup. | ✅ Baik |

### Isu Mobile & Dark Pattern

1. **Intrusive Entry Popup (Dark Pattern)**:
   - Lokasi: `HomeScreen.kt:87-98`
   - Masalah: Variabel `var tampilkanPromoPopup by rememberSaveable { mutableStateOf(true) }` secara otomatis memunculkan dialog promo setiap kali pengguna masuk ke Beranda.
   - Dampak UX: Menghalangi maksud utama pengguna yang ingin langsung memesan makanan; memaksa tindakan *dismiss* sebelum berinteraksi.
2. **Ukuran Touch Target Sub-standar (< 44×44dp)**:
   - Lokasi: `MenuCard.kt:170-176` (Tombol `+` berukuran 34dp).
   - Dampak UX: Meningkatkan risiko salah sentuh (*mis-tap*), terutama saat digunakan dengan satu tangan atau sambil berjalan.

---

## 4. Tinjauan Kode UI & Kepatuhan Sistem Desain (`ui-review`)

### Skor Desain: **Needs Improvement (Perlu Perbaikan)**

```
┌─────────────────────────────────────────────────────────┐
│              HASIL AUDIT SISTEM DESAIN                  │
├─────────────────────────┬──────────────┬────────────────┤
│ Kategori                │ Standar      │ Status         │
├─────────────────────────┼──────────────┼────────────────┤
│ Token Warna             │ Terkunci     │ LULUS          │
│ Kontras Teks (WCAG AA)  │ ≥ 4.5:1      │ GAGAL (2.25:1) │
│ Keseragaman Top Bar     │ 1 Sistem     │ GAGAL          │
│ Ukuran Touch Target     │ ≥ 44×44 dp   │ GAGAL (34dp)   │
│ Radius Sudut Kartu      │ 16-20 dp     │ PERINGATAN     │
│ Grid Spacing Konsisten  │ Kelipatan 8  │ PERINGATAN     │
└─────────────────────────┴──────────────┴────────────────┘
```

---

### Isu Kritis & Perbaikan Kode

#### 1. Pelanggaran Kontras WCAG AA pada Bottom Navigation Bar
- **File**: `com/sukashawarma/customer/ui/components/SukaBottomNavBar.kt:112-115, 158-164`
- **Kondisi**: Tab yang aktif menggunakan teks dan ikon berwarna `SukaOrange` (`#F29744`) di atas latar putih (`#FFFFFF`).
- **Pengukuran Kontras**: **2.25:1** (WCAG AA mewajibkan minimal **4.5:1** untuk teks ukuran normal). Teks ini sangat sulit dibaca di bawah sinar matahari.
- **Kaidah Proyek**: Pada `Color.kt` sudah tertulis catatan: *"Aturan yang tidak boleh dilanggar: teks putih TIDAK PERNAH di atas SukaOrange... Oranye selalu membawa SukaInk"*. Kaidah yang sama berlaku sebaliknya: oranye muda tidak boleh dipakai untuk teks di atas putih/krem.
- **Solusi**: Gunakan `SukaBrown` (`#701604`, rasio **11.6:1**) untuk label teks aktif, dan simpan `SukaOrange` hanya untuk titik indikator bulat di bawahnya.

```kotlin
// Perbaikan pada SukaBottomNavBar.kt
val activeColor = SukaBrown // Kontras 11.6:1 di atas putih (LULUS WCAG AA)
val animatedColor by animateColorAsState(
    targetValue = if (isSelected) activeColor else SukaMuted,
    animationSpec = tween(durationMillis = 200),
    label = "bottomNavColor"
)
```

---

#### 2. Kehilangan Navigasi Mundur pada Halaman Profil
- **File**: `com/sukashawarma/customer/ui/profile/ProfileScreen.kt:86-92`
- **Kondisi**: `PageBrandHeader` menerima argumen `onKembali = null`.
- **Solusi**: Teruskan parameter `onKembali` ke komponen header:

```kotlin
// Perbaikan pada ProfileScreen.kt
topBar = {
    PageBrandHeader(
        judul = "Akun Saya",
        subjudul = "Profil & Pengaturan Akun",
        onKembali = onKembali // Aktifkan tombol kembali
    )
}
```

---

#### 3. Fragmentasi Arsitektur Header (Aturan "Satu Pilihan per Sumbu")
- **Kondisi**: Aplikasi mencampurkan dua gaya header yang bertolak belakang:
  - Gaya A (Blok Lengkung Cokelat Tua): Digunakan di Beranda, Menu, Keranjang, Checkout, Riwayat, Profil.
  - Gaya B (Krem Terang Minimalis): Digunakan di Status Pesanan, Menunggu Pembayaran, Pilih Outlet.
- **Target Desain**: Sesuai dengan mockup referensi `design/*.png`, seluruh layar sekunder (Keranjang, Checkout, Riwayat, Profil) seharusnya menggunakan **Gaya B (Krem Terang Minimalis)**. Warna cokelat tua disediakan khusus untuk kartu banner promo utama dan tombol aksi.
- **Solusi Standarisasi Top Bar**:

```kotlin
// Pola Top Bar Terpadu Sesuai Mockup Referensi
Surface(
    modifier = Modifier.fillMaxWidth(),
    color = SukaCream,
    shadowElevation = 0.dp
) {
    Row(
        modifier = Modifier
            .statusBarsPadding()
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(CircleShape)
                .background(Color.White)
                .border(BorderStroke(1.dp, SukaBorder.copy(alpha = 0.8f)), CircleShape)
                .bounceClick(onClick = onKembali),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Kembali", tint = SukaBrown)
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(text = judul, fontFamily = LilitaOne, fontSize = 18.sp, color = SukaBrown)
            if (subjudul != null) {
                Text(text = subjudul, style = MaterialTheme.typography.bodySmall.copy(color = SukaMuted, fontSize = 11.sp))
            }
        }
        Spacer(modifier = Modifier.size(40.dp))
    }
}
```

---

#### 4. Konflik Registrasi Klik Ganda pada Tombol Utama
- **File**: `CartScreen.kt:120-128`, `CheckoutScreen.kt:118-130`
- **Kondisi**:
  ```kotlin
  Button(
      onClick = onBayar,
      modifier = Modifier.bounceClick(scaleDown = 0.94f) {
          if (state.bolehLanjut) onBayar() // REDUNDAN
      }
  )
  ```
  `bounceClick` yang diberi lambda akan memasang `Modifier.clickable` tambahan di atas `Button` yang sudah memiliki listener `onClick` bawaan Compose. Hal ini menyebabkan event klik terpanggil ganda.
- **Solusi**: Jangan berikan lambda pada `bounceClick` jika dipasang pada komponen `Button`:
  ```kotlin
  Button(
      onClick = onBayar,
      modifier = Modifier.bounceClick(scaleDown = 0.94f) // Hanya animasi membal
  )
  ```

---

#### 5. Perluasan Touch Target Envelope Tombol Tambah Menu
- **File**: `MenuCard.kt:170-176`
- **Kondisi**: Ukuran tombol tambah hanya `34.dp`.
- **Solusi**: Bungkus tombol visual dalam kontainer sentuh minimal 44×44dp:
  ```kotlin
  Box(
      modifier = Modifier
          .size(44.dp) // Area sentuh yang dapat diakses (44x44dp)
          .clickable(
              interactionSource = remember { MutableInteractionSource() },
              indication = null,
              onClick = { onKlik(item) }
          ),
      contentAlignment = Alignment.Center
  ) {
      Box(
          modifier = Modifier
              .size(34.dp) // Tampilan visual tetap kompak
              .clip(CircleShape)
              .background(SukaOrange)
              .bounceClick(scaleDown = 0.90f),
          contentAlignment = Alignment.Center
      ) {
          Icon(Icons.Filled.Add, contentDescription = "Tambah ${item.name}", tint = SukaInk)
      }
  }
  ```

---

## 5. Rencana Aksi Perbaikan Bertahap (Roadmap)

### Fase 1: Perbaikan Kritis Fungsional & Aksesibilitas (Prioritas 1)
- [ ] Ubah warna teks aktif pada `SukaBottomNavBar` dari `SukaOrange` ke `SukaBrown` (memperbaiki kontras dari 2.25:1 ke 11.6:1).
- [ ] Hubungkan parameter `onKembali` pada `ProfileScreen`.
- [ ] Hapus lambda `onClick` duplikat dari `bounceClick` pada tombol Keranjang dan Checkout.
- [ ] Hapus kemunculan otomatis `PromoPopupDialog` saat pertama kali membuka Beranda.

### Fase 2: Penyelarasan Visual & Kesatuan Header (Prioritas 2)
- [ ] Standarisasi top bar pada layar Keranjang, Checkout, Riwayat, dan Profil menjadi gaya krem terang minimalis (`SukaCream`) sesuai mockup `design/*.png`.
- [ ] Perluas area sentuh (*touch envelope*) tombol tambah menu di `MenuCard` menjadi 44×44dp.
- [ ] Tambahkan kembali foto produk (thumbnail) dan kolom input kode voucher pada `CartScreen`.
- [ ] Tampilkan kartu data pemesan dan badge logo partner pembayaran di `CheckoutScreen`.

### Fase 3: Peningkatan Craft Desain & Detail Interaksi (Prioritas 3)
- [ ] Bangun layout grid 2-kolom untuk section "Menu Terlaris" di Beranda sesuai mockup referensi.
- [ ] Terapkan rumus *nested radius* ($R_{\text{inner}} = R_{\text{outer}} - P$) pada gambar di dalam kartu menu.
- [ ] Rombak layar Detail Menu (`ItemDetailScreen`) menggunakan layout foto hero makanan *full-bleed*.

---
*Dokumen ini disusun sebagai panduan teknis implementasi bagi tim engineering dan desainer Suka Shawarma.*
