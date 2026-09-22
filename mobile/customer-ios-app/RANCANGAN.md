# Rancangan — customer-ios-app (versi iOS dari customer-app)

**Sumber porting:** `mobile/customer-app` (Kotlin + Jetpack Compose, ±15.200 baris, 77 berkas `.kt`, 18 berkas uji).
**Prinsip:** *clone perilaku, bukan terjemahan baris-per-baris.* Setiap layar, aturan bisnis, dan kontrak API di Android harus punya padanan iOS yang hasilnya sama; cara menulisnya mengikuti idiom SwiftUI.

## Status fase

| Fase | Isi | Status |
|---|---|---|
| 0 | Kerangka proyek, tema, font, aset, konfigurasi | ✅ selesai |
| 1 | Lapisan data: DTO, klien gateway, galat, Repository, SessionStore (Keychain), OutletStore, CartStore, Rupiah, waktu ISO | ✅ selesai — 62 uji lulus, payload gateway produksi terurai |
| 2 | Navigasi + splash + pilih outlet + beranda + katalog + detail item | ✅ selesai — 111 uji unit + 1 uji perjalanan lulus |
| 3 | Keranjang, checkout, form profil, login | ✅ selesai — layar Masuk (Google + Apple) dibangun; **aktif penuh setelah iOS client ID Google & endpoint `auth/apple` tersedia** |
| 4 | Pembayaran (QRIS / Safari), sukses | ✅ selesai — 167 uji unit + 5 uji perjalanan lulus |
| 5 | Riwayat, status pesanan, profil, notifikasi | ✅ selesai — 187 uji unit + 6 uji perjalanan lulus |
| 6 | Sign in with Apple, ikon, aksesibilitas, TestFlight | 🟡 kontras, teks besar, VoiceOver, ikon, manifest privasi, tombol Sign in with Apple selesai (207 uji unit + 7 uji perjalanan); **iPhone fisik & TestFlight menunggu akun Apple Developer** |

Rincian tiap fase di §6. Catatan per fase di §8.

---

## 1. Gambaran besar

```
┌──────────────────────────────┐        HTTPS (JSON)        ┌──────────────────┐
│  iPhone: customer-ios-app    │ ─────────────────────────▶ │  Retail Gateway  │ ──▶ Supabase / POS
│  (SwiftUI)                   │ ◀───────────────────────── │  retail.suka…com │     (tak pernah
└──────────────────────────────┘                            └──────────────────┘      disentuh app)
┌──────────────────────────────┐            ▲
│  Android: customer-app       │ ───────────┘   gateway & endpoint yang SAMA
└──────────────────────────────┘
```

Aplikasi iOS **bukan** backend baru: ia klien kedua untuk Retail Gateway yang sudah dipakai Android. Karena itu seluruh kontrak (nama field JSON, kode galat, aturan idempotensi) disalin dari Android, bukan dirancang ulang.

**Aturan keamanan yang dibawa dari Android (tidak boleh longgar di iOS):**
- Aplikasi bicara **hanya** ke Retail Gateway. Tidak ada Supabase SDK, tidak ada kredensial DB.
- Header `Authorization` hanya dikirim bila token ada (bukan `"Bearer null"`), dan **tidak pernah** ke `auth/google`, `catalog`, `outlets`, `banners`, `splash`, maupun URL gambar splash. *(Di iOS aturan ini kini dijaga uji otomatis — `GatewayClientTests`.)*
- Token sesi hanya di Keychain.

---

## 2. Alur aplikasi

### 2.1 Alur pelanggan (layar demi layar)

```
Buka aplikasi
   │
   ▼
Splash (gambar dari gateway, atau bawaan) ──── sementara itu: perbaruiSplash() di latar
   │
   ├── sesi Keychain masih berlaku? ── tidak ──▶ Masuk (Google) ──┐
   │                                                              │
   ▼ ya                                                           │
Beranda  ◀────────────────────────────────────────────────────────┘
   │  (belum pilih outlet → Pilih Outlet; outlet tutup → Outlet Tutup)
   │
   ├─ Tab Beranda : banner carousel, popup promo (sekali per banner), menu unggulan
   ├─ Tab Menu    : katalog per kategori + filter
   ├─ Tab Pesanan : riwayat → Status pesanan
   └─ Tab Profil  : Informasi akun, Notifikasi, Keluar
          │
          ▼
Detail item (jumlah, catatan, topping) ──▶ tambah ke keranjang
          │
          ▼
Keranjang ──▶ Checkout ──(validasi gateway: harga berubah / item habis?)──▶ Bayar
                                                                             │
                   ┌─────────────── belum login? → Masuk?tujuan=bayar ◀──────┤
                   │                (kembali ke titik bayar, BUKAN katalog)  │
                   ▼                                                         ▼
             Tampil QRIS (digambar sendiri) atau halaman Xendit (Safari) ──▶ polling status
                                                                             │
                                                                             ▼
                                                        Sukses (nomor antrian POS) ──▶ Status pesanan
```

Empat tab (Beranda, Menu, Pesanan, Profil) = `topLevelRoutes` di `AppNavigation.kt`. Di iOS: **satu** `NavigationStack` yang isi akarnya berganti per tab, dengan bilah bawah kustom yang hanya tampil di akar — meniru Android persis (satu NavHost). Sengaja **bukan** `TabView`, karena TabView menyimpan tumpukan terpisah per tab, perilaku yang tidak ada di Android.

### 2.2 Alur data (siapa memanggil siapa)

```
View (SwiftUI)                    ← hanya menggambar & meneruskan aksi
   │ membaca / memanggil
   ▼
ViewModel (@Observable, @MainActor)   ← satu per layar, nama sama dengan Android
   │
   ├──▶ Repository ──▶ GatewayClient ──▶ URLSession ──▶ Retail Gateway
   │        (membungkus GatewayResult apa adanya: .sukses(data) / .gagal(GatewayError))
   │
   └──▶ Store lokal
          ├─ SessionStore       → Keychain       (token, nama, email, telepon)
          ├─ OutletStore        → UserDefaults   (id & nama outlet terpilih)
          ├─ CartStore          → UserDefaults   (keranjang JSON, @Observable)
          ├─ OrderAttemptStore  → UserDefaults   (kunci idempotensi pesanan)  [Fase 4]
          ├─ SplashStore        → Application Support + UserDefaults (splash)
          ├─ BannerDilihatStore → UserDefaults   (id popup yang sudah dilihat)
          └─ NotificationStore  → UserDefaults   (preferensi & badge)        [Fase 5]

CatalogViewModel  ← satu untuk tab Beranda & Menu, dimiliki AppShell (katalog tak hilang saat pindah tab)

AppContainer  ← merakit semuanya sekali saat aplikasi mulai, disuntik lewat .environment
```

