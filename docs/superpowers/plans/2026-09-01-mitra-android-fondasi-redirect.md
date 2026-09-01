# Fondasi & Redirect Mitra (Android) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Akun ber-role `mitra` yang login di app Android langsung mendarat di layar mitra, tidak pernah melihat daftar aplikasi maupun modul Absensi.

**Architecture:** Profil mitra (`mitra_profiles`) dimuat ke `AppSession` sesudah `StaffProfile`, hanya bila role = MITRA, di dua jalur masuk (login manual & auto-login). Satu fungsi murni `resolveStartDestination()` di `core:roles` jadi satu-satunya penentu tujuan navigasi, dipakai `RootNav` maupun callback login. Modul baru `feature:mitra` menyediakan tiga layar sesuai keadaan profil (ada / tidak ada / gagal dimuat).

**Tech Stack:** Kotlin, Jetpack Compose (BOM 2024.02.00), Navigation Compose 2.7.7, Hilt 2.51, OkHttp + Gson lewat `Postgrest`, JUnit 4.13.2.

**Spec:** `docs/superpowers/specs/2026-09-01-mitra-android-fondasi-redirect-design.md`

**Repo:** `SUPER-APPS-SS-MOBILE/` (repo Android terpisah, di-clone di dalam worktree ini). Semua path di rencana ini relatif terhadap root repo itu, kecuali disebut lain.

## Global Constraints

- `compileSdk = 34`, `minSdk = 26`, `JavaVersion.VERSION_17`, `jvmTarget = "17"` — sama persis untuk setiap modul baru.
- Compose BOM `2024.02.00`, `kotlinCompilerExtensionVersion = "1.5.8"`.
- **Package tidak sama dengan path.** Repo ini konsisten memakai package `com.sukashawarma.superapp.domain.*` / `data.*` / `presentation.*` walau direktorinya `core/<x>/` atau `feature/<x>/`. Ikuti pola itu; jangan "merapikan" agar cocok, nanti tak seragam dengan tetangganya.
- Enum `Role` sudah punya `MITRA`. **Jangan** menambah atau mengubah entri `Role` — berkas itu cermin `packages/auth/src/types.ts` di monorepo web.
- Semua akses DB lewat `object Postgrest` (`core:network`). Jangan bikin interface Retrofit baru.
- Bahasa UI: Indonesia.
- Build env mesin dev: `JAVA_HOME=C:\Program Files\Android\Android Studio1\jbr`, dan `TEMP`/`TMP` harus diset ke path pendek (mis. `C:\t`) atau Gradle gagal di NIO loopback.

## Struktur Berkas

| Berkas | Tanggung jawab |
|---|---|
| `core/roles/.../core/roles/model/MitraProfile.kt` (baru) | Model profil mitra + parser dari baris PostgREST. Murni, tanpa I/O. |
| `core/roles/.../core/roles/repository/MitraRepository.kt` (baru) | Satu query `mitra_profiles` by `user_id`. Tipis; semua pemetaan ada di model. |
| `core/roles/.../core/roles/session/StartDestination.kt` (baru) | Enum tujuan + `resolveStartDestination()`. Murni, tanpa Android/Compose. |
| `core/roles/.../core/roles/session/AppSession.kt` (ubah) | Tambah `mitraProfile` + `mitraLoadFailed`, dimuat di `login()` dan `tryAutoLogin()`. |
| `core/roles/build.gradle.kts` (ubah) | Tambah `testImplementation` JUnit. |
| `feature/mitra/` (modul baru) | Tiga layar keadaan mitra. |
| `app/.../presentation/MainActivity.kt` (ubah) | Rute `MITRA`, NavHost per-role. |
| `app/build.gradle.kts` (ubah) | Daftarkan `:feature:mitra`. |
| `settings.gradle.kts` (ubah) | `include(":feature:mitra")`. |

**Peringatan:** `app/build.gradle.kts` punya **dua** blok `dependencies { }` berisi daftar `project(...)` yang identik (sekitar baris 121–137 dan 139–156). Itu duplikasi yang sudah ada sebelumnya — jangan dirapikan di rencana ini (di luar cakupan), tapi **tambahkan `:feature:mitra` ke keduanya** supaya tak ada keadaan setengah jalan yang membingungkan.

---

### Task 0: Prasyarat data di DB produksi (GERBANG MANUAL)

**Tidak ada kode.** Task ini tidak boleh dijalankan oleh agen. Ia butuh persetujuan eksplisit pemilik produk karena menulis ke DB produksi dan menentukan siapa yang bisa melihat angka bagi hasil.

**Files:** tidak ada.

**Interfaces:**
- Consumes: —
- Produces: keadaan DB di mana tepat 9 akun `role='mitra'` berstatus `active`, masing-masing punya tepat satu baris `mitra_profiles`.

- [ ] **Step 1: Minta persetujuan eksplisit**

Tunjukkan kedua pernyataan SQL di Step 3 dan Step 5 ke pemilik produk. Jangan lanjut tanpa persetujuan tertulis di percakapan.

- [ ] **Step 2: Rekam keadaan awal (untuk pemulihan)**

```bash
supabase --experimental db query "select os.username, os.status, mp.id as profile_id, mp.user_id from outlet_staff os left join mitra_profiles mp on mp.user_id = os.id where os.role = 'mitra' order by os.username" --linked
```

Simpan keluarannya. Ini satu-satunya jalan pulang kalau langkah berikutnya keliru.

- [ ] **Step 3: Pindahkan profil Cileungsi ke `mitra_wati`**

