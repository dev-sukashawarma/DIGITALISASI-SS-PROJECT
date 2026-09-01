# SukaShawarma APP — Rencana Implementasi Tahap 1b: Aplikasi Android

> **Untuk pekerja agentik:** SUB-SKILL WAJIB: pakai superpowers:subagent-driven-development (disarankan) atau superpowers:executing-plans untuk mengeksekusi rencana ini per-task. Langkah memakai checkbox (`- [ ]`) untuk pelacakan.

**Goal:** Aplikasi Android pelanggan yang bisa dipakai memesan dan membayar shawarma, mengonsumsi Retail Gateway yang sudah selesai di Tahap 1a.

**Architecture:** Kotlin + Jetpack Compose, satu modul. Aplikasi berbicara **hanya** ke Retail Gateway lewat HTTP; ia tidak memegang kredensial database apa pun dan tidak memuat SDK Supabase. Login Google memakai Credential Manager (native, bukan redirect browser); ID token ditukar ke Gateway yang mengembalikan token sesi. Seluruh logika harga, promo, dan validasi ada di server — aplikasi hanya menampilkan.

**Tech Stack:** Kotlin, Jetpack Compose (Material 3), Navigation Compose, Ktor Client + kotlinx.serialization, Coil, Credential Manager + Google ID, DataStore (EncryptedSharedPreferences untuk token), Firebase Cloud Messaging.

**Spec:** `SUKASHAWARMA MOBILE APP RETAIL/docs/2026-09-01-sukashawarma-app-design.md`

**Kontrak API:** `SUKASHAWARMA MOBILE APP RETAIL/docs/2026-09-01-tahap1-gateway-plan.md` — dan kode nyatanya di `apps/retail-gateway/src/app/api/`. **Bila rencana ini dan kode gateway berbeda, kode gateway yang benar.**

**Desain layar:** `SUKASHAWARMA MOBILE APP RETAIL/design/` (kanvas 16 layar, artboard `Main.dc.html` bisa diklik)

---

## Global Constraints

- **Aplikasi TIDAK BOLEH memuat SDK Supabase atau kredensial database apa pun.** Tidak ada anon key, tidak ada service role, tidak ada URL Supabase di APK. Satu-satunya alamat yang dikenal aplikasi adalah domain Retail Gateway.
- **Total yang ditampilkan aplikasi tidak mengikat.** Server yang menghitung. Aplikasi boleh menghitung untuk ditampilkan cepat, tapi angka yang dipakai membayar SELALU yang dikembalikan `POST /api/v1/orders`.
- **`client_order_id` adalah UUID SEKALI PAKAI.** Buat baru setiap kali pelanggan menekan bayar. Pada 409 `pesanan_kadaluarsa` → buat id baru sebelum mencoba lagi. Pada 409 `pesanan_sedang_diproses` → tunggu lalu ulangi dengan id **yang sama**.
- **Warna terkunci, tidak boleh ditawar:** tombol utama `#701604` (Suka Brown) dengan teks putih (kontras 11,6:1). Aksen `#f29744` (Suka Orange) SELALU dengan teks `#400a07` (Suka Ink) — **tidak pernah teks putih di atas oranye** (2,3:1, gagal WCAG). Latar `#fff7ed`. Sukses/buka `#0a7d2c`.
- **Sasaran sentuh minimal 44dp.** Ukuran teks minimum 14sp; harga tidak pernah di bawah 16sp.
- **Jangan menggambar status bar atau keyboard palsu.** Sistem yang menggambarnya.
- **Radius konsisten:** kartu 16dp, tombol pill penuh, input 12dp. Tidak dicampur.
- **Seluruh teks pengguna berbahasa Indonesia.**
- **Ikon dari `androidx.compose.material.icons.extended`.** Jangan menggambar path SVG sendiri.
- Nilai build mengikuti `mobile/native-superapp`: compileSdk 36, minSdk 24, targetSdk 36, jvmTarget 17, dan version catalog `gradle/libs.versions.toml`.

---

## Yang TIDAK termasuk Tahap 1b

- **Layar 3 & 4 (Input Nomor, OTP WhatsApp)** — WhatsApp Business API menunggu verifikasi Meta. Desainnya sudah ada dan tetap berlaku; dipasang saat akun disetujui. Tahap 1b: login Google saja.
- Poin, tier, dompet, bundle, referral, misi (Tahap 2 & 3)
- iOS
- Penjadwalan waktu ambil dan pra-pesan

Jadi Tahap 1b membangun **14 dari 16 layar**.

---

## Struktur File

Aplikasi ditempatkan di `mobile/customer-app/` — sejajar dengan `mobile/native-superapp`, mengikuti konvensi repo. **Bukan** di dalam `mobile/native-superapp` (audiensnya berbeda: pelanggan publik vs staf).

| File | Tanggung jawab |
|---|---|
| `mobile/customer-app/app/build.gradle.kts` | Manifest modul |
| `.../data/api/GatewayClient.kt` | Satu-satunya tempat yang tahu HTTP dan alamat gateway |
| `.../data/api/Dto.kt` | Bentuk balasan gateway, `@Serializable`, cerminan kode gateway |
| `.../data/api/GatewayError.kt` | Amplop galat + pemetaan kode mesin (`pesanan_kadaluarsa`, dll) |
| `.../data/SessionStore.kt` | Simpan/baca token sesi terenkripsi |
| `.../data/CartStore.kt` | Keranjang lokal, bertahan lintas proses |
| `.../data/Repository.kt` | Satu muka untuk seluruh UI; UI tidak pernah memanggil `GatewayClient` langsung |
| `.../ui/theme/` | Warna, tipografi, bentuk — diturunkan dari arah visual terkunci |
| `.../ui/components/` | Tombol, kartu menu, penanda status, keadaan kosong/galat |
| `.../ui/screens/<nama>/` | Satu folder per layar: `Screen.kt` + `ViewModel.kt` |
| `.../ui/Navigation.kt` | Graf navigasi |
| `.../MainActivity.kt` | Titik masuk |

**Aturan pemisahan:** UI tidak pernah menyentuh `GatewayClient` langsung, selalu lewat `Repository`. Itu yang membuat penanganan galat, penyegaran token, dan mode luring bisa diubah di satu tempat.

---

## Task 1: Scaffold proyek Android