### 2.3 Alur galat (bagaimana layar tahu apa yang terjadi)

`GatewayClient` tidak pernah melempar ke layar; setiap panggilan mengembalikan `GatewayResult`:

| Kondisi | Hasil | Yang ditampilkan layar |
|---|---|---|
| HTTP 2xx | `.sukses(data)` | data — **kecuali** `checkout/validate` yang menolak lewat `ok == false` di HTTP 200 |
| HTTP 401 | `.gagal(.sesiTidakSah)` | arahkan ke Masuk |
| HTTP ≥ 500 | `.gagal(.server(status))` | "server sedang bermasalah", tombol coba lagi |
| HTTP 4xx + `{"error","pesan"}` | `.gagal(.kode(kode, pesan))` | cocokkan kode mesin (`pesanan_kadaluarsa`, …), kalau tidak dikenal tampilkan `pesan` |
| Tanpa koneksi / timeout 15 dtk / body tak terurai | `.gagal(.jaringan(error))` | "periksa koneksi" |

### 2.4 Alur pembayaran & idempotensi (Fase 4, diringkas dari Android)

1. Checkout memanggil `validasiCheckout` → bila `ok == false` tampilkan `masalah` (harga baru / habis); pelanggan sendiri yang menyetujui harga baru (`CartStore.perbaruiHarga`).
2. `clientOrderId` dibuat **sekali** dan disimpan (`OrderAttemptStore`) **sebelum** `buatPesanan`. Percobaan ulang (koneksi putus, aplikasi ditutup) memakai id yang sama → gateway membalas `duplicate: true`, bukan pesanan kedua.
3. Balasan berisi `qr_string` → QRIS digambar CoreImage; atau `payment_url` → `SFSafariViewController`.
4. Status dipantau (`statusPesanan`) sampai lunas / kedaluwarsa. Id percobaan hanya diganti pada kondisi yang ditetapkan `Idempotensi.kt`.

---

## 3. Keputusan teknis (Android → iOS)

| Aspek | Android (customer-app) | iOS (customer-ios-app) | Catatan |
|---|---|---|---|
| Bahasa / UI | Kotlin + Jetpack Compose (Material3) | Swift 6 + SwiftUI | |
| Minimum OS | minSdk 24 | **iOS 17.0** | Syarat `@Observable`; ±95% iPhone aktif |
| Proyek | Gradle | **XcodeGen** (`project.yml`) → `.xcodeproj` | `.xcodeproj` hasil generate, jangan disunting manual |
| State / ViewModel | `ViewModel` + `StateFlow` | `@Observable` class `@MainActor` | Satu ViewModel Android = satu ViewModel Swift, nama sama |
| DI | `AppContainer` manual | `AppContainer` manual, disuntik via `.environment` | Sama filosofinya |
| Navigasi | Navigation Compose, `Rute` | Satu `NavigationStack(path: [Rute])` + enum `TabUtama` + bilah bawah kustom | Lihat §2.1 |
| HTTP | Ktor + kotlinx.serialization | `URLSession` async/await + `Codable` | Nol dependensi pihak ketiga |
| Galat API | `GatewayResult` / `GatewayError` / `petakanGalat` | enum `GatewayResult<T>` / `GatewayError` + `petakanGalat` | Aturan identik, uji diporting |
| Sesi (token) | `EncryptedSharedPreferences` | **Keychain** (`AfterFirstUnlockThisDeviceOnly`) | Wajib terenkripsi |
| Prefs biasa | SharedPreferences | `UserDefaults` (suite terpisah per store) | Nama berkas/kunci sama dengan Android |
| Gambar splash | File di `filesDir` | File di `Application Support` | Batas 5 MB, hanya `https://`, tanpa Authorization |
| Gambar menu/banner | Coil | `AsyncImage` + `URLCache` | Ganti ke Nuke hanya bila caching terbukti kurang |
| QRIS | ZXing core | **CoreImage `CIQRCodeGenerator`** | Bawaan iOS |
| Halaman bayar cadangan | Chrome Custom Tabs | `SFSafariViewController` | Bukan WKWebView sendiri — alasan sama |
| Login | Credential Manager + Google ID | **`ASWebAuthenticationSession` + PKCE** (tanpa SDK Google) + **Sign in with Apple** | Lihat §5 & §8 Fase 3 bagian 3 |
| Font / warna | `res/font`, `Color.kt` | `Resources/Fonts` + `UIAppFonts`, `SukaColors.swift` | Nilai identik |
| Uji | JUnit + Robolectric | Swift Testing (`import Testing`) | Uji logika murni diporting 1:1 |
| Konfigurasi | `buildConfigField` + `local.properties` | `Base.xcconfig` + `Local.xcconfig` (tak di-commit) → `Info.plist` → `AppConfig` | |

**Nol dependensi pihak ketiga.** Rencana awal GoogleSignIn-iOS dibatalkan — masuk Google memakai alur OAuth standar Apple (lihat §8 Fase 3 bagian 3).

---

## 4. Struktur folder & peta berkas

```
customer-ios-app/
├── RANCANGAN.md                 # dokumen ini
├── project.yml                  # sumber kebenaran proyek (XcodeGen)
├── SukaShawarma.xcodeproj       # HASIL GENERATE
├── SukaShawarma/
│   ├── App/                     # SukaShawarmaApp (=MainActivity), AppContainer, AppConfig (=BuildConfig)
│   ├── Config/                  # Base.xcconfig, Local.xcconfig (gitignored), Info.plist
│   ├── Data/                    # store + Repository + WaktuIso
│   │   └── API/                 # GatewayClient, Dto, GatewayError
│   ├── Navigation/              # AppShell (=AppNavigation.kt), Rute, SegeraView (penanda sementara)
│   ├── UI/
│   │   ├── Theme/               # SukaColors, SukaTypography
│   │   ├── Format/              # Rupiah
│   │   ├── Components/          # kepala cokelat, BannerCarousel, PromoPopup, MenuCard, bilah bawah, States…
│   │   └── Home/ Menu/ Product/ Cart/ Checkout/ Payment/ Orders/ Profile/ Notifications/
│   └── Resources/               # Assets.xcassets, Fonts
├── SukaShawarmaTests/           # padanan app/src/test (struktur folder sama) — ⌘U
└── SukaShawarmaUITests/         # uji perjalanan pelanggan (padanan journey_testing/) — skema SukaShawarmaJourney
```