Urutan wajib: pemindahan **sebelum** penonaktifan. Terbalik, `mitra_cileungsi` dinonaktifkan selagi masih memegang profilnya dan outlet Cileungsi kehilangan akses sepenuhnya.

```sql
update mitra_profiles
set user_id = (select id from outlet_staff where username = 'mitra_wati' and role = 'mitra')
where user_id = (select id from outlet_staff where username = 'mitra_cileungsi' and role = 'mitra');
```

- [ ] **Step 4: Verifikasi pemindahan SEBELUM menonaktifkan**

```bash
supabase --experimental db query "select os.username, (mp.id is not null) as punya_profil from outlet_staff os left join mitra_profiles mp on mp.user_id = os.id where os.username in ('mitra_wati','mitra_cileungsi')" --linked
```

Harapan: `mitra_wati` menjadi `true`, `mitra_cileungsi` menjadi `false`. Kalau tidak sesuai, **berhenti** dan pulihkan dari Step 2.

- [ ] **Step 5: Nonaktifkan 9 akun generik**

```sql
update outlet_staff
set status = 'inactive'
where role = 'mitra'
  and username in (
    'mitra_cibinong','mitra_cibubur','mitra_cicurug','mitra_ciseeng',
    'mitra_kalisari','mitra_paledang','mitra_pekayon','mitra_sentul','mitra_cileungsi'
  );
```

- [ ] **Step 6: Verifikasi keadaan akhir**

```bash
supabase --experimental db query "select count(*) filter (where os.status='active') as aktif, count(*) filter (where os.status='active' and mp.id is null) as aktif_tanpa_profil from outlet_staff os left join mitra_profiles mp on mp.user_id = os.id where os.role='mitra'" --linked
```

Harapan: `aktif = 9`, `aktif_tanpa_profil = 0`.

**Risiko diketahui:** `last_sign_in_at` akun generik belum pernah diperiksa. Kalau ternyata ada mitra yang masih login memakai akun generik, ia terkunci keluar tanpa peringatan — di web maupun Android. Periksa dulu bila ragu.

---

### Task 1: Model & repository profil mitra

**Files:**
- Create: `core/roles/src/main/java/com/sukashawarma/superapp/core/roles/model/MitraProfile.kt`
- Create: `core/roles/src/main/java/com/sukashawarma/superapp/core/roles/repository/MitraRepository.kt`
- Create: `core/roles/src/test/java/com/sukashawarma/superapp/core/roles/model/MitraProfileTest.kt`
- Modify: `core/roles/build.gradle.kts`

**Interfaces:**
- Consumes: `Postgrest.selectOne(table, params)` dari package `com.sukashawarma.superapp.data.remote`; helper `optString`/`optDouble`/`optJsonArray` dari `JsonExt.kt` (package sama).
- Produces:
  - `data class MitraProfile(id: String, userId: String, namaMitra: String, outletIds: List<String>, profitSharingPct: Double?, bankName: String?, bankAccountNumber: String?, bankAccountHolder: String?, noPks: String?, tanggalPks: String?, tanggalBerakhirPks: String?, status: String)` dengan properti `val isAktif: Boolean`
  - `MitraProfile.Companion.fromRow(row: JsonObject): MitraProfile?`
  - `suspend fun MitraRepository.getProfile(userId: String): MitraProfile?`

Nama kolom di bawah sudah diverifikasi ke `information_schema` DB produksi — jangan diubah.

- [ ] **Step 1: Tambah dependensi test ke `core/roles/build.gradle.kts`**

Sisipkan di dalam blok `dependencies { ... }` yang sudah ada, setelah baris `kapt("com.google.dagger:hilt-compiler:2.51")`:

```kotlin
    testImplementation("junit:junit:4.13.2")
```

Gson tidak perlu ditambah: `core:network` sudah mengekspornya lewat `api("com.google.code.gson:gson:2.10.1")`, dan `testImplementation` mewarisi classpath `implementation`.

- [ ] **Step 2: Tulis test yang gagal**

Buat `core/roles/src/test/java/com/sukashawarma/superapp/core/roles/model/MitraProfileTest.kt`:

```kotlin
package com.sukashawarma.superapp.domain.model

import com.google.gson.JsonParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class MitraProfileTest {

    private fun row(json: String) = JsonParser.parseString(json).asJsonObject

    @Test
    fun `baris lengkap dipetakan penuh`() {
        val p = MitraProfile.fromRow(row("""
            {
              "id": "p-1",
              "user_id": "u-1",
              "nama_mitra": "Mitra Paledang",
              "outlet_ids": ["o-1", "o-2"],
              "profit_sharing_pct": 50,
              "bank_name": "BCA",
              "bank_account_number": "123",
              "bank_account_holder": "Bapak Anis",
              "no_pks": "PKS/2026/001",
              "tanggal_pks": "2026-01-01",
              "tanggal_berakhir_pks": "2027-01-01",
              "status": "aktif"
            }
        """))!!

        assertEquals("p-1", p.id)
        assertEquals("u-1", p.userId)
        assertEquals("Mitra Paledang", p.namaMitra)
        assertEquals(listOf("o-1", "o-2"), p.outletIds)
        assertEquals(50.0, p.profitSharingPct!!, 0.001)
        assertEquals("BCA", p.bankName)
        assertEquals("Bapak Anis", p.bankAccountHolder)
        assertTrue(p.isAktif)
    }

    @Test
    fun `mitra satu outlet tetap menghasilkan list berisi satu`() {
        val p = MitraProfile.fromRow(row("""
            {"id":"p-2","user_id":"u-2","nama_mitra":"Mitra Sentul","outlet_ids":["o-9"],"status":"aktif"}
        """))!!
        assertEquals(listOf("o-9"), p.outletIds)
    }

    @Test
    fun `kolom opsional yang null tidak bikin crash`() {
        val p = MitraProfile.fromRow(row("""
            {
              "id":"p-3","user_id":"u-3","nama_mitra":"Mitra Ciseeng","outlet_ids":[],
              "profit_sharing_pct":null,"bank_name":null,"no_pks":null,"status":null
            }
        """))!!
        assertEquals(emptyList<String>(), p.outletIds)
        assertNull(p.profitSharingPct)
        assertNull(p.bankName)
        assertEquals("", p.status)
        assertFalse(p.isAktif)
    }

    @Test
    fun `baris tanpa id atau user_id ditolak`() {
        assertNull(MitraProfile.fromRow(row("""{"user_id":"u-4","nama_mitra":"X","outlet_ids":[]}""")))
        assertNull(MitraProfile.fromRow(row("""{"id":"p-4","nama_mitra":"X","outlet_ids":[]}""")))
    }

    @Test
    fun `status selain aktif berarti tidak aktif`() {
        val p = MitraProfile.fromRow(row("""
            {"id":"p-5","user_id":"u-5","nama_mitra":"Y","outlet_ids":["o-1"],"status":"nonaktif"}
        """))!!
        assertFalse(p.isAktif)
    }
}
```

- [ ] **Step 3: Jalankan test, pastikan GAGAL**

```bash
./gradlew :core:roles:testDebugUnitTest --tests "*MitraProfileTest*"
```

Harapan: gagal kompilasi dengan `Unresolved reference: MitraProfile`.

- [ ] **Step 4: Tulis model + parser**

Buat `core/roles/src/main/java/com/sukashawarma/superapp/core/roles/model/MitraProfile.kt`:

```kotlin
package com.sukashawarma.superapp.domain.model

import com.google.gson.JsonObject
import com.sukashawarma.superapp.data.remote.optDouble
import com.sukashawarma.superapp.data.remote.optJsonArray
import com.sukashawarma.superapp.data.remote.optString

/**
 * Profil kemitraan — cermin tabel `mitra_profiles` yang dipakai portal mitra web
 * (apps/admin-dashboard/src/app/dashboard/mitra). Sumber kebenaran outlet milik
 * mitra adalah `outlet_ids` DI SINI, bukan `outlet_staff.outlet_id`.
 */
data class MitraProfile(
    val id: String,
    val userId: String,
    val namaMitra: String,
    /** Jamak walau semua mitra hari ini punya satu outlet — kolom DB-nya memang array. */
    val outletIds: List<String>,
    val profitSharingPct: Double?,
    val bankName: String?,
    val bankAccountNumber: String?,
    val bankAccountHolder: String?,
    val noPks: String?,
    val tanggalPks: String?,
    val tanggalBerakhirPks: String?,
    val status: String,
) {
    /** DB memakai bahasa Indonesia di kolom ini ('aktif'), bukan 'active' seperti outlet_staff. */
    val isAktif: Boolean get() = status == "aktif"

    companion object {
        /** Kembalikan null bila baris tak punya identitas — lebih baik "tanpa profil"
         *  daripada objek setengah jadi yang bocor ke layar sebagai data kosong. */
        fun fromRow(row: JsonObject): MitraProfile? {
            val id = row.optString("id") ?: return null
            val userId = row.optString("user_id") ?: return null
            return MitraProfile(
                id = id,
                userId = userId,
                namaMitra = row.optString("nama_mitra") ?: "Mitra",
                outletIds = row.optJsonArray("outlet_ids")
                    ?.mapNotNull { el -> el.takeIf { !it.isJsonNull }?.asString }
                    ?: emptyList(),
                profitSharingPct = row.optDouble("profit_sharing_pct"),
                bankName = row.optString("bank_name"),
                bankAccountNumber = row.optString("bank_account_number"),
                bankAccountHolder = row.optString("bank_account_holder"),
                noPks = row.optString("no_pks"),
                tanggalPks = row.optString("tanggal_pks"),
                tanggalBerakhirPks = row.optString("tanggal_berakhir_pks"),
                status = row.optString("status") ?: "",
            )
        }
    }
}
```

- [ ] **Step 5: Jalankan test, pastikan LULUS**

```bash
./gradlew :core:roles:testDebugUnitTest --tests "*MitraProfileTest*"
```

Harapan: 5 test lulus.

- [ ] **Step 6: Tulis repository**

Buat `core/roles/src/main/java/com/sukashawarma/superapp/core/roles/repository/MitraRepository.kt`:

```kotlin
package com.sukashawarma.superapp.data.repository

import com.sukashawarma.superapp.data.remote.Postgrest
import com.sukashawarma.superapp.domain.model.MitraProfile

/**
 * RLS `mitra_profiles_select_own` (`user_id = auth.uid()`) yang membatasi hasilnya,
 * jadi query ini aman dipanggil dengan JWT user biasa — tak perlu service role.
 */
object MitraRepository {

    /** null = user ini memang tidak punya profil mitra. Kegagalan jaringan dilempar
     *  sebagai exception, BUKAN diubah jadi null — pemanggil harus bisa membedakan
     *  "tidak terdaftar" dari "sinyal jelek". */
    suspend fun getProfile(userId: String): MitraProfile? {
        val row = Postgrest.selectOne(
            "mitra_profiles",
            listOf(
                "user_id" to "eq.$userId",
                "select" to "id,user_id,nama_mitra,outlet_ids,profit_sharing_pct," +
                    "bank_name,bank_account_number,bank_account_holder," +
                    "no_pks,tanggal_pks,tanggal_berakhir_pks,status"
            )
        ) ?: return null
        return MitraProfile.fromRow(row)
    }
}
```