**Files:**
- Create: `mobile/customer-app/settings.gradle.kts`, `build.gradle.kts`, `gradle.properties`, `gradle/libs.versions.toml`
- Create: `mobile/customer-app/app/build.gradle.kts`, `app/src/main/AndroidManifest.xml`
- Create: `mobile/customer-app/app/src/main/java/com/sukashawarma/customer/MainActivity.kt`
- Test: `mobile/customer-app/app/src/test/java/com/sukashawarma/customer/SmokeTest.kt`

**Interfaces:**
- Produces: proyek Gradle yang bisa `assembleDebug` dan `testDebugUnitTest`

- [ ] **Step 1: Salin kerangka Gradle dari native-superapp**

Baca `mobile/native-superapp/app/build.gradle.kts`, `build.gradle.kts`, `settings.gradle.kts`, `gradle.properties`, dan `gradle/libs.versions.toml`. Tiru strukturnya, **bukan isinya secara buta**: ambil versi plugin, compileSdk 36, minSdk 24, targetSdk 36, jvmTarget 17, dan pola version catalog.

Yang **berbeda** dari native-superapp:
- `namespace` dan `applicationId` = `com.sukashawarma.customer`
- **JANGAN** menyertakan dependensi Supabase (`supabase.bom`, `supabase.postgrest`, `supabase.auth`, `supabase.realtime`, `supabase.storage`) maupun TensorFlow. Aplikasi pelanggan tidak menyentuh database dan tidak melakukan pengenalan wajah.
- **Tambahkan** ke version catalog dan modul: Ktor client (`ktor-client-android`, `ktor-client-content-negotiation`, `ktor-serialization-kotlinx-json`), `androidx.datastore:datastore-preferences`, `androidx.security:security-crypto`, `androidx.credentials:credentials` + `credentials-play-services-auth` + `googleid`.

- [ ] **Step 2: Tulis test asap yang gagal**

```kotlin
// app/src/test/java/com/sukashawarma/customer/SmokeTest.kt
package com.sukashawarma.customer

import org.junit.Assert.assertEquals
import org.junit.Test

class SmokeTest {
    @Test
    fun `proyek terpasang dan test berjalan`() {
        assertEquals(4, 2 + 2)
    }
}
```

- [ ] **Step 3: Jalankan test**

Run: `cd mobile/customer-app && ./gradlew testDebugUnitTest`
Expected: PASS

> **Gotcha lingkungan (dari CLAUDE.md, terbukti di mesin ini):** JBR bawaan rusak. Set `JAVA_HOME=C:\Program Files\Android\Android Studio1\jbr`. Gradle juga butuh `TEMP`/`TMP=C:\t` karena loopback NIO gagal di path panjang. Kalau build gagal dengan galat path atau JVM, periksa keduanya sebelum menduga kode.

- [ ] **Step 4: Verifikasi tidak ada Supabase di dependensi**

```bash
cd mobile/customer-app && ./gradlew :app:dependencies --configuration releaseRuntimeClasspath | grep -i supabase && echo "GAGAL: Supabase ikut terbawa" || echo "OK: nol Supabase"
```
Expected: `OK: nol Supabase`

- [ ] **Step 5: Commit**

```bash
git add mobile/customer-app
git commit -m "feat(customer-app): scaffold aplikasi Android pelanggan"
```

---

## Task 2: Sistem desain

**Files:**
- Create: `.../ui/theme/Color.kt`, `Type.kt`, `Shape.kt`, `Theme.kt`
- Create: `app/src/main/res/font/` (Lilita One, Plus Jakarta Sans)
- Test: `.../ui/theme/ColorContrastTest.kt`

**Interfaces:**
- Produces: `SukaTheme { }`, dan token `SukaBrown`, `SukaOrange`, `SukaInk`, `SukaCream`, `SukaGreen`

- [ ] **Step 1: Tulis test kontras yang gagal**

Warna adalah aturan keamanan di aplikasi ini, bukan selera — jadi dikunci test.

```kotlin
// app/src/test/java/com/sukashawarma/customer/ui/theme/ColorContrastTest.kt
package com.sukashawarma.customer.ui.theme

import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.pow

private fun luminansi(rgb: Long): Double {
    fun kanal(c: Int): Double {
        val s = c / 255.0
        return if (s <= 0.03928) s / 12.92 else ((s + 0.055) / 1.055).pow(2.4)
    }
    val r = kanal(((rgb shr 16) and 0xFF).toInt())
    val g = kanal(((rgb shr 8) and 0xFF).toInt())
    val b = kanal((rgb and 0xFF).toInt())
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

private fun kontras(a: Long, b: Long): Double {
    val la = luminansi(a); val lb = luminansi(b)
    val terang = maxOf(la, lb); val gelap = minOf(la, lb)
    return (terang + 0.05) / (gelap + 0.05)
}

class ColorContrastTest {
    private val brown = 0x701604L
    private val orange = 0xF29744L
    private val ink = 0x400A07L
    private val putih = 0xFFFFFFL
    private val cream = 0xFFF7EDL

    @Test
    fun `tombol utama coklat dengan teks putih lulus AAA`() {
        assertTrue(kontras(brown, putih) >= 7.0)
    }

    @Test
    fun `aksen oranye dengan teks ink lulus AAA`() {
        assertTrue(kontras(orange, ink) >= 7.0)
    }

    @Test
    fun `teks putih di atas oranye GAGAL - kombinasi ini dilarang`() {
        assertTrue(
            "Kalau ini lulus, seseorang mengubah palet. Teks putih di atas oranye tidak terbaca di bawah matahari.",
            kontras(orange, putih) < 4.5
        )
    }

    @Test
    fun `teks ink di atas krem lulus AAA`() {
        assertTrue(kontras(cream, ink) >= 7.0)
    }
}
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `./gradlew testDebugUnitTest --tests "*ColorContrastTest*"`
Expected: FAIL — kelas belum ada

- [ ] **Step 3: Implementasi token warna**

```kotlin
// app/src/main/java/com/sukashawarma/customer/ui/theme/Color.kt
package com.sukashawarma.customer.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * Palet terkunci. Angka kontrasnya sudah dihitung dan dikunci oleh
 * ColorContrastTest — jangan ubah tanpa menjalankan test itu.
 *
 * Aturan yang tidak boleh dilanggar: teks putih TIDAK PERNAH di atas
 * SukaOrange (kontras 2,3:1). Oranye selalu membawa SukaInk.
 */