Nama tipe & fungsi mempertahankan istilah Indonesia dari Android (`CartStore.tambah`, `petakanGalat`, `rapikanCatatan`) supaya dua kode bisa dibandingkan berdampingan.

### 4.1 Peta berkas yang sudah diporting

| Android (`customer-app/app/src/main/java/.../customer/`) | iOS (`customer-ios-app/SukaShawarma/`) | Uji iOS |
|---|---|---|
| `MainActivity.kt` | `App/SukaShawarmaApp.swift` | — |
| `AppContainer.kt` | `App/AppContainer.swift` | — |
| `BuildConfig` (build.gradle.kts) | `App/AppConfig.swift` + `Config/Base.xcconfig` | `SmokeTests` |
| `ui/theme/Color.kt`, `Type.kt` | `UI/Theme/SukaColors.swift`, `SukaTypography.swift` | — |
| `data/api/Dto.kt` | `Data/API/Dto.swift` | `DtoTests` *(baru)* |
| `data/api/GatewayError.kt` | `Data/API/GatewayError.swift` | `GatewayErrorTests` ← `GatewayErrorTest.kt` |
| `data/api/GatewayClient.kt` | `Data/API/GatewayClient.swift` | `GatewayClientTests` *(baru)* |
| `data/Repository.kt` | `Data/Repository.swift` | (lewat uji klien) |
| `data/SessionStore.kt` (bagian penyimpanan) | `Data/SessionStore.swift` | `SessionStoreTests` *(baru)* |
| `data/SessionStore.kt` (`uraiWaktuIso`, `sesiMasihBerlaku`) | `Data/WaktuIso.swift` | `UraiWaktuIsoTests`, `SesiBerlakuTests` ← 2 uji Android |
| `data/OutletStore.kt` | `Data/OutletStore.swift` | `OutletStoreTests` *(baru)* |
| `data/CartStore.kt` | `Data/CartStore.swift` | `CartStoreTests` ← `CartStoreTest.kt` (25/25 kasus) |
| `ui/format/Rupiah.kt` | `UI/Format/Rupiah.swift` | `RupiahTests` ← `RupiahTest.kt` |
| `navigation/AppNavigation.kt`, `NavRoutes.kt` | `Navigation/AppShell.swift`, `Rute.swift` | uji perjalanan |
| `data/SplashStore.kt`, `PerbaruiSplash.kt` | `Data/SplashStore.swift` | `KeputusanSplashTests` ← `KeputusanSplashTest.kt`, `SplashStoreTests` *(baru)* |
| `data/BannerDilihatStore.kt` | `Data/BannerDilihatStore.swift` | `SplashStoreTests` *(baru)* |
| `ui/theme/Shape.kt` + warna lepas di layar | `UI/Theme/SukaGaya.swift` (`kartuSuka`, `MentulStyle` = `bounceClick`) | — |
| `ui/components/States.kt`, `Rangka.kt` | `UI/Components/States.swift`, `Rangka.swift` | — |
| `ui/components/HomeHeader.kt` | `UI/Components/HomeHeader.swift` (3 kepala) | — |
| `SukaBottomNavBar.kt`, `FloatingCartBar.kt`, `BannerCarousel.kt`, `PromoPopupDialog.kt`, `MenuCard.kt` | `UI/Components/…` (nama sama) | — |
| `ui/home/HomeScreen.kt` | `UI/Home/HomeView.swift` | `MenuTerlarisTests` *(baru)* |
| `ui/home/TujuanBanner.kt` | `UI/Home/TujuanBanner.swift` | `TujuanBannerTests` ← `TujuanBannerTest.kt` |
| `ui/home/OutletPickerScreen.kt` + VM | `UI/Home/OutletPickerView.swift` + `OutletPickerViewModel.swift` | `OutletPickerLogicTests` ← `OutletPickerLogicTest.kt` |
| `ui/home/OutletClosedScreen.kt`, `SplashAplikasiScreen.kt` | `UI/Home/OutletClosedView.swift`, `SplashAplikasiView.swift` | — |
| `ui/menu/CatalogViewModel.kt` | `UI/Menu/CatalogViewModel.swift` | `CatalogViewModelTests` *(baru)* |
| `ui/menu/KatalogFilter.kt` (+ logika topping di AppNavigation) | `UI/Menu/KatalogFilter.swift` | `KatalogFilterTests` ← `KatalogFilterTest.kt`, `ToppingTests` *(baru)* |
| `ui/menu/MenuScreen.kt` | `UI/Menu/MenuView.swift` | uji perjalanan |
| `ui/product/ItemDetailScreen.kt` + VM | `UI/Product/ItemDetailView.swift` + `ItemDetailViewModel.swift` | `ItemDetailViewModelTests` *(baru)* |
| `ui/cart/CartScreen.kt` (+ `CartViewModel.kt`) | `UI/Cart/CartView.swift` — tanpa ViewModel, lihat §8 Fase 3 | uji perjalanan |
| `ui/checkout/CheckoutScreen.kt` | `UI/Checkout/CheckoutView.swift` | uji perjalanan (skenario) |
| `ui/checkout/CheckoutViewModel.kt` (+ `kePayloadList`) | `UI/Checkout/CheckoutViewModel.swift` | `CheckoutViewModelTests` *(baru)* |
| `ui/checkout/ValidasiPesan.kt` | `UI/Checkout/ValidasiPesan.swift` | `ValidasiPesanTests` ← `ValidasiPesanTest.kt`, `PayloadKeranjangTests` *(baru)* |
| `ui/profile/ProfilForm.kt`, `InformasiAkun.kt` | `UI/Profile/ProfilForm.swift` (keduanya) | `ProfilFormTests` ← `ProfilFormTest.kt`, `InformasiAkunTests` ← `InformasiAkunTest.kt` |
| `ui/profile/InformasiAkunScreen.kt` + VM | `UI/Profile/InformasiAkunView.swift` + `InformasiAkunViewModel.swift` | `InformasiAkunViewModelTests` *(baru)*, uji perjalanan |
| `ui/payment/Idempotensi.kt` | `UI/Payment/Idempotensi.swift` | `IdempotensiTests` ← `IdempotensiTest.kt`, `NasibPercobaanTests` ← `NasibPercobaanTest.kt` |
| `data/OrderAttemptStore.kt` | `Data/OrderAttemptStore.swift` | lewat `PaymentViewModelTests` |
| `ui/payment/PaymentViewModel.kt` | `UI/Payment/PaymentViewModel.swift` | `PaymentViewModelTests` *(baru)* |
| `ui/payment/PaymentWaitScreen.kt`, `SuccessScreen.kt` | `UI/Payment/PaymentWaitView.swift`, `SuccessView.swift` | uji perjalanan |
| `ui/components/KodeQris.kt` (ZXing) | `UI/Components/KodeQris.swift` (CoreImage) | `QrisTests` *(baru)* |
| Chrome Custom Tabs | `UI/Components/SafariView.swift` (`SFSafariViewController`) | — |
| `ui/orders/StatusPesanan.kt` | `UI/Orders/StatusPesanan.swift` (+ `FilterRiwayat`) | `StatusPesananTests` ← `StatusPesananTest.kt`, `FilterRiwayatTests` *(baru)* |
| `ui/orders/HistoryViewModel.kt`, `OrderStatusViewModel.kt` | `UI/Orders/OrderViewModels.swift` | `Fase5ViewModelTests` *(baru)* |
| `ui/orders/HistoryScreen.kt`, `OrderStatusScreen.kt` | `UI/Orders/HistoryView.swift`, `OrderStatusView.swift` | uji perjalanan |
| `data/NotificationStore.kt` | `Data/NotificationStore.swift` (`@Observable`) | `Fase5ViewModelTests` |
| `ui/notifications/NotificationViewModel.kt` | `UI/Notifications/NotificationViewModel.swift` | `NotificationFilterTests` ← `NotificationFilterTest.kt`, `Fase5ViewModelTests` |
| `ui/notifications/NotificationScreen.kt`, `NotificationSettingsDialog.kt` | `UI/Notifications/NotificationView.swift` (+ `PengaturanNotifikasiSheet`) | uji perjalanan |
| `ui/profile/ProfileScreen.kt` | `UI/Profile/ProfileView.swift` (+ `ProfilTab` di AppShell) | uji perjalanan |
| — | `formatWaktuPendek` di `Data/WaktuIso.swift` | `FormatWaktuTests` *(baru)* |
| — | `App/SkenarioUji.swift` (Debug saja) | pemalsu `checkout/validate`, `customer/profile`, `orders`, `orders/list`, `notifications` + sesi palsu, untuk uji perjalanan |