- [ ] **Step 7: Pastikan modul tetap terkompilasi**

```bash
./gradlew :core:roles:compileDebugKotlin
```

Harapan: BUILD SUCCESSFUL.

- [ ] **Step 8: Commit**

```bash
git add core/roles/build.gradle.kts core/roles/src/main/java/com/sukashawarma/superapp/core/roles/model/MitraProfile.kt core/roles/src/main/java/com/sukashawarma/superapp/core/roles/repository/MitraRepository.kt core/roles/src/test/java/com/sukashawarma/superapp/core/roles/model/MitraProfileTest.kt
git commit -m "feat(mitra): model MitraProfile + repository baca mitra_profiles"
```

---

### Task 2: Penentu tujuan navigasi (fungsi murni)

**Files:**
- Create: `core/roles/src/main/java/com/sukashawarma/superapp/core/roles/session/StartDestination.kt`
- Create: `core/roles/src/test/java/com/sukashawarma/superapp/core/roles/session/StartDestinationTest.kt`

**Interfaces:**
- Consumes: `StaffProfile` dan `Role` dari `com.sukashawarma.superapp.domain.model`; `MitraProfile` dari Task 1.
- Produces:
  - `enum class StartDestination { LOGIN, HOME, MITRA_DASHBOARD, MITRA_NO_PROFILE, MITRA_LOAD_ERROR }`
  - `fun resolveStartDestination(staff: StaffProfile?, mitraProfile: MitraProfile?, mitraLoadFailed: Boolean): StartDestination`

Fungsi ini **satu-satunya** tempat aturan tujuan hidup. Task 5 memetakannya ke string rute; jangan menduplikasi logikanya di sana.

- [ ] **Step 1: Tulis test yang gagal**

Buat `core/roles/src/test/java/com/sukashawarma/superapp/core/roles/session/StartDestinationTest.kt`:

```kotlin
package com.sukashawarma.superapp.domain.session

import com.sukashawarma.superapp.domain.model.MitraProfile
import com.sukashawarma.superapp.domain.model.Role
import com.sukashawarma.superapp.domain.model.StaffProfile
import org.junit.Assert.assertEquals
import org.junit.Test

class StartDestinationTest {

    private fun staff(role: Role?) = StaffProfile(
        id = "u-1",
        outletId = "o-1",
        outletName = "MITRA PALEDANG",
        name = "Bapak Anis",
        role = role,
        roleRaw = role?.value ?: "",
        status = "active",
        username = "mitra_anis",
        refPhotoUrl = null,
        allowManualButton = false,
        faceDescriptor = null,
    )

    private val profil = MitraProfile(
        id = "p-1",
        userId = "u-1",
        namaMitra = "Mitra Paledang",
        outletIds = listOf("o-1"),
        profitSharingPct = 50.0,
        bankName = "BCA",
        bankAccountNumber = "123",
        bankAccountHolder = "Bapak Anis",
        noPks = null,
        tanggalPks = null,
        tanggalBerakhirPks = null,
        status = "aktif",
    )

    @Test
    fun `tanpa staff selalu ke login`() {
        assertEquals(StartDestination.LOGIN, resolveStartDestination(null, null, false))
        assertEquals(StartDestination.LOGIN, resolveStartDestination(null, profil, true))
    }

    @Test
    fun `mitra dengan profil ke dashboard mitra`() {
        assertEquals(
            StartDestination.MITRA_DASHBOARD,
            resolveStartDestination(staff(Role.MITRA), profil, false)
        )
    }

    @Test
    fun `mitra tanpa profil ke layar penjelas`() {
        assertEquals(
            StartDestination.MITRA_NO_PROFILE,
            resolveStartDestination(staff(Role.MITRA), null, false)
        )
    }

    @Test
    fun `mitra yang profilnya gagal dimuat ke layar galat bukan layar penjelas`() {
        assertEquals(
            StartDestination.MITRA_LOAD_ERROR,
            resolveStartDestination(staff(Role.MITRA), null, true)
        )
    }

    @Test
    fun `role lain tetap ke home meski flag mitra menyala`() {
        assertEquals(StartDestination.HOME, resolveStartDestination(staff(Role.CREW), null, true))
        assertEquals(StartDestination.HOME, resolveStartDestination(staff(Role.SPV), null, false))
        assertEquals(StartDestination.HOME, resolveStartDestination(staff(Role.OWNER), profil, false))
    }

    @Test
    fun `role tak dikenal diperlakukan seperti role biasa`() {
        assertEquals(StartDestination.HOME, resolveStartDestination(staff(null), null, false))
    }
}
```

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

```bash
./gradlew :core:roles:testDebugUnitTest --tests "*StartDestinationTest*"
```

Harapan: gagal kompilasi dengan `Unresolved reference: resolveStartDestination`.

- [ ] **Step 3: Tulis implementasinya**

Buat `core/roles/src/main/java/com/sukashawarma/superapp/core/roles/session/StartDestination.kt`:

```kotlin
package com.sukashawarma.superapp.domain.session

import com.sukashawarma.superapp.domain.model.MitraProfile
import com.sukashawarma.superapp.domain.model.Role
import com.sukashawarma.superapp.domain.model.StaffProfile

enum class StartDestination {
    LOGIN,
    HOME,
    MITRA_DASHBOARD,
    MITRA_NO_PROFILE,
    MITRA_LOAD_ERROR,
}

/**
 * Satu-satunya penentu tujuan setelah sesi siap. RootNav DAN callback login sama-sama
 * memakai ini; dua tempat menebak aturan role sendiri-sendiri adalah persis penyakit
 * yang pernah terjadi di guard approval apps/stok (lihat CLAUDE.md sesi 2026-07-20).
 *
 * Urutan pemeriksaan `mitraLoadFailed` SEBELUM profil-null itu disengaja: mitra dengan
 * sinyal jelek tidak boleh disuruh menelepon admin pusat.
 */
fun resolveStartDestination(
    staff: StaffProfile?,
    mitraProfile: MitraProfile?,
    mitraLoadFailed: Boolean,
): StartDestination {
    if (staff == null) return StartDestination.LOGIN
    if (staff.role != Role.MITRA) return StartDestination.HOME
    if (mitraLoadFailed) return StartDestination.MITRA_LOAD_ERROR
    if (mitraProfile == null) return StartDestination.MITRA_NO_PROFILE
    return StartDestination.MITRA_DASHBOARD
}
```

- [ ] **Step 4: Jalankan test, pastikan LULUS**

```bash
./gradlew :core:roles:testDebugUnitTest --tests "*StartDestinationTest*"
```

Harapan: 6 test lulus.

- [ ] **Step 5: Commit**

```bash
git add core/roles/src/main/java/com/sukashawarma/superapp/core/roles/session/StartDestination.kt core/roles/src/test/java/com/sukashawarma/superapp/core/roles/session/StartDestinationTest.kt
git commit -m "feat(mitra): resolveStartDestination sebagai penentu tujuan tunggal"
```

---

### Task 3: `AppSession` memuat profil mitra di kedua jalur masuk

**Files:**
- Modify: `core/roles/src/main/java/com/sukashawarma/superapp/core/roles/session/AppSession.kt`

**Interfaces:**
- Consumes: `MitraRepository.getProfile(userId)` (Task 1); `Role.MITRA`.
- Produces:
  - `AppSession.mitraProfile: StateFlow<MitraProfile?>`
  - `AppSession.mitraLoadFailed: StateFlow<Boolean>`

Keduanya dibaca Task 5.

- [ ] **Step 1: Tambah state**

Di `AppSession.kt`, tepat setelah pasangan `_staff` / `staff` yang sudah ada, sisipkan:

```kotlin
    private val _mitraProfile = MutableStateFlow<MitraProfile?>(null)
    val mitraProfile: StateFlow<MitraProfile?> = _mitraProfile

    /** true = profil GAGAL dimuat (jaringan/server), BUKAN "tidak punya profil".
     *  Dibedakan supaya mitra bersinyal jelek tak disuruh menelepon admin pusat. */
    private val _mitraLoadFailed = MutableStateFlow(false)
    val mitraLoadFailed: StateFlow<Boolean> = _mitraLoadFailed
```

Tambahkan import di bagian atas berkas:

```kotlin
import com.sukashawarma.superapp.data.repository.MitraRepository
import com.sukashawarma.superapp.domain.model.MitraProfile
import com.sukashawarma.superapp.domain.model.Role
```

- [ ] **Step 2: Tambah pemuat profil**

Sisipkan fungsi berikut di `AppSession`, tepat setelah `loadStaffOrSignOut()`:

```kotlin
    /** Dipanggil dari KEDUA jalur masuk. Kalau hanya dipasang di login(), app terlihat
     *  benar saat login pertama lalu jadi layar kosong keesokan harinya lewat auto-login. */
    private suspend fun loadMitraProfileIfNeeded(staff: StaffProfile) {
        if (staff.role != Role.MITRA) {
            _mitraProfile.value = null
            _mitraLoadFailed.value = false
            return
        }
        try {
            _mitraProfile.value = MitraRepository.getProfile(staff.id)
            _mitraLoadFailed.value = false
        } catch (e: Exception) {
            android.util.Log.e("AppSession", "loadMitraProfileIfNeeded() gagal", e)
            _mitraProfile.value = null
            _mitraLoadFailed.value = true
        }
    }
```

- [ ] **Step 3: Panggil dari `loadStaffOrSignOut()`**

Di `loadStaffOrSignOut()`, ganti dua baris terakhir:

```kotlin
        _staff.value = staff
        return LoginResult.Success
```

menjadi:

```kotlin
        _staff.value = staff
        loadMitraProfileIfNeeded(staff)
        return LoginResult.Success
```

`loadStaffOrSignOut()` dipanggil oleh `login()` **dan** `tryAutoLogin()`, jadi satu sisipan ini menutup kedua jalur sekaligus.

- [ ] **Step 4: Bersihkan state saat keluar**

Di `signOut()`, tambahkan setelah `_staff.value = null`:

```kotlin
        _mitraProfile.value = null
        _mitraLoadFailed.value = false
```

Tanpa ini, mitra yang logout lalu login sebagai role lain di HP yang sama masih membawa profil mitra lama di memori.

- [ ] **Step 5: Kompilasi & jalankan seluruh test modul**

```bash
./gradlew :core:roles:compileDebugKotlin :core:roles:testDebugUnitTest
```

Harapan: BUILD SUCCESSFUL, 11 test lulus (5 dari Task 1 + 6 dari Task 2).

- [ ] **Step 6: Commit**