val SukaBrown = Color(0xFF701604)   // tombol utama, teks putih  — 11,6:1
val SukaOrange = Color(0xFFF29744)  // aksen & harga, teks ink   —  7,3:1
val SukaInk = Color(0xFF400A07)     // teks utama
val SukaCream = Color(0xFFFFF7ED)   // latar
val SukaGreen = Color(0xFF0A7D2C)   // sukses, outlet buka

val SukaCard = Color(0xFFFFFFFF)
val SukaBorder = Color(0xFFF1DDC9)
val SukaMuted = Color(0xFF9A7A63)
val SukaBody = Color(0xFF6B5548)
val SukaTint = Color(0xFFFDF0E2)
```

Lalu `Type.kt` (Lilita One untuk angka & judul pendek, Plus Jakarta Sans untuk body), `Shape.kt` (kartu 16dp, input 12dp, tombol `CircleShape`), dan `Theme.kt` yang merangkainya jadi `SukaTheme`.

Unduh kedua font dari Google Fonts sebagai `.ttf` ke `app/src/main/res/font/`. Kalau tidak bisa mengunduh di lingkungan ini, laporkan sebagai NEEDS_CONTEXT — **jangan** mengganti dengan font sistem diam-diam, karena Lilita One adalah bagian identitas yang sudah disetujui.

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `./gradlew testDebugUnitTest --tests "*ColorContrastTest*"`
Expected: PASS 4/4

- [ ] **Step 5: Commit**

```bash
git add mobile/customer-app/app/src
git commit -m "feat(customer-app): sistem desain dengan kontras warna terkunci test"
```

---

## Task 3: Addendum Gateway — daftar riwayat pesanan

**Files:**
- Create: `apps/retail-gateway/src/app/api/v1/orders/list/route.ts`

**Interfaces:**
- Produces: `GET /api/v1/orders/list` → `{ orders: [{ id, status, status_dapur, total_amount, pos_order_number, outlet_name, created_at }] }`

**Kenapa task ini ada di rencana Android:** review akhir Tahap 1a menemukan layar Riwayat (layar 14) tidak punya endpoint — hanya ada `GET /orders/[id]`. Ditunda saat itu karena bukan pemblokir gateway. Sekarang ia pemblokir, jadi dikerjakan di sini.

> **Catatan rute:** ditempatkan di `/orders/list`, bukan `GET /orders`, karena `src/app/api/v1/orders/route.ts` sudah ada dan hanya mengekspor `POST`. Menambahkan `GET` di file itu juga sah — pilih salah satu, tapi **verifikasi dulu** file mana yang ada sebelum menulis.

- [ ] **Step 1: Implementasi**

```typescript
// apps/retail-gateway/src/app/api/v1/orders/list/route.ts
import { NextResponse } from 'next/server'
import { requireCustomer } from '@/lib/auth'
import { createServiceClient, createRetailClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const BATAS = 30

export async function GET(request: Request) {
  const sesi = await requireCustomer(request)
  if (!sesi) return NextResponse.json({ error: 'Sesi tidak sah' }, { status: 401 })

  const retail = createRetailClient()

  // Selalu dibatasi ke pemilik token. Gateway memakai service role yang
  // melewati RLS, jadi tanpa filter ini seluruh riwayat pelanggan lain terbuka.
  const { data: drafts, error } = await retail
    .from('order_drafts')
    .select('id, status, total_amount, outlet_id, pos_order_id, pos_order_number, created_at')
    .eq('customer_id', sesi.customerId)
    .order('created_at', { ascending: false })
    .limit(BATAS)

  if (error) {
    console.error('gagal memuat riwayat pesanan', error)
    return NextResponse.json({ error: 'Gagal memuat riwayat' }, { status: 502 })
  }

  const baris = drafts ?? []
  if (baris.length === 0) return NextResponse.json({ orders: [] })

  const db = createServiceClient()

  const outletIds = Array.from(new Set(baris.map((d) => d.outlet_id)))
  const { data: outlets } = await db
    .from('outlets')
    .select('id, name')
    .in('id', outletIds)
  const namaOutlet = new Map((outlets ?? []).map((o) => [o.id, o.name]))

  const posIds = baris.map((d) => d.pos_order_id).filter((v): v is string => Boolean(v))
  const statusDapur = new Map<string, string>()
  if (posIds.length > 0) {
    const { data: pos } = await db.from('orders').select('id, status').in('id', posIds)
    for (const p of pos ?? []) statusDapur.set(p.id, p.status)
  }

  return NextResponse.json({
    orders: baris.map((d) => ({
      id: d.id,
      status: d.status,
      status_dapur: d.pos_order_id ? statusDapur.get(d.pos_order_id) ?? null : null,
      total_amount: d.total_amount,
      pos_order_number: d.pos_order_number,
      outlet_name: namaOutlet.get(d.outlet_id) ?? null,
      created_at: d.created_at,
    })),
  })
}
```

- [ ] **Step 2: Type-check dan build**

Run: `cd apps/retail-gateway && ../../node_modules/.bin/tsc --noEmit && yarn build`
Expected: 0 error, route `/api/v1/orders/list` muncul di keluaran

- [ ] **Step 3: Commit**

```bash
git add apps/retail-gateway/src/app/api/v1/orders/list
git commit -m "feat(retail-gateway): endpoint daftar riwayat pesanan untuk layar Riwayat"
```

---

## Task 4: Klien API dan penyimpanan sesi

**Files:**
- Create: `.../data/api/Dto.kt`, `GatewayError.kt`, `GatewayClient.kt`
- Create: `.../data/SessionStore.kt`
- Test: `.../data/api/GatewayErrorTest.kt`

**Interfaces:**
- Consumes: kontrak API dari `apps/retail-gateway/src/app/api/`
- Produces:
  - `sealed class GatewayError { data class Kode(val kode: String, val pesan: String); data class Jaringan(...); data class Server(...); object SesiTidakSah }`
  - `petakanGalat(status: Int, body: String?): GatewayError`
  - `GatewayClient` dengan fungsi per endpoint
  - `SessionStore.simpan(token, expiresAt)`, `.baca()`, `.hapus()`

- [ ] **Step 1: Tulis test pemetaan galat yang gagal**

Pemetaan galat ini yang menentukan apakah aplikasi berperilaku benar saat gateway menolak. Kode mesinnya sudah pasti — diambil dari kode gateway nyata.

```kotlin
// app/src/test/java/com/sukashawarma/customer/data/api/GatewayErrorTest.kt
package com.sukashawarma.customer.data.api

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class GatewayErrorTest {

    @Test
    fun `401 selalu berarti sesi tidak sah`() {
        assertEquals(GatewayError.SesiTidakSah, petakanGalat(401, """{"error":"Sesi tidak sah"}"""))
    }

    @Test
    fun `409 pesanan kadaluarsa dikenali sebagai kode mesin`() {
        val hasil = petakanGalat(409, """{"error":"pesanan_kadaluarsa","pesan":"Pesanan sebelumnya sudah kedaluwarsa."}""")
        assertTrue(hasil is GatewayError.Kode)
        assertEquals("pesanan_kadaluarsa", (hasil as GatewayError.Kode).kode)
    }

    @Test
    fun `409 pesanan sedang diproses dikenali sebagai kode mesin`() {
        val hasil = petakanGalat(409, """{"error":"pesanan_sedang_diproses","pesan":"Coba lagi sebentar."}""")
        assertEquals("pesanan_sedang_diproses", (hasil as GatewayError.Kode).kode)
    }

    @Test
    fun `galat berupa kalimat bebas tetap terbaca, bukan crash`() {
        val hasil = petakanGalat(409, """{"error":"Outlet sedang tidak bisa menerima pesanan"}""")
        assertTrue(hasil is GatewayError.Kode)
        assertEquals("Outlet sedang tidak bisa menerima pesanan", (hasil as GatewayError.Kode).pesan)
    }

    @Test
    fun `502 dipetakan sebagai galat server, bukan kesalahan pengguna`() {
        assertTrue(petakanGalat(502, """{"error":"Gagal memuat menu"}""") is GatewayError.Server)
    }

    @Test
    fun `body kosong atau bukan JSON tidak membuat aplikasi crash`() {
        assertTrue(petakanGalat(500, null) is GatewayError.Server)
        assertTrue(petakanGalat(500, "<html>gateway timeout</html>") is GatewayError.Server)
    }
}
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `./gradlew testDebugUnitTest --tests "*GatewayErrorTest*"`
Expected: FAIL — kelas belum ada

- [ ] **Step 3: Implementasi amplop galat**

```kotlin
// app/src/main/java/com/sukashawarma/customer/data/api/GatewayError.kt
package com.sukashawarma.customer.data.api

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

sealed class GatewayError {
    /**
     * Gateway menolak dengan alasan yang bisa ditindak. `kode` bisa berupa
     * kode mesin (`pesanan_kadaluarsa`) atau kalimat bebas — gateway memakai
     * keduanya. Cocokkan kode mesin dulu; kalau tidak dikenal, tampilkan
     * `pesan` apa adanya.
     */
    data class Kode(val kode: String, val pesan: String) : GatewayError()

    data class Jaringan(val sebab: Throwable) : GatewayError()
    data class Server(val status: Int) : GatewayError()
    object SesiTidakSah : GatewayError()
}

private val json = Json { ignoreUnknownKeys = true }

fun petakanGalat(status: Int, body: String?): GatewayError {
    if (status == 401) return GatewayError.SesiTidakSah
    if (status >= 500) return GatewayError.Server(status)

    val terurai = runCatching { json.parseToJsonElement(body ?: "").jsonObject }.getOrNull()
        ?: return GatewayError.Server(status)

    val kode = terurai["error"]?.jsonPrimitive?.contentOrNull ?: return GatewayError.Server(status)
    val pesan = terurai["pesan"]?.jsonPrimitive?.contentOrNull ?: kode

    return GatewayError.Kode(kode, pesan)
}
```

> Impor `contentOrNull` dari `kotlinx.serialization.json`. Kalau nama itu tidak ada di versi yang terpasang, pakai `.content` dengan `runCatching` — laporkan penyesuaiannya, jangan diam-diam.

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `./gradlew testDebugUnitTest --tests "*GatewayErrorTest*"`
Expected: PASS 6/6

- [ ] **Step 5: Implementasi DTO dan klien**

`Dto.kt` mencerminkan balasan gateway **persis**. Baca `apps/retail-gateway/src/app/api/**/route.ts` dan salin bentuknya; jangan mengarang nama field. Yang wajib ada:

| Endpoint | Balasan sukses |
|---|---|
| `POST /api/v1/auth/google` | `{ token, expires_at, customer: { id, name, email, phone } }` |
| `GET /api/v1/outlets` | `{ outlets: [{ id, name, address, lat, lng, is_active }] }` |
| `GET /api/v1/catalog?outlet_id=` | `{ items: [{ id, name, description, price, image_url, is_available, category_id, sort_order }] }` |
| `POST /api/v1/checkout/validate` | sukses `{ ok: true, subtotal, discountAmount, total }` · gagal-bisnis HTTP 200 `{ ok: false, alasan, pesan?, masalah? }` |
| `POST /api/v1/orders` | `{ order_id, payment_url, total_amount, expires_at, duplicate? }` |
| `GET /api/v1/orders/{id}` | `{ id, status, status_dapur, total_amount, pos_order_number, outlet_name, created_at }` |
| `GET /api/v1/orders/list` | `{ orders: [ ...seperti di atas ] }` |

> **Perhatikan:** `checkout/validate` memakai `discountAmount` (camelCase) sedangkan endpoint lain memakai `total_amount` (snake_case). Itu ketidakseragaman nyata di gateway yang sudah tercatat sebagai temuan tertunda — **cerminkan apa adanya**, jangan "diperbaiki" di sisi Android.

`GatewayClient` memakai Ktor dengan `ContentNegotiation(Json { ignoreUnknownKeys = true })`, timeout 15 detik, dan menyisipkan `Authorization: Bearer <token>` dari `SessionStore` untuk seluruh endpoint kecuali `auth/google`, `catalog`, dan `outlets`.

`SessionStore` menyimpan token di `EncryptedSharedPreferences`. **Jangan** menyimpannya di `SharedPreferences` biasa atau DataStore tanpa enkripsi — token itu setara identitas pelanggan.

- [ ] **Step 6: Commit**

```bash
git add mobile/customer-app/app/src
git commit -m "feat(customer-app): klien gateway, pemetaan galat, penyimpanan sesi terenkripsi"
```

---

## Task 5: Login Google

**Files:**
- Create: `.../ui/screens/onboarding/OnboardingScreen.kt` (layar 1)
- Create: `.../ui/screens/login/LoginScreen.kt`, `LoginViewModel.kt` (layar 2)
- Create: `.../data/GoogleSignIn.kt`

**Interfaces:**
- Consumes: `GatewayClient.loginGoogle(idToken)`, `SessionStore`
- Produces: `LoginViewModel.state: StateFlow<LoginState>`

- [ ] **Step 1: Implementasi pengambilan ID token**

Pakai **Credential Manager**, bukan `GoogleSignInClient` yang sudah usang, dan bukan alur redirect browser. Yang benar: bottom sheet muncul di dalam aplikasi, pelanggan menekan sekali, aplikasi menerima ID token.

```kotlin
// app/src/main/java/com/sukashawarma/customer/data/GoogleSignIn.kt
package com.sukashawarma.customer.data

import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential

/**
 * Mengambil ID token Google lewat Credential Manager. Token ini TIDAK
 * dipakai aplikasi untuk apa pun selain ditukar ke gateway — aplikasi tidak
 * pernah berbicara ke Supabase.
 */
suspend fun ambilIdTokenGoogle(context: Context, serverClientId: String): String {
    val opsi = GetGoogleIdOption.Builder()
        .setServerClientId(serverClientId)
        .setFilterByAuthorizedAccounts(false)
        .setAutoSelectEnabled(true)
        .build()

    val permintaan = GetCredentialRequest.Builder().addCredentialOption(opsi).build()
    val hasil = CredentialManager.create(context).getCredential(context, permintaan)

    val kredensial = GoogleIdTokenCredential.createFrom(hasil.credential.data)
    return kredensial.idToken
}
```

`serverClientId` adalah **Web client ID** dari Google Cloud project yang sama dengan yang dikonfigurasi di provider Google Supabase — bukan Android client ID. Salah satu di antaranya membuat pertukaran token ditolak dengan pesan yang membingungkan. Simpan sebagai `BuildConfig` field dari `local.properties`, jangan di-hardcode.

- [ ] **Step 2: Layar Onboarding dan Login**

Ikuti artboard `Onboarding.dc.html` dan `Login.dc.html` di `SUKASHAWARMA MOBILE APP RETAIL/design/`. Yang wajib ada di Login: tombol Google (putih, border), dan **ruang untuk tombol WhatsApp yang belum aktif** — jangan menghapus tempatnya dari tata letak, karena akan dipasang saat akun Meta disetujui.

Tombol "Lihat menu dulu" harus benar-benar bekerja: pelanggan boleh masuk ke katalog tanpa login. Login baru diminta di titik bayar.

- [ ] **Step 3: Verifikasi manual di perangkat**

Belum ada test otomatis untuk alur ini (butuh perangkat dan akun Google nyata). Jalankan di HP dan pastikan: bottom sheet muncul **di dalam aplikasi** (bukan membuka Chrome), dan setelah memilih akun, aplikasi menerima token sesi dari gateway.

Kalau gateway membalas 401 "Login Google gagal", penyebab paling umum adalah `serverClientId` salah jenis — periksa itu sebelum menduga hal lain.

- [ ] **Step 4: Commit**

```bash
git add mobile/customer-app/app/src
git commit -m "feat(customer-app): login Google lewat Credential Manager"
```

---

## Task 6: Katalog dan pilih outlet

**Files:**
- Create: `.../ui/screens/catalog/CatalogScreen.kt`, `CatalogViewModel.kt` (layar 5)
- Create: `.../ui/screens/outlet/OutletPickerScreen.kt`, `OutletPickerViewModel.kt` (layar 6)
- Create: `.../ui/screens/closed/OutletClosedScreen.kt` (layar 16)
- Create: `.../ui/components/MenuCard.kt`, `OutletHeader.kt`, `EmptyState.kt`, `ErrorState.kt`
- Test: `.../ui/screens/catalog/KatalogFilterTest.kt`

**Interfaces:**
- Consumes: `Repository.outlets()`, `Repository.katalog(outletId)`
- Produces: `kelompokkanPerKategori(items): List<KategoriMenu>`

- [ ] **Step 1: Tulis test pengelompokan yang gagal**

```kotlin
// app/src/test/java/com/sukashawarma/customer/ui/screens/catalog/KatalogFilterTest.kt
package com.sukashawarma.customer.ui.screens.catalog

import com.sukashawarma.customer.data.api.MenuItemDto
import org.junit.Assert.assertEquals
import org.junit.Test

private fun item(id: String, nama: String, kategori: String?, urut: Int?, tersedia: Boolean = true) =
    MenuItemDto(
        id = id, name = nama, description = null, price = 25000.0,
        imageUrl = null, isAvailable = tersedia, categoryId = kategori, sortOrder = urut
    )

class KatalogFilterTest {

    @Test
    fun `mengelompokkan per kategori dan mengurutkan sesuai sort_order`() {
        val hasil = kelompokkanPerKategori(
            listOf(
                item("b", "Kebab Mini", "c1", 2),
                item("a", "Shawarma Ayam Original", "c1", 1),
                item("c", "Es Teh Manis", "c2", 1),
            )
        )
        assertEquals(2, hasil.size)
        assertEquals(listOf("a", "b"), hasil[0].items.map { it.id })
    }

    @Test
    fun `item tanpa kategori masuk kelompok Lainnya, bukan hilang`() {
        val hasil = kelompokkanPerKategori(listOf(item("a", "Tanpa kategori", null, 1)))
        assertEquals(1, hasil.size)
        assertEquals(1, hasil[0].items.size)
    }

    @Test
    fun `item habis tetap ditampilkan, tidak disembunyikan`() {
        val hasil = kelompokkanPerKategori(listOf(item("a", "Habis", "c1", 1, tersedia = false)))
        assertEquals(1, hasil[0].items.size)
    }

    @Test
    fun `sort_order null diletakkan di akhir, bukan menyebabkan crash`() {
        val hasil = kelompokkanPerKategori(
            listOf(item("a", "Tanpa urutan", "c1", null), item("b", "Punya urutan", "c1", 1))
        )
        assertEquals(listOf("b", "a"), hasil[0].items.map { it.id })
    }
}
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `./gradlew testDebugUnitTest --tests "*KatalogFilterTest*"`
Expected: FAIL

- [ ] **Step 3: Implementasi**

Item habis **ditampilkan tapi diredupkan dan tidak bisa ditambahkan** — menyembunyikannya membuat pelanggan mengira menu itu tidak pernah ada dan bertanya-tanya. Gateway sudah gagal-tertutup untuk ketersediaan yang tidak diketahui, jadi apa pun yang bertanda tersedia memang benar-benar tersedia saat katalog diambil.

Layar Outlet Belum Buka (16) muncul ketika outlet terpilih `is_active` bernilai false. Keranjang **tetap tersimpan**, dan tombolnya "Ingatkan saya saat buka" — bukan mengosongkan keranjang.

> **Keterbatasan yang diketahui:** gateway tidak menyimpan jam buka-tutup harian; `is_active` hanya berarti "outlet beroperasi". Jam 14:00 di layar ini adalah nilai tetap dari sisi aplikasi sampai sumber data jam buka tersedia. Jangan berpura-pura server yang menentukannya.

- [ ] **Step 4: Jalankan test dan commit**

```bash
./gradlew testDebugUnitTest --tests "*KatalogFilterTest*"
git add mobile/customer-app/app/src
git commit -m "feat(customer-app): katalog, pilih outlet, dan keadaan outlet belum buka"
```

---

## Task 7: Detail item dan keranjang

**Files:**
- Create: `.../ui/screens/detail/ItemDetailScreen.kt`, `ItemDetailViewModel.kt` (layar 7)
- Create: `.../ui/screens/cart/CartScreen.kt`, `CartViewModel.kt` (layar 8)
- Create: `.../data/CartStore.kt`
- Test: `.../data/CartStoreTest.kt`

**Interfaces:**
- Produces: `CartStore.tambah(item, qty, catatan)`, `.ubahJumlah(index, delta)`, `.isi(): List<CartLine>`, `.kosongkan()`, `.subtotal(): Long`

- [ ] **Step 1: Tulis test keranjang yang gagal**

```kotlin
// app/src/test/java/com/sukashawarma/customer/data/CartStoreTest.kt
package com.sukashawarma.customer.data

import org.junit.Assert.assertEquals
import org.junit.Test

class CartStoreTest {

    private fun keranjang() = CartStore.diMemori()

    @Test
    fun `menambah item yang sama tanpa catatan menggabungkan jumlahnya`() {
        val k = keranjang()
        k.tambah("m1", "Shawarma Ayam Original", 25000, 1, null)
        k.tambah("m1", "Shawarma Ayam Original", 25000, 2, null)
        assertEquals(1, k.isi().size)
        assertEquals(3, k.isi()[0].jumlah)
    }

    @Test
    fun `item sama dengan catatan berbeda adalah baris terpisah`() {
        val k = keranjang()
        k.tambah("m1", "Shawarma Ayam Original", 25000, 1, null)
        k.tambah("m1", "Shawarma Ayam Original", 25000, 1, "Jangan pedas")
        assertEquals(2, k.isi().size)
    }

    @Test
    fun `mengurangi jumlah sampai nol menghapus barisnya`() {
        val k = keranjang()
        k.tambah("m1", "Shawarma Ayam Original", 25000, 1, null)
        k.ubahJumlah(0, -1)
        assertEquals(0, k.isi().size)
    }

    @Test
    fun `jumlah tidak pernah melebihi 99 karena gateway menolaknya`() {
        val k = keranjang()
        k.tambah("m1", "Shawarma Ayam Original", 25000, 99, null)
        k.ubahJumlah(0, 1)
        assertEquals(99, k.isi()[0].jumlah)
    }

    @Test
    fun `subtotal menjumlahkan harga kali jumlah`() {
        val k = keranjang()
        k.tambah("m1", "Shawarma Ayam Original", 25000, 2, null)
        k.tambah("m2", "Es Teh Manis", 8000, 1, null)
        assertEquals(58000L, k.subtotal())
    }
}
```

Batas 99 bukan angka sembarangan: `jumlahWajar()` di gateway menolak jumlah di luar 1..99. Menahannya di aplikasi berarti pelanggan tidak pernah melihat galat yang tidak bisa dipahaminya.

- [ ] **Step 2-4: Jalankan gagal → implementasi → jalankan lulus**

`CartStore` bertahan lintas proses (DataStore) supaya keranjang tidak hilang saat aplikasi ditutup — spesifikasi §5.4 menjanjikan keranjang tersimpan saat outlet belum buka.

Layar detail memuat tambahan (Extra Keju, Extra Kentang), catatan, dan stepper jumlah, sesuai artboard. **Catatan dipotong 200 karakter di aplikasi** — gateway juga memotongnya, tapi memotong lebih awal berarti pelanggan melihat batasnya, bukan diam-diam kehilangan teks.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(customer-app): detail item dan keranjang yang bertahan lintas proses"
```

---

## Task 8: Checkout dan validasi pra-bayar

**Files:**
- Create: `.../ui/screens/checkout/CheckoutScreen.kt`, `CheckoutViewModel.kt` (layar 9)
- Test: `.../ui/screens/checkout/ValidasiPesanTest.kt`

**Interfaces:**
- Consumes: `Repository.validasiCheckout(outletId, items)`
- Produces: `pesanUntukMasalah(masalah): String`

- [ ] **Step 1: Tulis test pesan yang gagal**

Balasan `ok: false` dari gateway datang dengan HTTP **200**, bukan galat. Aplikasi harus memperlakukannya sebagai hasil bisnis yang perlu ditampilkan, bukan kegagalan jaringan.

```kotlin
// app/src/test/java/com/sukashawarma/customer/ui/screens/checkout/ValidasiPesanTest.kt
package com.sukashawarma.customer.ui.screens.checkout

import com.sukashawarma.customer.data.api.MasalahKeranjangDto
import org.junit.Assert.assertTrue
import org.junit.Test

class ValidasiPesanTest {

    @Test
    fun `item habis dijelaskan dengan namanya`() {
        val p = pesanUntukMasalah(MasalahKeranjangDto("m1", "Shawarma Ayam Original", "habis", null))
        assertTrue(p.contains("Shawarma Ayam Original"))
        assertTrue(p.contains("habis"))
    }

    @Test
    fun `harga berubah menyebutkan harga barunya`() {
        val p = pesanUntukMasalah(MasalahKeranjangDto("m1", "Shawarma Ayam Original", "harga_berubah", 28000.0))
        assertTrue(p.contains("28.000"))
    }

    @Test
    fun `item yang sudah tidak ada dijelaskan tanpa istilah teknis`() {
        val p = pesanUntukMasalah(MasalahKeranjangDto("m1", "Menu Lama", "tidak_ada", null))
        assertTrue(p.contains("Menu Lama"))
        assertTrue(!p.contains("tidak_ada"))
    }

    @Test
    fun `jenis masalah yang tidak dikenal tetap menghasilkan kalimat, bukan kosong`() {
        val p = pesanUntukMasalah(MasalahKeranjangDto("m1", "Sesuatu", "jenis_baru", null))
        assertTrue(p.isNotBlank())
    }
}
```

- [ ] **Step 2-4: Jalankan gagal → implementasi → jalankan lulus**

Saat validasi mengembalikan masalah, layar checkout menampilkan setiap item bermasalah dengan tombol tindakan (hapus / perbarui harga), lalu memvalidasi ulang. **Jangan** langsung membuang keranjang.

Total yang ditampilkan adalah yang dikembalikan gateway (`total`), bukan hitungan aplikasi.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(customer-app): checkout dengan validasi pra-bayar dan pemulihan keranjang"
```

---

## Task 9: Pembayaran

**Files:**
- Create: `.../ui/screens/payment/PaymentMethodScreen.kt` (layar 10)
- Create: `.../ui/screens/payment/PaymentWaitScreen.kt`, `PaymentViewModel.kt` (layar 11)
- Test: `.../ui/screens/payment/IdempotensiTest.kt`

**Interfaces:**
- Consumes: `Repository.buatPesanan(clientOrderId, outletId, items, phone)`
- Produces: `PaymentViewModel` yang menegakkan kontrak `client_order_id`

- [ ] **Step 1: Tulis test kontrak idempotensi yang gagal**

Ini bagian paling mudah salah di seluruh aplikasi. Kontraknya ditegakkan test.

```kotlin
// app/src/test/java/com/sukashawarma/customer/ui/screens/payment/IdempotensiTest.kt
package com.sukashawarma.customer.ui.screens.payment

import com.sukashawarma.customer.data.api.GatewayError
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class IdempotensiTest {

    @Test
    fun `pesanan_kadaluarsa WAJIB menghasilkan client_order_id baru`() {
        val lama = "9197d153-2a29-4ca8-a123-a4a6ff8e1cbf"
        val baru = idBerikutnya(lama, GatewayError.Kode("pesanan_kadaluarsa", "kedaluwarsa"))
        assertNotEquals(lama, baru)
    }

    @Test
    fun `pesanan_sedang_diproses WAJIB memakai id yang SAMA`() {
        val lama = "9197d153-2a29-4ca8-a123-a4a6ff8e1cbf"
        val baru = idBerikutnya(lama, GatewayError.Kode("pesanan_sedang_diproses", "tunggu"))
        assertEquals(lama, baru)
    }

    @Test
    fun `galat jaringan memakai id yang sama - percobaan ulang harus idempoten`() {
        val lama = "9197d153-2a29-4ca8-a123-a4a6ff8e1cbf"
        assertEquals(lama, idBerikutnya(lama, GatewayError.Jaringan(RuntimeException())))
    }

    @Test
    fun `galat server memakai id yang sama`() {
        val lama = "9197d153-2a29-4ca8-a123-a4a6ff8e1cbf"
        assertEquals(lama, idBerikutnya(lama, GatewayError.Server(500)))
    }
}
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

- [ ] **Step 3: Implementasi**

```kotlin
/**
 * Menentukan client_order_id untuk percobaan berikutnya.
 *
 * `client_order_id` adalah kunci idempotensi SEKALI PAKAI di gateway.
 * Memakai ulang id setelah draftnya kedaluwarsa akan mengunci pelanggan:
 * gateway membalas 409 selamanya dan pesanan tidak akan pernah bisa dibuat.
 * Sebaliknya, membuat id baru saat percobaan sebelumnya masih diproses akan
 * menghasilkan DUA tagihan.
 */
fun idBerikutnya(idSekarang: String, galat: GatewayError): String =
    when {
        galat is GatewayError.Kode && galat.kode == "pesanan_kadaluarsa" ->
            java.util.UUID.randomUUID().toString()
        else -> idSekarang
    }
```

- [ ] **Step 4: Layar pembayaran**

Gateway mengembalikan `payment_url` dari Xendit. Buka dengan **Custom Tabs**, bukan WebView sendiri — halaman pembayaran memuat 3-D Secure dan aplikasi e-wallet, dan WebView buatan sendiri sering memblokirnya.

Setelah pelanggan kembali, aplikasi **tidak boleh menganggap pembayaran berhasil**. Ia menanyakan `GET /api/v1/orders/{id}` secara berkala (setiap 3 detik, maksimal 5 menit) sampai `status` berubah jadi `dibayar`. Kebenarannya ada di webhook Xendit → gateway, bukan di aplikasi.

Layar 10 (Pilih Metode) menampilkan pilihan yang tersedia; karena Xendit Invoice sudah menyajikan pemilih metodenya sendiri, layar ini boleh langsung meneruskan ke `payment_url`. **Verifikasi dulu** perilaku nyata Xendit sebelum memutuskan menghapus layar itu.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(customer-app): pembayaran Xendit dengan kontrak idempotensi ditegakkan test"
```

---

## Task 10: Sukses, status pesanan, riwayat, profil

**Files:**
- Create: `.../ui/screens/success/SuccessScreen.kt` (layar 12)
- Create: `.../ui/screens/status/OrderStatusScreen.kt`, `OrderStatusViewModel.kt` (layar 13)
- Create: `.../ui/screens/history/HistoryScreen.kt`, `HistoryViewModel.kt` (layar 14)
- Create: `.../ui/screens/profile/ProfileScreen.kt`, `ProfileViewModel.kt` (layar 15)

**Interfaces:**
- Consumes: `Repository.statusPesanan(id)`, `Repository.riwayat()`

- [ ] **Step 1: Layar Sukses**

Nomor pesanan (`pos_order_number`) ditampilkan **sebesar mungkin** — itu satu-satunya hal yang dibutuhkan pelanggan di depan kasir. Plus QR yang memuat nomor yang sama.

Nomor ini berasal dari `orders.order_number`: berurutan per outlet, diisi trigger database, dan sudah dipakai kasir sehari-hari. Tidak ada kode ambil terpisah — versi awal rencana punya kode 4 digit sendiri, tapi itu nomor kedua untuk pesanan yang sudah punya nomor, dan ia bertabrakan. Sudah dibuang dari gateway.

> **Jangan menghardcode panjang nomor di tata letak.** `order_number` tumbuh seiring waktu — outlet ramai bisa mencapai lima digit. Tata letaknya harus menampung itu.

- [ ] **Step 2: Status pesanan**

Timeline tiga tahap: Diterima → Sedang dibuat → Siap diambil, dipetakan dari `status_dapur` yang dikembalikan gateway (nilai dari POS: `preparing`, dst). **Verifikasi nilai nyatanya** di `apps/pos-kasir` sebelum memetakan — jangan menebak nama status.

- [ ] **Step 3: Riwayat**

Memakai `GET /api/v1/orders/list` dari Task 3. Tombol "Pesan Lagi" mengisi ulang keranjang dari pesanan lama, lalu **memvalidasi ulang** — harga dan ketersediaan bisa sudah berubah.

- [ ] **Step 4: Profil**

Nama, email, dan nomor HP. Nomor bersifat opsional dan divalidasi bentuknya di gateway (`08xxx`/`+62xxx`); tampilkan galat kalau ditolak. Sertakan spanduk halus "nomormu belum ditambahkan" sesuai artboard — tapi **jangan** menghalangi apa pun karenanya.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(customer-app): sukses, status pesanan, riwayat, dan profil"
```

---

## Task 11: Notifikasi status pesanan

**Files:**
- Create: `.../data/PushService.kt`
- Modify: `app/src/main/AndroidManifest.xml`
- Modify: `apps/retail-gateway` — pengiriman notifikasi saat status berubah

**Interfaces:**
- Produces: pendaftaran token FCM ke gateway; penanganan pesan masuk

- [ ] **Step 1: Putuskan sumber pemicu**

Spesifikasi §7.4 mewajibkan empat notifikasi: pesanan diterima, siap diambil, pengingat 30 menit, dan peringatan sebelum outlet tutup. Ketiga yang terakhir dipicu oleh perubahan di sisi POS, bukan oleh aplikasi.

**Ini berarti gateway butuh cara mengetahui status POS berubah.** Dua pilihan, keduanya belum dibangun:
1. Cron gateway memeriksa `orders.status` berkala untuk pesanan aktif
2. Trigger/realtime dari POS ke gateway

**Task ini WAJIB dimulai dengan memilih salah satu dan mencatat alasannya**, bukan langsung mengoding. Kalau bukti tidak cukup untuk memutuskan, laporkan sebagai BLOCKED dengan pilihan yang sudah dianalisis — jangan menebak.

- [ ] **Step 2-4:** Implementasi sesuai keputusan Step 1, ditambah pendaftaran token FCM dan izin `POST_NOTIFICATIONS` (Android 13+).

Notifikasi pemasaran **harus bisa dimatikan terpisah** dari notifikasi pesanan — dua kanal notifikasi berbeda, bukan satu.

- [ ] **Step 5: Commit**

---

## Task 12: Rilis

**Files:**
- Create: `mobile/customer-app/app/proguard-rules.pro`
- Modify: `app/build.gradle.kts` (signing, minify)

- [ ] **Step 1: Build rilis**

```bash
cd mobile/customer-app && ./gradlew assembleRelease
```

- [ ] **Step 2: Verifikasi tidak ada rahasia di APK**

```bash
unzip -p app/build/outputs/apk/release/app-release.apk classes.dex | strings | grep -iE "supabase|service_role|eyJ" | head
```
Expected: kosong. Kalau ada yang muncul, **berhenti** — ada kredensial yang bocor ke APK, melanggar batasan global pertama.

- [ ] **Step 3: Uji lapangan di outlet pilot**

Satu transaksi nyata bernilai kecil, dengan kasir yang sudah dilatih. Verifikasi berurutan: pesanan muncul di layar kasir · nomor pesanan cocok dengan yang ditampilkan aplikasi · stok bahan baku terpotong · notifikasi status sampai.

- [ ] **Step 4: Commit dan siapkan Play Console**

---

## Prasyarat sebelum Tahap 1b bisa diuji

Rencana ini bisa **ditulis dan dikodekan** sekarang, tapi **tidak bisa diuji** sampai Tahap 1a benar-benar hidup:

1. Migration `20300119000000` diterapkan ke database (sebelum jam 12:00, saat outlet tutup)
2. Skema `retail` ditambahkan ke Exposed Schemas di panel Supabase
3. Cron `/api/cron/expire-drafts` dijadwalkan
4. Env var di-set dan gateway di-deploy di Coolify

Tanpa keempatnya, setiap panggilan API dari aplikasi akan gagal.

---

## Catatan Verifikasi Mandiri

| Bagian spesifikasi | Task |
|---|---|
| §3.1 Login Google native | 5 |
| §4.1 Alur pesan sampai ambil | 6, 7, 8, 9, 10 |
| §4.2 Validasi pra-bayar ditampilkan ke pelanggan | 8 |
| §4.3 Kontrak idempotensi `client_order_id` | 9 |
| §5.4 Keranjang bertahan saat outlet belum buka | 6, 7 |
| §7.2 Kode pengambilan | 10 |
| §7.4 Empat notifikasi | 11 |
| Arah visual & aturan kontras | 2 |
| Layar 14 (Riwayat) | 3 (addendum gateway), 10 |

**Sengaja tidak tercakup:** layar 3 & 4 (OTP WhatsApp, menunggu akun Meta), poin & tier (Tahap 2), bundle & referral (Tahap 3), iOS.