**Sengaja tidak diporting:** `ui/menu/CatalogScreen.kt` dan `OutletHeader` di `MenuCard.kt` — tidak dipasang di navigasi mana pun di Android (kode mati; `Rute.KATALOG` hanya alias `beranda`). `domain/model/*.kt` (`CartItem`, `CustomerOrder`, `MenuItem`, `Outlet`) — tidak dipakai berkas mana pun di Android (kode mati). `FcmTokenRequest` / `registerFcmToken` — ada di Android tapi tak pernah dipanggil.

---

## 5. Keputusan terbuka (butuh jawaban sebelum fase terkait)

1. **iOS OAuth client ID Google.** Buat di project Google Cloud `401597244561` (tipe *iOS*, bundle `com.sukashawarma.customer`), isi `GOOGLE_IOS_CLIENT_ID` di `Config/Base.xcconfig`. **Wajib dicek:** Supabase/gateway harus menerima ID token ber-*audience* iOS client ID — tambahkan ke *Authorized Client IDs* provider Google di Supabase (dipisah koma, web client ID tetap ada) **tanpa** mengubah Android.
2. **Endpoint `POST /api/v1/auth/apple` di Retail Gateway** (belum ada). Kontrak yang dipakai aplikasi: body `{ "id_token", "nonce", "name"? }`; gateway memanggil Supabase `signInWithIdToken({ provider: 'apple', token: id_token, nonce })` dan membalas `AuthResponse` yang sama dengan `auth/google`. `name` hanya dikirim Apple pada masuk pertama. Provider Apple juga harus dinyalakan di Supabase (Services ID + kunci dari akun Apple Developer). Selama endpoint belum ada, aplikasi menampilkan "Masuk dengan Apple belum tersedia".
3. **Akun Apple Developer & signing** — untuk iPhone fisik & TestFlight.
4. **Notifikasi push.** Android belum memakai FCM; iOS mengikuti: notifikasi in-app via `GET /api/v1/notifications`, APNs ditunda.
5. ~~Ikon aplikasi~~ — dibuat dari `logo_suka.png` di atas cokelat Suka (Fase 6). Sumbernya hanya 307 px, jadi sebaiknya diganti berkas logo resolusi tinggi (≥ 1024 px) dari owner.
6. **URL Kebijakan Privasi** — wajib diisi di App Store Connect. Belum ada di Android maupun iOS.
7. **Apple Developer: Team ID** — isi `DEVELOPMENT_TEAM` di `project.yml` untuk iPhone fisik & TestFlight.

---

## 6. Fase pengerjaan

| Fase | Isi | Selesai bila |
|---|---|---|
| **0 ✅** | Proyek XcodeGen, xcconfig→Info.plist, tema, font, aset, uji smoke | Build & test lulus di simulator |
| **1 ✅** | `Dto`, `GatewayClient`, `GatewayError`, `Repository`, `SessionStore` (Keychain), `OutletStore`, `CartStore`, `Rupiah`, `WaktuIso`; porting semua uji Android terkait | Semua uji lulus; data gateway nyata termuat |
| **2 ✅** | `Rute` + NavigationStack + bottom bar kustom; `SplashStore` + `perbaruiSplash` + layar splash; Pilih Outlet (+ `OutletPickerLogicTest`), Outlet Tutup; Beranda (banner, promo popup, `BannerDilihatStore`, `TujuanBannerTest`); Katalog + `KatalogFilter` (+ uji); Detail item. Hapus layar diagnostik. | Alur jelajah menu utuh di simulator |
| **3 🟡** | ✅ Keranjang, ✅ Checkout + `ValidasiPesan` (+ uji), ✅ Informasi Akun (`ProfilFormTest`, `InformasiAkunTest`); ⏳ Login Google + `tujuan` + gerbang awal | Pelanggan bisa login dan sampai tombol bayar |
| **4 ✅** | `Idempotensi`/`OrderAttemptStore` (+ `IdempotensiTest`, `NasibPercobaanTest`), buat pesanan, QRIS CoreImage, cadangan Safari, polling, Sukses | Satu pesanan uji dibayar end-to-end |
| **5 ✅** | Riwayat, Status pesanan (`StatusPesananTest`), Informasi Akun (`InformasiAkunTest`), Notifikasi + preferensi (`NotificationFilterTest`) | Paritas fitur penuh dengan Android |
| **6 🟡** | Sign in with Apple, ikon, Dynamic Type/VoiceOver (`ColorContrastTest`), iPhone fisik, TestFlight | Siap review App Store |