```bash
git add core/roles/src/main/java/com/sukashawarma/superapp/core/roles/session/AppSession.kt
git commit -m "feat(mitra): muat profil mitra di login dan auto-login"
```

---

### Task 4: Modul `feature:mitra` dengan tiga layar

**Files:**
- Create: `feature/mitra/build.gradle.kts`
- Create: `feature/mitra/src/main/java/com/sukashawarma/superapp/feature/mitra/ui/MitraScreens.kt`
- Modify: `settings.gradle.kts`

**Interfaces:**
- Consumes: `AppSession.staff`, `AppSession.mitraProfile` (Task 3); warna dari package `com.sukashawarma.superapp.presentation.theme` (modul `core:ui`).
- Produces tiga composable publik, semua di package `com.sukashawarma.superapp.presentation.mitra`:
  - `fun MitraDashboardScaffold(onLoggedOut: () -> Unit)`
  - `fun MitraNoProfileScreen(onLoggedOut: () -> Unit)`
  - `fun MitraLoadErrorScreen(onRetry: () -> Unit, onLoggedOut: () -> Unit)`

- [ ] **Step 1: Daftarkan modul di `settings.gradle.kts`**

Ganti baris:

```kotlin
include(":feature:home", ":feature:absensi", ":feature:stok", ":feature:distribusi")
```

menjadi:

```kotlin
include(":feature:home", ":feature:absensi", ":feature:stok", ":feature:distribusi", ":feature:mitra")
```

- [ ] **Step 2: Buat `feature/mitra/build.gradle.kts`**

Disalin dari pola `feature/home/build.gradle.kts` — jangan mengarang versi baru:

```kotlin
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("kotlin-kapt")
    id("com.google.dagger.hilt.android")
}

android {
    namespace = "com.sukashawarma.superapp.feature.mitra"
    compileSdk = 34

    defaultConfig {
        minSdk = 26
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
    }
    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.8"
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.02.00")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.activity:activity-compose:1.8.2")
    implementation(project(":core:ui"))
    implementation(project(":core:roles"))
    implementation(project(":core:network"))
    implementation("androidx.navigation:navigation-compose:2.7.7")
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("com.google.dagger:hilt-android:2.51")
    kapt("com.google.dagger:hilt-compiler:2.51")
}
```

**Catatan:** modul ini **tidak** butuh `AndroidManifest.xml`. Sudah diperiksa: keempat modul feature yang ada (`home`, `absensi`, `stok`, `distribusi`) sama-sama tidak punya manifest — `namespace` di `build.gradle.kts` sudah cukup. Jangan membuatnya.

- [ ] **Step 3: Tulis ketiga layar**

Buat `feature/mitra/src/main/java/com/sukashawarma/superapp/feature/mitra/ui/MitraScreens.kt`:

```kotlin
package com.sukashawarma.superapp.presentation.mitra

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.PersonOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sukashawarma.superapp.domain.session.AppSession
import com.sukashawarma.superapp.presentation.theme.StatusEmerald
import com.sukashawarma.superapp.presentation.theme.StatusRed
import com.sukashawarma.superapp.presentation.theme.SukaOnSurface
import com.sukashawarma.superapp.presentation.theme.SukaOnSurfaceVariant
import com.sukashawarma.superapp.presentation.theme.SukaOrange
import com.sukashawarma.superapp.presentation.theme.SukaSurface
import com.sukashawarma.superapp.presentation.theme.SukaSurfaceContainerLowest

/**
 * Kerangka dashboard mitra. SENGAJA minimal — KPI, omzet, ROI, tren, orderan, transfer,
 * tim, dan saran adalah sub-proyek 1–5, bukan sub-proyek ini. Nilai layar ini: alur
 * login-lalu-redirect bisa dites di HP nyata sebelum satu pun angka dibangun.
 */
@Composable
fun MitraDashboardScaffold(onLoggedOut: () -> Unit) {
    val staff by AppSession.staff.collectAsState()
    val profil by AppSession.mitraProfile.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(SukaSurface)
            .padding(20.dp)
    ) {
        Text(
            "Halo, ${profil?.namaMitra ?: "Mitra"}",
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold,
            color = SukaOnSurface,
        )
        Spacer(Modifier.height(4.dp))
        Text(
            staff?.outletName ?: "Outlet belum diketahui",
            fontSize = 14.sp,
            color = SukaOnSurfaceVariant,
        )
        Spacer(Modifier.height(12.dp))

        val aktif = profil?.isAktif == true
        Text(
            if (aktif) "Kemitraan aktif" else "Kemitraan tidak aktif",
            modifier = Modifier
                .clip(RoundedCornerShape(12.dp))
                .background(if (aktif) StatusEmerald else StatusRed)
                .padding(horizontal = 12.dp, vertical = 6.dp),
            color = Color.White,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
        )

        Spacer(Modifier.height(28.dp))
        Text(
            "Ringkasan penjualan, bagi hasil, dan laporan outlet akan tampil di sini.",
            fontSize = 14.sp,
            color = SukaOnSurfaceVariant,
        )

        Spacer(Modifier.weight(1f))
        TextButton(onClick = { AppSession.signOut(); onLoggedOut() }) {
            Text("Keluar", color = SukaOrange, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
fun MitraNoProfileScreen(onLoggedOut: () -> Unit) {
    MitraMessageScreen(
        icon = Icons.Default.PersonOff,
        title = "Profil Mitra Belum Terdaftar",
        message = "Akun Anda belum dikaitkan dengan profil kemitraan. " +
            "Silakan hubungi admin pusat Suka Shawarma untuk proses aktivasi.",
        primaryLabel = null,
        onPrimary = null,
        onLoggedOut = onLoggedOut,
    )
}

@Composable
fun MitraLoadErrorScreen(onRetry: () -> Unit, onLoggedOut: () -> Unit) {
    MitraMessageScreen(
        icon = Icons.Default.CloudOff,
        title = "Gagal Memuat Data Kemitraan",
        message = "Data profil Anda tidak bisa diambil saat ini. " +
            "Periksa koneksi internet, lalu coba lagi.",
        primaryLabel = "Coba Lagi",
        onPrimary = onRetry,
        onLoggedOut = onLoggedOut,
    )
}

@Composable
private fun MitraMessageScreen(
    icon: ImageVector,
    title: String,
    message: String,
    primaryLabel: String?,
    onPrimary: (() -> Unit)?,
    onLoggedOut: () -> Unit,
) {
    Box(
        modifier = Modifier.fillMaxSize().background(SukaSurface),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(28.dp)
                .clip(RoundedCornerShape(24.dp))
                .background(SukaSurfaceContainerLowest)
                .padding(28.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .clip(CircleShape)
                    .background(SukaOrange.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(icon, contentDescription = null, tint = SukaOrange, modifier = Modifier.size(32.dp))
            }
            Spacer(Modifier.height(16.dp))
            Text(
                title,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = SukaOnSurface,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                message,
                fontSize = 14.sp,
                color = SukaOnSurfaceVariant,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(20.dp))
            if (primaryLabel != null && onPrimary != null) {
                Button(
                    onClick = onPrimary,
                    colors = ButtonDefaults.buttonColors(containerColor = SukaOrange),
                ) {
                    Text(primaryLabel, color = Color.White, fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.height(4.dp))
            }
            TextButton(onClick = { AppSession.signOut(); onLoggedOut() }) {
                Text("Keluar", color = SukaOnSurfaceVariant)
            }
        }
    }
}
```