Setiap fase: porting uji Android yang relevan **lebih dulu**, lalu kodenya, lalu cek visual di simulator dibandingkan aplikasi Android.

---

## 7. Cara menjalankan

```bash
brew install xcodegen          # sekali
cd mobile/customer-ios-app
xcodegen generate              # setiap kali project.yml berubah atau berkas .swift ditambah/dihapus
open SukaShawarma.xcodeproj    # lalu ⌘R (jalan) / ⌘U (uji unit)
```

Uji perjalanan (Beranda → Menu → Detail → keranjang → Pilih Outlet, menyimpan tangkapan layar tiap langkah di hasil uji). Memakai gateway **produksi**, jadi sengaja dipisah dari ⌘U:

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild -project SukaShawarma.xcodeproj -scheme SukaShawarmaJourney -destination 'platform=iOS Simulator,name=iPhone 18 Pro' test
```

Dari terminal:

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild -project SukaShawarma.xcodeproj -scheme SukaShawarma -destination 'platform=iOS Simulator,name=iPhone 18 Pro' test
```

Gateway lokal/staging: buat `SukaShawarma/Config/Local.xcconfig` (tak di-commit), isi mis. `GATEWAY_BASE_URL = http:/$()/192.168.1.10:3000` (tulis `:/$()/` — `//` di xcconfig adalah komentar). Gateway `http://` juga butuh pengecualian ATS di `Info.plist`.

**Catatan mesin dev:** `xcode-select` menunjuk Command Line Tools, bukan Xcode — karena itu `DEVELOPER_DIR=` di atas. Pindahkan permanen dengan `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`.

---

## 8. Catatan per fase

### Fase 1 — lapisan data (2026-09-22)

- **Hasil:** 62 uji dalam 10 suite lulus; build bersih tanpa peringatan Swift 6. Payload produksi `catalog` (19 menu), `banners` (3 carousel + popup), dan `splash` terurai tanpa galat oleh DTO Swift.
- **Layar diagnostik sementara** (`UI/Root/RootView.swift`): daftar outlet → ketuk → katalog + harga Rupiah. Saat diuji hanya **"outlet tes"** yang tampil — itu memang satu-satunya outlet `app_enabled` di produksi, bukan bug. Layar ini dibuang di Fase 2.
- **Kesetaraan penyandian JSON.** kotlinx.serialization tidak mengirim field yang bernilai default. Di Swift field `nil` otomatis tak dikirim; khusus `mark_all` (default `false`) disimpan sebagai `nil` saat false agar body identik dengan Android.
- **Waktu ISO ditulis manual, bukan `ISO8601DateFormatter`** — formatter bawaan menolak pecahan detik 6 digit dan offset `+0700`, dua bentuk yang benar-benar dikirim gateway (lihat komentar `uraiWaktuIso` di Android).
- **Pembulatan Rupiah** meniru `roundToLong` Kotlin (setengah ke atas, juga untuk negatif), bukan `rounded()` Swift yang membulatkan menjauhi nol.
- **Paritas yang disengaja:** body sukses yang gagal diurai dilaporkan sebagai `.jaringan`, persis Android. Kalau kelak diubah, ubah di kedua aplikasi.
- **Uji baru yang tidak ada di Android:** aturan header Authorization (`GatewayClientTests`), kontrak JSON (`DtoTests`), Keychain (`SessionStoreTests`), `OutletStoreTests`.

### Fase 2 — navigasi, beranda, katalog, detail (2026-09-22)

- **Hasil:** 111 uji unit (19 suite) + 1 uji perjalanan lulus; build tanpa peringatan. Semua uji Android fase ini diporting: `KatalogFilterTest` (11), `OutletPickerLogicTest` (5), `TujuanBannerTest` (8), `KeputusanSplashTest` (7).
- **Uji perjalanan** (`SukaShawarmaUITests`) menjalankan alur nyata di simulator melawan gateway produksi dan menyimpan 6 tangkapan layar (beranda + popup, beranda, menu, detail, pil keranjang, pilih outlet). Semua layar tampil benar; popup "tester" dan 3 banner produksi terbaca.
- **Gerbang login BELUM dipasang.** Di Android, tanpa sesi aplikasi mulai di layar Masuk. Di iOS Fase 2 selalu mulai di Beranda karena login baru dibangun di Fase 3 (butuh iOS client ID Google — §5 butir 1).
- **Penanda sementara** (`Navigation/SegeraView.swift`) untuk Keranjang (Fase 3), Pesanan, Profil, Notifikasi (Fase 5). Harus habis sebelum rilis.
- **Bug yang ditemukan uji:** `URL.resourceValues` menyimpan cache di objek URL, sehingga berkas splash yang sudah dihapus masih terbaca ada → `perluUnduh` tak akan mengunduh ulang. Diganti `FileManager.attributesOfItem`.
- **Beda sengaja dengan Android:**
  - **`perluPilihOutlet` kini ditampilkan.** Di Android, state ini di-set `CatalogViewModel` tapi tak dibaca layar mana pun: pelanggan dengan >1 outlet dan tanpa pilihan tersimpan melihat Beranda kosong tanpa petunjuk. Di iOS muncul "Pilih outlet dulu" + tombol. ⚠️ Layak diperbaiki juga di Android.
  - **Tombol "Bagikan" di detail menu tidak disalin** — di Android tombol itu tidak melakukan apa-apa.
  - **Popup promo dipasang di shell**, bukan di Beranda, agar latar gelapnya menutupi bilah bawah juga (padanan `Dialog` Android).
  - **Splash tak menunggu "splash sistem hilang"** — layar peluncuran iOS (warna cokelat `LaunchBackground`) langsung diganti saat tampilan pertama digambar.
  - **Tarik-untuk-muat-ulang** di Beranda (tak ada di Android) — idiom iOS yang wajar, memanggil `muat()` yang sama.
- **Teks statis yang disalin apa adanya** (bukan data): rating "4.9 (480+)" di kartu terlaris, "📍 850 m", "Bogor & Sekitarnya", "Buka: 10.00 – 22.00 WIB" di pilih outlet, "BUKA JAM 14:00" di outlet tutup. Sama-sama belum berbasis data di Android.
- **Badge lonceng notifikasi** belum menyala: jumlah belum-dibaca hanya diambil bila ada sesi (Fase 3/5).

### Fase 3 (bagian 1) — keranjang & checkout (2026-09-22)

- **Hasil:** 127 uji unit (22 suite) + 3 uji perjalanan lulus di simulator (instalasi bersih); build Debug & Release tanpa peringatan. `ValidasiPesanTest` (9/9) diporting.
- **Uji perjalanan baru:** (1) keranjang → checkout ditolak karena harga berubah → "Pakai harga baru" → validasi ulang lolos → tombol bayar aktif; (2) tanpa sesi, "Lanjut Pembayaran" membawa ke Masuk, bukan checkout.
- **`SkenarioUji` (Debug saja).** Checkout butuh sesi, sedangkan login belum ada. Argumen `-skenarioUji checkout-ok|checkout-masalah` memalsukan HANYA `POST /api/v1/checkout/validate` (endpoint lain tetap produksi) dan menganggap sesi ada. Dibungkus `#if DEBUG`; diverifikasi tidak ada satu string pun di biner Release.
- **Tanpa `CartViewModel`.** Di Android ViewModel itu ada hanya untuk menyegarkan tampilan setelah `CartStore` berubah (`segarkan()` dipanggil manual di 4 tempat). Di iOS `CartStore` sudah `@Observable`, jadi semua layar mengikuti otomatis — satu kelas lebih sedikit dan satu kelas bug (lupa menyegarkan) hilang.
- **Perbaikan kecil dibanding Android:**
  - Checkout yang keranjangnya habis dikosongkan kini **membuang total lama** juga (Android me-reset seluruh state — perilakunya dipertahankan, hanya ditulis eksplisit dan diuji).
  - **Hasil validasi lama yang datang terlambat dibuang** (penanda generasi). Di Android, dua ketukan "perbaiki" beruntun menjalankan dua validasi bersamaan dan yang selesai terakhir menang, meski itu yang lebih lama.
  - **401 di checkout** menampilkan "Sesi berakhir" + tombol "Masuk lagi" (Android menampilkan galat umum dengan "Coba lagi" yang pasti gagal lagi).
- **Rute baru:** `checkout`, `masuk(tujuan:)` (penanda sampai login jadi), `bayar` (penanda Fase 4).
- **Sisa Fase 3:** layar Masuk + GoogleSignIn-iOS, gerbang awal (tanpa sesi → Masuk), `tujuan` checkout. Semuanya menunggu **iOS client ID Google** (§5 butir 1).

### Fase 3 (bagian 2) — form profil / Informasi Akun (2026-09-22)

- **Hasil:** 142 uji unit (25 suite) + 4 uji perjalanan lulus (instalasi bersih); Debug & Release tanpa peringatan. `ProfilFormTest` (5/5) dan `InformasiAkunTest` (5/5) diporting.
- **Layar:** Nama & No WhatsApp bisa diubah, Email terkunci (identitas akun Google). Validasi di aplikasi = cermin `retail-gateway/src/lib/profil.ts` (nama 2–60 huruf; nomor HP Indonesia → `628…`), gateway tetap penentu. Hanya field yang berubah yang dikirim; nomor dikirim apa adanya, gateway yang menormalkan. Setelah tersimpan, nama/nomor di sesi Keychain ikut diperbarui.
- **Pintu masuk sementara:** tab Profil (penanda Fase 5) menampilkan tombol "Informasi Akun" hanya bila ada sesi. Tanpa login sungguhan, layar ini baru bisa dicapai lewat `SkenarioUji`.
- **`SkenarioUji` diperluas:** kini juga memalsukan `GET|PATCH /api/v1/customer/profile`, dan memakai **sesi palsu di item Keychain terpisah** (`…session.skenario-uji`) — sesi sungguhan tak tersentuh, sesi palsu tak bocor ke peluncuran normal. Tetap `#if DEBUG`; diverifikasi tidak ada di biner Release.
- **Khas iOS:** papan angka telepon tak punya tombol Enter, jadi ditambah tombol "Selesai" di atas papan ketik; isian memakai `textContentType` (.name / .telephoneNumber) agar iOS bisa menawarkan isi-otomatis.
- **Pelajaran uji perjalanan:** simulator berbahasa Indonesia ("Pilih Semua", bukan "Select All") — kolom dikosongkan dengan tombol hapus, bukan menu teks, agar uji tak bergantung bahasa.

### Fase 4 — pembayaran QRIS & sukses (2026-09-22)