- [ ] **Step 4: Kompilasi modul**

```bash
./gradlew :feature:mitra:compileDebugKotlin
```

Harapan: BUILD SUCCESSFUL. Kalau muncul `Unresolved reference` pada warna tema, periksa nama persisnya di `core/ui/src/main/java/com/sukashawarma/superapp/core/ui/theme/Color.kt` — package-nya `com.sukashawarma.superapp.presentation.theme`, bukan `core.ui.theme`.

- [ ] **Step 5: Commit**

```bash
git add settings.gradle.kts feature/mitra
git commit -m "feat(mitra): modul feature:mitra dengan tiga layar keadaan"
```

---

### Task 5: Routing per-role di `MainActivity`

**Files:**
- Modify: `app/src/main/java/com/sukashawarma/superapp/presentation/MainActivity.kt`
- Modify: `app/build.gradle.kts` (dua blok `dependencies`)

**Interfaces:**
- Consumes: `resolveStartDestination` + `StartDestination` (Task 2); `AppSession.mitraProfile` / `AppSession.mitraLoadFailed` (Task 3); tiga composable (Task 4).
- Produces: NavHost yang, untuk role MITRA, **tidak mendaftarkan** `Routes.HOME` maupun `Routes.ABSENSI`.

- [ ] **Step 1: Daftarkan modul di `app/build.gradle.kts`**

Berkas ini punya **dua** blok `dependencies { }` dengan daftar `project(...)` identik. Di **kedua-duanya**, tepat setelah baris:

```kotlin
    implementation(project(":feature:distribusi"))
```

tambahkan:

```kotlin
    implementation(project(":feature:mitra"))
```

- [ ] **Step 2: Tambah rute mitra**

Di `MainActivity.kt`, ganti `object Routes` menjadi:

```kotlin
object Routes {
    const val LOGIN = "login"
    const val HOME = "home"
    const val ABSENSI = "absensi"
    const val MITRA = "mitra"
    const val MITRA_NO_PROFILE = "mitra_no_profile"
    const val MITRA_LOAD_ERROR = "mitra_load_error"
}
```

- [ ] **Step 3: Tulis ulang `RootNav`**

Ganti seluruh fungsi `RootNav` dengan:

```kotlin
@Composable
private fun RootNav() {
    val navController = rememberNavController()
    val loading by AppSession.loading.collectAsState()
    val staff by AppSession.staff.collectAsState()
    val mitraProfile by AppSession.mitraProfile.collectAsState()
    val mitraLoadFailed by AppSession.mitraLoadFailed.collectAsState()
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        AppSession.tryAutoLogin()
    }

    if (loading) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        return
    }

    val destination = resolveStartDestination(staff, mitraProfile, mitraLoadFailed)
    val isMitra = staff?.role == Role.MITRA

    NavHost(navController = navController, startDestination = routeFor(destination)) {
        composable(Routes.LOGIN) {
            LoginScreen(onLoggedIn = {
                // Tujuan dihitung ulang dari sesi yang BARU terisi — jangan menebak di sini.
                val target = routeFor(
                    resolveStartDestination(
                        AppSession.staff.value,
                        AppSession.mitraProfile.value,
                        AppSession.mitraLoadFailed.value,
                    )
                )
                navController.navigate(target) { popUpTo(Routes.LOGIN) { inclusive = true } }
            })
        }

        if (isMitra) {
            // HOME & ABSENSI sengaja TIDAK didaftarkan untuk mitra — tak ada jalan ke sana
            // lewat Back maupun deep link. Cermin route-guard web (RoleContext.tsx).
            composable(Routes.MITRA) {
                MitraDashboardScaffold(onLoggedOut = {
                    navController.navigate(Routes.LOGIN) { popUpTo(0) }
                })
            }
            composable(Routes.MITRA_NO_PROFILE) {
                MitraNoProfileScreen(onLoggedOut = {
                    navController.navigate(Routes.LOGIN) { popUpTo(0) }
                })
            }
            composable(Routes.MITRA_LOAD_ERROR) {
                MitraLoadErrorScreen(
                    onRetry = { scope.launch { AppSession.tryAutoLogin() } },
                    onLoggedOut = {
                        navController.navigate(Routes.LOGIN) { popUpTo(0) }
                    },
                )
            }
        } else {
            composable(Routes.HOME) {
                HomeScreen(
                    onOpenAbsensi = { navController.navigate(Routes.ABSENSI) },
                    onLoggedOut = { navController.navigate(Routes.LOGIN) { popUpTo(0) } }
                )
            }
            composable(Routes.ABSENSI) {
                AbsensiNavGraph(onExit = { navController.popBackStack() })
            }
        }
    }
}

/** Pemetaan tujuan ke string rute. Aturannya ada di resolveStartDestination, bukan di sini. */
private fun routeFor(destination: StartDestination): String = when (destination) {
    StartDestination.LOGIN -> Routes.LOGIN
    StartDestination.HOME -> Routes.HOME
    StartDestination.MITRA_DASHBOARD -> Routes.MITRA
    StartDestination.MITRA_NO_PROFILE -> Routes.MITRA_NO_PROFILE
    StartDestination.MITRA_LOAD_ERROR -> Routes.MITRA_LOAD_ERROR
}
```

- [ ] **Step 4: Tambah import yang dibutuhkan**

Di bagian import `MainActivity.kt`, tambahkan:

```kotlin
import androidx.compose.runtime.rememberCoroutineScope
import com.sukashawarma.superapp.domain.model.Role
import com.sukashawarma.superapp.domain.session.StartDestination
import com.sukashawarma.superapp.domain.session.resolveStartDestination
import com.sukashawarma.superapp.presentation.mitra.MitraDashboardScaffold
import com.sukashawarma.superapp.presentation.mitra.MitraLoadErrorScreen
import com.sukashawarma.superapp.presentation.mitra.MitraNoProfileScreen
import kotlinx.coroutines.launch
```

- [ ] **Step 5: Build debug**

```bash
./gradlew :app:assembleDebug
```

Harapan: BUILD SUCCESSFUL.

- [ ] **Step 6: Commit**

```bash
git add app/build.gradle.kts app/src/main/java/com/sukashawarma/superapp/presentation/MainActivity.kt
git commit -m "feat(mitra): arahkan role mitra langsung ke layar mitra"
```

---

### Task 6: Verifikasi menyeluruh & smoke test di HP

**Files:** tidak ada perubahan kode. Kalau ada yang gagal, perbaiki di task asalnya lalu ulangi.

**Interfaces:**
- Consumes: seluruh Task 1–5.
- Produces: bukti bahwa alurnya benar-benar jalan di perangkat nyata.

- [ ] **Step 1: Jalankan seluruh unit test repo**

```bash
./gradlew testDebugUnitTest
```

Harapan: semua lulus. Catat kegagalan yang **sudah ada sebelum sesi ini** (mis. di `core:camera`) secara terpisah — jangan diklaim sebagai regresi, dan jangan diklaim lulus kalau merah.

- [ ] **Step 2: Build release**

```bash
./gradlew :app:assembleRelease
```

Harapan: BUILD SUCCESSFUL. Build debug saja tidak cukup — R8/minifikasi sering menemukan masalah yang tak muncul di debug.

- [ ] **Step 3: Smoke test — mitra dengan profil**

Pasang di HP fisik, login sebagai `mitra_anis`.

Harapan: langsung mendarat di layar mitra (nama "Mitra Paledang", nama outlet, badge "Kemitraan aktif"). **Tekan Back** — app keluar, dan daftar aplikasi TIDAK muncul.

- [ ] **Step 4: Smoke test — auto-login**

Tutup app sepenuhnya (usap dari recents), buka lagi.

Harapan: tetap mendarat di layar mitra dengan nama mitra terisi. Kalau namanya kosong atau layarnya salah, `loadMitraProfileIfNeeded` tidak terpanggil di jalur auto-login — periksa kembali Task 3 Step 3.

- [ ] **Step 5: Smoke test — jaringan mati**

Masuk sebagai `mitra_anis`, lalu tutup app. Nyalakan mode pesawat, buka app lagi.

Harapan: layar **"Gagal Memuat Data Kemitraan" dengan tombol Coba Lagi** — BUKAN "Profil Mitra Belum Terdaftar". Kalau yang muncul layar penjelas, urutan pemeriksaan di `resolveStartDestination` tertukar. Matikan mode pesawat, tekan Coba Lagi: harapannya masuk ke layar mitra normal.

- [ ] **Step 6: Smoke test — role non-mitra tidak berubah**

Login sebagai akun crew/SPV mana pun.

Harapan: mendarat di daftar aplikasi seperti sebelumnya, tile Absensi bisa dibuka. Ini yang membuktikan perubahan routing tidak merusak alur yang sudah berjalan.

- [ ] **Step 7: Catat hasilnya**

Tulis temuan di deskripsi PR. Jangan menandai task ini selesai kalau ada langkah yang dilewati — sebutkan langkah mana dan alasannya.