- **Hasil:** 167 uji unit (29 suite) + 5 uji perjalanan lulus (instalasi bersih); Debug & Release tanpa peringatan. `IdempotensiTest` (8/8) dan `NasibPercobaanTest` (8/8) diporting.
- **Aturan tagihan ganda dipertahankan persis:** `client_order_id` disimpan SEBELUM permintaan dikirim; id hanya diganti pada `pesanan_kadaluarsa` (atau status `kadaluarsa`); percobaan tertinggal diperiksa dulu — masih hidup → QR yang sama ditampilkan lagi, tak ada pesanan kedua; galat saat memeriksa → pantau, jangan menagih ulang. Semuanya kini diuji di `PaymentViewModelTests` (Android tak punya uji untuk ViewModel ini).
- **Penanyaan status:** 3 dtk selama menit pertama, lalu 10 dtk, berhenti di 15 menit (= umur draft & QR di gateway). Habis waktu ≠ gagal → arahkan ke riwayat. Galat jaringan saat bertanya tidak menghentikan penanyaan.
- **QRIS digambar CoreImage** (koreksi galat M, hitam-putih, latar putih dipaksa, tanpa interpolasi). Halaman Xendit cadangan dibuka `SFSafariViewController` hanya bila tidak ada QR, otomatis sekali saja.
- **Uji perjalanan pembayaran** memakai `SkenarioUji` yang kini juga memalsukan `POST /api/v1/orders` & `GET /api/v1/orders/{id}` — **tidak ada pesanan atau tagihan sungguhan** yang terbit dari uji. Diverifikasi: tak satu pun string skenario ada di biner Release.
- **Beda sengaja dengan Android (⚠️ layak diperbaiki juga di Android):**
  - **"Cek Status Pembayaran"** di Android memanggil `bayar()` lagi: mengirim ulang pesanan (aman karena idempoten) TAPI menyalakan putaran penanyaan KEDUA yang berjalan bersamaan. Di iOS tombol itu hanya menanyakan status sekali, dan penanyaan selalu satu putaran.
  - **"Batalkan Pembayaran"** di Android hanya kembali ke ringkasan (tagihan & QR tetap berlaku). Di iOS labelnya "Kembali ke Ringkasan" agar sesuai perilakunya.
  - **NMID "ID1024398182901"** yang tertulis tetap di layar bayar Android **tidak disalin**: angka itu tidak berasal dari QR, dan menampilkan ID merchant yang mungkin salah di layar pembayaran berisiko. Perlu dikonfirmasi owner — kalau NMID asli, bisa ditambahkan kembali.
  - **Hitung mundur** memakai `expires_at` dari gateway bila terbaca (Android selalu 15:00 sejak layar dibuka, sehingga pelanggan yang kembali ke percobaan lama melihat waktu yang salah).
- **Sisa di Fase 5:** layar Status Pesanan (tombol "Lihat Status Pesanan" di layar sukses masih ke penanda).

### Fase 5 — riwayat, status pesanan, notifikasi, profil (2026-09-22)

- **Hasil:** 187 uji unit (34 suite) + 6 uji perjalanan lulus (instalasi bersih); Debug & Release tanpa peringatan. `StatusPesananTest` (9/9) dan `NotificationFilterTest` (4/4) diporting — **kini seluruh 18 berkas uji Android sudah punya padanan**, kecuali `SmokeTest` (diganti uji konfigurasi) dan `ColorContrastTest` (Fase 6).
- **Riwayat:** filter Semua / Sedang Berjalan / Selesai / Dibatalkan; pesanan berjalan tampil sebagai kartu besar. Tanpa sesi (401) tampil "Masuk dulu", bukan galat umum.
- **Status pesanan:** disegarkan tiap 10 dtk selama berjalan, **berhenti sendiri** saat selesai/dibatalkan (diuji), dan berhenti saat layar ditutup (`.task`). Galat jaringan **mempertahankan** nomor pesanan di layar (diuji).
- **Notifikasi:** tab Semua / Pesanan / Promo & Info, "Baca Semua", tandai dibaca optimistis; ketuk → status pesanan atau tab Menu. Titik lonceng di Beranda kini hidup (diambil saat mulai bila ada sesi).
- **Pengaturan notifikasi** tampil sebagai lembar bawah (idiom iOS) alih-alih dialog.
- **Belum ada penanda "Segera hadir" tersisa kecuali layar Masuk.**
- **Beda sengaja dengan Android (⚠️ layak diperbaiki juga di Android):**
  - **Profil menampilkan angka karangan** di Android: "12 Pesanan Selesai" dan "Outlet Favorit: Bogor Pajajaran" tertulis tetap untuk SEMUA pelanggan. Di iOS: jumlah pesanan selesai dihitung dari riwayat sungguhan, dan "Outlet Pilihan" = outlet yang sedang dipilih.
  - **Lencana "TERVERIFIKASI"** di nomor HP tidak disalin — tidak ada proses verifikasi nomor sama sekali.
  - **Empat menu bantuan** (FAQ, Customer Care, Kebijakan Privasi, Syarat & Ketentuan) tidak disalin — di Android keempatnya tidak melakukan apa pun. Catatan: App Store **mewajibkan** tautan Kebijakan Privasi (Fase 6) — butuh URL dari owner.
  - **"QRIS Lunas"** di layar status hanya muncul bila `status == dibayar` (Android selalu menuliskannya, juga untuk pesanan yang belum dibayar).
  - **Waktu pesanan & notifikasi** ditampilkan (WIB, bahasa Indonesia) — di Android `created_at` diterima tapi tak pernah ditampilkan.
  - **Keluar dari akun** meminta konfirmasi dulu (Android langsung keluar), lalu kembali ke Beranda (layar Masuk belum ada).

### Fase 6 (bagian 1) — aksesibilitas, ikon, kesiapan App Store (2026-09-22)

- **Hasil:** 195 uji unit (35 suite) + 7 uji perjalanan lulus (instalasi bersih); Debug & Release tanpa peringatan. `ColorContrastTest` (4/4) diporting — **ke-18 berkas uji Android kini semuanya punya padanan iOS.**
- **🔴 Temuan kontras (berlaku juga di Android):** audit semua pasangan warna teks/latar yang benar-benar dipakai layar, bukan hanya 4 yang diuji Android:
  - `sukaMuted` `#9A7A63` (semua teks sekunder) hanya **3,5–3,9:1** di putih/krem → gagal WCAG AA (4,5:1). iOS: digelapkan ke **`#826754`** (hue sama) → 4,7–5,2:1.
  - **Teks oranye** `#F29744` di latar terang ("Lihat Semua", rating, harga topping terpilih, status "Sedang dibuat" di riwayat) hanya **2,0–2,3:1**. iOS: token baru **`sukaOrangeTeks` `#A8560B`** khusus teks; `sukaOrange` tetap untuk isian, tombol, ikon, dan teks di atas cokelat (5,1:1).
  - Merah batal `#DC2626` di latar merah muda 4,4:1 → **`sukaMerah` `#D32222`**.
  - `ColorContrastTests` kini mengunci semua kombinasi itu. ⚠️ Layak diterapkan juga di `customer-app/ui/theme/Color.kt`.
- **Teks besar (Dynamic Type):** semua huruf memakai `relativeTo:`, jadi ikut setelan "Teks Lebih Besar". Uji perjalanan baru `AksesibilitasUITests` menjalankan ukuran **Accessibility L** dan menyimpan tangkapan layar Beranda→Menu→Detail→Keranjang→Checkout. Empat tempat rusak lalu dibatasi (isi layar tetap membesar penuh): bilah tab (label terpotong "Beran/da" → batas `.xLarge`, seperti UITabBar bawaan), pil keranjang melayang (menutupi menu → `.xxLarge`), bilah tombol bawah (label terpotong → `.accessibility1` + penyusutan), teks banner di atas gambar (menabrak gambar → `.xxLarge`). Kepala cokelat dibatasi `.xxxLarge`.
- **VoiceOver:** tombol ikon punya label (Kembali, Tutup, Notifikasi + jumlah belum dibaca, Profil…), status terpilih memakai `.isSelected`, judul kepala `.isHeader`, rangka pemuat dibacakan satu kalimat, popup promo `.isModal`.
- **Ikon aplikasi** 1024×1024 dari logo resmi di atas cokelat Suka (Android masih ikon bawaan sistem). Sumber logo hanya 307 px — lihat §5 butir 5.
- **Kesiapan App Store:** `PrivacyInfo.xcprivacy` (UserDefaults CA92.1, atribut berkas C617.1; data dikumpulkan: nama, email, no HP, riwayat pembelian — terhubung ke akun, hanya fungsi aplikasi, **tanpa pelacakan**); `ITSAppUsesNonExemptEncryption = NO` (hanya HTTPS); `DEVELOPMENT_TEAM` & `CODE_SIGN_STYLE: Automatic` disiapkan di `project.yml`.
- **Belum bisa dikerjakan tanpa pihak luar:**
  1. **Login Google** (Fase 3) — iOS client ID.
  2. **Sign in with Apple** — wajib App Store (pedoman 4.8) bila ada login Google; butuh endpoint gateway baru (mis. `POST /api/v1/auth/apple`) + capability di akun Apple Developer.
  3. **iPhone fisik & TestFlight** — Team ID Apple Developer.
  4. **URL Kebijakan Privasi** untuk App Store Connect.

### Fase 3 (bagian 3) — layar Masuk: Google + Apple (2026-09-22)

- **Hasil:** 207 uji unit (38 suite) + 7 uji perjalanan lulus; Debug & Release tanpa peringatan. **Tidak ada lagi layar "Segera hadir"** — `SegeraView` dihapus.
- **Layar Masuk** (padanan `LoginScreen.kt`): ilustrasi, "Selamat Datang!", tombol **Masuk dengan Google** dan **Masuk dengan Apple** berukuran sama (pedoman 4.8 — penonjolan setara), persetujuan ketentuan, kotak galat yang bisa ditutup. Tombol "WhatsApp · segera hadir" Android tidak disalin (tombol mati).
- **Google tanpa SDK:** `ASWebAuthenticationSession` + PKCE S256 (RFC 7636/8252) → kode → `oauth2.googleapis.com/token` → **ID token Google** → `POST /api/v1/auth/google` yang SAMA dengan Android. Dibanding GoogleSignIn-iOS: hasil sama, tanpa 4 dependensi (AppAuth, GTMAppAuth, GTMSessionFetcher, GoogleSignIn). `state` diperiksa (anti-CSRF); **tanpa nonce** (sama dengan Android). PKCE diuji dengan vektor resmi RFC 7636.
- **Apple:** `SignInWithAppleButton`, nonce mentah → gateway, SHA-256-nya → Apple; nama ikut dikirim pada masuk pertama. Entitlement `com.apple.developer.applesignin` di `Config/SukaShawarma.entitlements`.
- **Pesan yang tepat:** batal = tanpa pesan merah; 401 dari gateway = "<Google/Apple> menolak masuk" (bukan "sesi berakhir"); 404 `auth/apple` = "belum tersedia"; client ID kosong = "belum diaktifkan".
- **Setelah masuk:** dari checkout kembali ke checkout (`tujuan`), selain itu kembali ke layar asal; jumlah notifikasi belum dibaca langsung diambil.
- **⚠️ Beda sengaja: TANPA gerbang masuk di awal.** Android membuka layar Masuk saat belum ada sesi. Pedoman App Store **5.1.1(v)** menolak aplikasi yang mewajibkan akun hanya untuk menjelajah. Di iOS pelanggan menjelajah menu bebas; masuk diminta tepat saat butuh akun (checkout, riwayat, profil).
- **Belum bisa diuji ujung-ke-ujung:** Google butuh iOS client ID; Apple butuh endpoint gateway + App ID dengan capability Sign in with Apple. Yang diuji: seluruh logika (PKCE, URL, callback, nonce, pertukaran ke gateway lewat gateway palsu) dan tampilan layar.
- **Catatan uji perjalanan:** dua uji sempat gagal karena gateway produksi sesaat tak terjangkau (aplikasi menampilkan "Tidak bisa terhubung" dengan benar); diulang dan lulus. Uji perjalanan bergantung jaringan & data produksi — kegagalan tunggal perlu diulang sebelum disimpulkan sebagai bug.

### Perbaikan: bilah status cokelat + ikon putih (2026-09-22)

- **Masalah:** di Beranda area bilah status (jam, sinyal, baterai) berwarna krem dengan ikon hitam, karena kepala Beranda ada di dalam ScrollView sehingga latarnya tak menjangkau ke belakang bilah status. Layar berkepala krem (bayar, status pesanan, sukses, masuk, pilih outlet) juga krem di sana.
- **Perbaikan:** `latarBilahStatus()` (UI/Theme/SukaGaya.swift) menggambar strip `#4A0E03` (warna teratas gradien kepala, jadi menyatu) setinggi bilah status di layar-layar tadi; ikon bilah status dibuat **putih** di seluruh aplikasi.
- **Gotcha (sudah dicoba, tidak berhasil):**
  - `UIStatusBarStyle` + `UIViewControllerBasedStatusBarAppearance = NO` di Info.plist **diabaikan** iOS terbaru. Yang bekerja: `.preferredColorScheme(.dark)` di akar (gaya bilah status mengikuti skema jendela) + `.environment(\.colorScheme, .light)` agar seluruh isi tetap terang. Konsekuensi: papan ketik & dialog sistem (mis. konfirmasi "Keluar") tampil gelap.
  - Strip setinggi 0 + `ignoresSafeArea`, maupun `GeometryReader.safeAreaInsets`, memberi tinggi 0 di layar yang akarnya sudah selayar penuh. Tinggi diambil dari `UIWindow.safeAreaInsets.top`.
