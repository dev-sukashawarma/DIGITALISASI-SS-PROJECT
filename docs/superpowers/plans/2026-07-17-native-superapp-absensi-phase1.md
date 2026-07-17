# Native Superapp — Fase 1 Absensi Production-Ready: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Absensi Android (`mobile/native-superapp`) siap produksi: descriptor wajah mobile terisolasi dari web (kolom `*_mobile`), role kanonik, semua jalur "sukses palsu" dihapus, threshold tunggal terkalibrasi.

**Architecture:** Android native Kotlin + Jetpack Compose. Semua akses data via `SupabaseClient` (delegate Production/Mock). Perubahan DB aditif saja — kolom web `face_descriptor` dkk **tidak boleh disentuh** (absensi web masih produksi). Logika baru yang bisa diuji dipisah jadi unit murni (payload builder, role sets, menu builder) dengan unit test.

**Tech Stack:** Kotlin, Jetpack Compose, Supabase Kotlin SDK (postgrest/auth/storage), ML Kit face detection, TFLite (embedding), Robolectric + JUnit4.

**Spec:** `docs/superpowers/specs/2026-07-17-native-superapp-absensi-phase1-design.md`

**Working directory semua perintah:** `mobile/native-superapp` (kecuali disebut lain). Test runner: `.\gradlew.bat :app:testDebugUnitTest` (Windows). Filter: `--tests "*NamaTest*"`.

**⚠️ Aturan keras proyek:** database Supabase SHARED dengan developer lain yang aktif push migration. Sebelum `supabase db push`, WAJIB `supabase migration list` dulu; kalau ada entry remote-only tanpa file lokal, JANGAN `migration repair` entry milik orang lain — lihat prosedur di Task 1.

---

## File Structure (ringkasan)

| File | Aksi | Tanggung jawab |
|---|---|---|
| `supabase/migrations/20260717120000_face_descriptor_mobile.sql` | Create | Kolom mobile aditif di `outlet_staff` |
| `app/src/main/java/.../data/Roles.kt` | Create | Role sets kanonik (satu sumber kebenaran) |
| `app/src/main/java/.../data/EnrollmentPayload.kt` | Create | Builder payload update enrollment (pure, testable) |
| `app/src/main/java/.../ui/features/dashboard/DashboardMenu.kt` | Create | Menu dashboard per role (pure, testable) |
| `app/src/main/java/.../ui/features/facedebug/FaceDebugScreen.kt` | Create | Layar kalibrasi similarity (SPV/admin only) |
| `app/src/main/java/.../data/SupabaseClient.kt` | Modify | Repoint kolom mobile, payload builder, mock roles |
| `app/src/main/java/.../data/Models.kt` | Modify | DTO kolom mobile |
| `app/src/main/java/.../utils/FaceRecognizer.kt` | Modify | Threshold konstanta, guard cosine, hapus mock embedding |
| `app/src/main/java/.../ui/features/attendance/AttendanceScreen.kt` | Modify | Threshold tunggal, hapus bypass, guard belum-enroll/dimensi |
| `app/src/main/java/.../ui/features/enrollment/EnrollmentScreen.kt` | Modify | Param consent, path foto `_mobile` |
| `app/src/main/java/.../ui/navigation/NavigationManager.kt` | Modify | Gating role kanonik |
| `app/src/main/java/.../ui/navigation/Screen.kt` | Modify | Route FaceDebug |
| `app/src/main/java/.../ui/features/dashboard/DashboardScreen.kt` | Modify | Menu dari DashboardMenu |
| `app/src/main/java/.../domain/BusinessLogic.kt` | Modify | getRoleBasedViews role kanonik |
| `app/src/main/java/.../MainActivity.kt` | Modify | Hapus fallback mock |
| `app/src/main/java/.../SuperAppApplication.kt` | Modify | BuildConfig env |
| `app/src/main/java/.../ui/MainShell.kt` | Modify | Hapus "Andi", sembunyikan bottom nav, route FaceDebug |
| `app/build.gradle.kts` | Modify | buildConfigField SUPABASE_URL/ANON_KEY |
| Test: `app/src/test/java/.../data/EnrollmentPayloadTest.kt` | Create | Regression guard kolom mobile |
| Test: `app/src/test/java/.../utils/FaceRecognizerTest.kt` | Create | cosine guard & threshold |
| Test: `app/src/test/java/.../ui/features/dashboard/DashboardMenuTest.kt` | Create | Menu per role |
| Test: `app/src/test/java/.../e2e/NavigationFlowTest.kt`, `DashboardFlowTest.kt`, `SupabaseConnectionTest.kt` | Modify | Role kanonik |

Catatan path: `...` = `com/sukashawarma/superapp`.

---

### Task 1: Migration DB — kolom descriptor mobile + verifikasi RLS

**Files:**
- Create: `supabase/migrations/20260717120000_face_descriptor_mobile.sql` (di root repo, BUKAN di mobile/)

- [ ] **Step 1: Tulis file migration**

```sql
-- Kolom face recognition khusus mobile (Android native-superapp).
-- TERPISAH dari kolom web (face_descriptor, enrolled_at, ref_photo_url) karena
-- model TFLite Android tidak kompatibel dengan @vladmandic/human di apps/absensi web.
-- Kolom web TIDAK disentuh — absensi web masih produksi.
-- consent_at / consent_by existing DIPAKAI BERSAMA lintas platform (tidak dibuat baru).
ALTER TABLE outlet_staff
  ADD COLUMN IF NOT EXISTS face_descriptor_mobile real[],
  ADD COLUMN IF NOT EXISTS mobile_enrolled_at timestamptz,
  ADD COLUMN IF NOT EXISTS mobile_enrolled_by uuid,
  ADD COLUMN IF NOT EXISTS mobile_re_enroll_reason text,
  ADD COLUMN IF NOT EXISTS ref_photo_url_mobile text;
```

- [ ] **Step 2: Cek drift migration SEBELUM push**

Run (root repo): `supabase migration list`
Expected: kolom Local & Remote sinkron untuk timestamp milik kita. Kalau ada entry **remote-only tanpa file lokal** (sering terjadi — dev lain aktif): JANGAN repair entry itu. Kalau `db push` terblokir karenanya, pakai jalur alternatif Step 3b.

- [ ] **Step 3a (jalur normal): Push migration**

Run (root repo): `supabase db push`
Expected: `20260717120000` applied tanpa error.

- [ ] **Step 3b (jalur alternatif kalau push terblokir drift):** Jalankan isi SQL migration langsung via `supabase db query "<isi file>" --linked` (atau SQL Editor dashboard), lalu stempel HANYA timestamp milik kita: `supabase migration repair --status applied 20260717120000`.

- [ ] **Step 4: Verifikasi ground-truth kolom nyata ada** (jangan andalkan migration list — pelajaran proyek)

Run (root repo):
```bash
supabase db query "SELECT column_name FROM information_schema.columns WHERE table_name='outlet_staff' AND column_name LIKE '%mobile%'" --linked
```
Expected: 5 baris (`face_descriptor_mobile`, `mobile_enrolled_at`, `mobile_enrolled_by`, `mobile_re_enroll_reason`, `ref_photo_url_mobile`).

- [ ] **Step 5: Verifikasi RLS — SPV boleh UPDATE outlet_staff**

Run (root repo):
```bash
supabase db query "SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr, pg_get_expr(polwithcheck, polrelid) AS check_expr FROM pg_policy WHERE polrelid='outlet_staff'::regclass" --linked
```
Expected: ada policy UPDATE yang meloloskan SPV/leader untuk staff outlet binaannya (web enrollment SPV sudah jalan produksi → policy pasti ada; policy row-level otomatis mencakup kolom baru). Catat nama policy-nya di commit message. Kalau TIDAK ada policy UPDATE yang cocok → berhenti, lapor ke user sebelum lanjut (jangan buat policy sendiri tanpa konfirmasi — DB shared).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260717120000_face_descriptor_mobile.sql
git commit -m "feat(db): kolom face descriptor mobile terpisah di outlet_staff (native-superapp fase 1)"
```

---

### Task 2: EnrollmentPayload — builder payload kolom mobile (TDD)

Regression guard terpenting fase ini: enrollment Android menulis kolom `*_mobile`, TIDAK PERNAH kolom web.

**Files:**
- Create: `app/src/main/java/com/sukashawarma/superapp/data/EnrollmentPayload.kt`
- Test: `app/src/test/java/com/sukashawarma/superapp/data/EnrollmentPayloadTest.kt`

- [ ] **Step 1: Tulis failing test**

```kotlin
package com.sukashawarma.superapp.data

import org.junit.Assert.*
import org.junit.Test

class EnrollmentPayloadTest {

    private fun build(
        isReEnroll: Boolean = false,
        reason: String? = null,
        hasExistingConsent: Boolean = false
    ) = EnrollmentPayload.build(
        descriptor = floatArrayOf(0.1f, 0.2f, 0.3f),
        photoUrl = "outlet-1/staff-1_mobile.jpg",
        now = "2026-07-17T00:00:00Z",
        adminId = "admin-1",
        isReEnroll = isReEnroll,
        reason = reason,
        hasExistingConsent = hasExistingConsent
    )

    @Test
    fun menulisKolomMobile_danTidakPernahKolomWeb() {
        val payload = build()
        // Kolom mobile WAJIB ada
        assertTrue(payload.containsKey("face_descriptor_mobile"))
        assertTrue(payload.containsKey("mobile_enrolled_at"))
        assertTrue(payload.containsKey("mobile_enrolled_by"))
        assertTrue(payload.containsKey("ref_photo_url_mobile"))
        // Kolom WEB TIDAK BOLEH pernah disentuh (absensi web produksi!)
        assertFalse(payload.containsKey("face_descriptor"))
        assertFalse(payload.containsKey("enrolled_at"))
        assertFalse(payload.containsKey("re_enrolled_at"))
        assertFalse(payload.containsKey("re_enrolled_by"))
        assertFalse(payload.containsKey("re_enroll_reason"))
        assertFalse(payload.containsKey("ref_photo_url"))
    }

    @Test
    fun consentDiisiHanyaBilaBelumAda() {
        val tanpaConsent = build(hasExistingConsent = false)
        assertTrue(tanpaConsent.containsKey("consent_at"))
        assertTrue(tanpaConsent.containsKey("consent_by"))

        val sudahConsent = build(hasExistingConsent = true)
        assertFalse(sudahConsent.containsKey("consent_at"))
        assertFalse(sudahConsent.containsKey("consent_by"))
    }

    @Test
    fun alasanHanyaSaatReEnroll() {
        val enrollBaru = build(isReEnroll = false, reason = "salah orang")
        assertFalse(enrollBaru.containsKey("mobile_re_enroll_reason"))

        val reEnroll = build(isReEnroll = true, reason = "wajah berubah")
        assertEquals("\"wajah berubah\"", reEnroll["mobile_re_enroll_reason"].toString())
    }
}
```

- [ ] **Step 2: Run test, verifikasi FAIL**

Run: `.\gradlew.bat :app:testDebugUnitTest --tests "*EnrollmentPayloadTest*"`
Expected: FAIL compile — `EnrollmentPayload` belum ada.

- [ ] **Step 3: Implementasi minimal**

```kotlin
package com.sukashawarma.superapp.data

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray

/**
 * Payload UPDATE outlet_staff untuk enrollment MOBILE.
 * HANYA kolom *_mobile + consent bersama — tidak pernah menyentuh kolom web
 * (face_descriptor / enrolled_at / ref_photo_url) karena absensi web masih produksi.
 */
object EnrollmentPayload {
    fun build(
        descriptor: FloatArray,
        photoUrl: String,
        now: String,
        adminId: String,
        isReEnroll: Boolean,
        reason: String?,
        hasExistingConsent: Boolean
    ): JsonObject = buildJsonObject {
        putJsonArray("face_descriptor_mobile") { descriptor.forEach { add(it) } }
        put("ref_photo_url_mobile", photoUrl)
        put("mobile_enrolled_at", now)
        put("mobile_enrolled_by", adminId)
        if (isReEnroll && !reason.isNullOrBlank()) {
            put("mobile_re_enroll_reason", reason)
        }
        if (!hasExistingConsent) {
            put("consent_at", now)
            put("consent_by", adminId)
        }
    }
}
```

- [ ] **Step 4: Run test, verifikasi PASS**

Run: `.\gradlew.bat :app:testDebugUnitTest --tests "*EnrollmentPayloadTest*"`
Expected: 3 tests PASS.

- [ ] **Step 5: Wire ke saveEnrollment (ProductionDelegate)**

Di `SupabaseClient.kt`:

(a) Interface `SupabaseClientDelegate` — ubah signature (baris ~42):
```kotlin
suspend fun saveEnrollment(staffId: String, descriptor: FloatArray, photoUrl: String, isReEnroll: Boolean, reason: String?, adminId: String, hasExistingConsent: Boolean)
```

(b) Wrapper `SupabaseClient` (baris ~107):
```kotlin
suspend fun saveEnrollment(staffId: String, descriptor: FloatArray, photoUrl: String, isReEnroll: Boolean, reason: String?, adminId: String, hasExistingConsent: Boolean) =
    delegate.saveEnrollment(staffId, descriptor, photoUrl, isReEnroll, reason, adminId, hasExistingConsent)
```

(c) `ProductionDelegate.saveEnrollment` (baris ~476-499) — GANTI SELURUH body + HAPUS `EnrollmentUpdateDto` (baris ~464-474, tidak dipakai lagi):
```kotlin
override suspend fun saveEnrollment(staffId: String, descriptor: FloatArray, photoUrl: String, isReEnroll: Boolean, reason: String?, adminId: String, hasExistingConsent: Boolean) {
    val clientObj = realClient ?: throw IllegalStateException("Supabase client not initialized")
    val now = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US).apply {
        timeZone = java.util.TimeZone.getTimeZone("UTC")
    }.format(java.util.Date())

    android.util.Log.d("ENROLL", "Saving MOBILE descriptor ${descriptor.size}d for $staffId")

    val payload = EnrollmentPayload.build(descriptor, photoUrl, now, adminId, isReEnroll, reason, hasExistingConsent)
    clientObj.postgrest["outlet_staff"].update(payload) {
        filter { eq("id", staffId) }
    }
}
```

(d) `MockDelegate.saveEnrollment` (baris ~738) — samakan signature (body tetap no-op/simulasi existing).

(e) `ProductionDelegate.uploadFaceReference` (baris ~452-462) — path foto mobile terpisah:
```kotlin
val refPath = "$outletId/${staffId}_mobile.jpg"
```
(juga di `MockDelegate.uploadFaceReference` bila mengembalikan path serupa).

- [ ] **Step 6: Update call site EnrollmentScreen**

`EnrollmentScreen.kt` baris ~256-263 — tambah argumen consent dari data staff terpilih:
```kotlin
SupabaseClient.getInstance().saveEnrollment(
    selectedStaff!!.id,
    finalDesc,
    url,
    isReEnroll,
    reEnrollReason,
    adminStaff.id,
    hasExistingConsent = selectedStaff!!.consentAt != null
)
```

- [ ] **Step 7: Run SEMUA test + verifikasi kompilasi**

Run: `.\gradlew.bat :app:testDebugUnitTest`
Expected: BUILD SUCCESSFUL, semua test existing tetap hijau.

- [ ] **Step 8: Commit**

```bash
git add app/src/main/java/com/sukashawarma/superapp/data/EnrollmentPayload.kt app/src/test/java/com/sukashawarma/superapp/data/EnrollmentPayloadTest.kt app/src/main/java/com/sukashawarma/superapp/data/SupabaseClient.kt app/src/main/java/com/sukashawarma/superapp/ui/features/enrollment/EnrollmentScreen.kt
git commit -m "feat(enroll): enrollment Android menulis kolom face_descriptor_mobile, kolom web tak disentuh"
```

---

### Task 3: Repoint profil staff ke kolom mobile

**Files:**
- Modify: `app/src/main/java/com/sukashawarma/superapp/data/Models.kt` (OutletStaffDto)
- Modify: `app/src/main/java/com/sukashawarma/superapp/data/SupabaseClient.kt` (getStaffProfile ~331-390, getStaffList ~392-419, MockDelegate)

- [ ] **Step 1: Ganti field DTO ke kolom mobile**

Di `Models.kt`, GANTI `OutletStaffDto` (baris 12-35) menjadi:
```kotlin
@Serializable
data class OutletStaffDto(
    val id: String,
    @SerialName("outlet_id")
    val outletId: String? = null,
    val name: String,
    val role: String,
    // Kolom MOBILE — descriptor TFLite Android. Kolom web (face_descriptor dkk) sengaja tidak di-select.
    @SerialName("face_descriptor_mobile")
    val faceDescriptorMobile: List<Float>? = null,
    @SerialName("mobile_enrolled_at")
    val mobileEnrolledAt: String? = null,
    @SerialName("ref_photo_url_mobile")
    val refPhotoUrlMobile: String? = null,
    @SerialName("consent_at")
    val consentAt: String? = null,
    @SerialName("consent_by")
    val consentBy: String? = null
)
```
`Staff` (data class app) TIDAK berubah — tapi mulai sekarang `Staff.faceDescriptor`/`enrolledAt`/`refPhotoUrl` berisi data MOBILE. Update komentar di `Staff`:
```kotlin
    val role: String, // role kanonik: admin, owner, spv, leader, korlap, kasir, crew, kiosk, kitchen, mitra, staff_pusat
    val assignedOutletId: String,
    val faceDescriptor: FloatArray? = null, // MOBILE descriptor (kolom face_descriptor_mobile)
```

- [ ] **Step 2: Update kolom yang di-select + mapping**

Di `SupabaseClient.kt` `getStaffProfile` (baris ~338) dan `getStaffList` (baris ~394), ganti `Columns.raw(...)`:
```kotlin
val cols = io.github.jan.supabase.postgrest.query.Columns.raw("id, outlet_id, name, role, face_descriptor_mobile, mobile_enrolled_at, ref_photo_url_mobile, consent_at, consent_by")
```
Ganti mapping `Staff(...)` di kedua fungsi:
```kotlin
return Staff(
    id = result.id,
    name = result.name,
    role = result.role,
    assignedOutletId = outletName, // di getStaffList: result.outletId ?: "Pusat (Semua Outlet)"
    faceDescriptor = result.faceDescriptorMobile?.toFloatArray(),
    enrolledAt = result.mobileEnrolledAt,
    refPhotoUrl = result.refPhotoUrlMobile,
    consentAt = result.consentAt,
    consentBy = result.consentBy
)
```
(field `reEnrolledAt`/`reEnrolledBy`/`reEnrollReason` tidak diisi lagi → default null.)

- [ ] **Step 3: Cek tidak ada referensi tersisa ke field DTO lama**

Run: `grep -rn "faceDescriptor\b\|enrolledAt\|refPhotoUrl" app/src/main --include="*.kt"` — pastikan semua referensi `result.faceDescriptor` → `result.faceDescriptorMobile` dst. sudah terganti; referensi `Staff.faceDescriptor` (model app) tetap sah.

- [ ] **Step 4: Run semua test**

Run: `.\gradlew.bat :app:testDebugUnitTest`
Expected: BUILD SUCCESSFUL, semua hijau. (EnrollmentScreen "Sudah/Belum Terdaftar" kini otomatis mencerminkan status enrollment MOBILE — semua crew mulai dari "Belum".)

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/com/sukashawarma/superapp/data/Models.kt app/src/main/java/com/sukashawarma/superapp/data/SupabaseClient.kt
git commit -m "feat(data): profil staff Android membaca face_descriptor_mobile (bukan kolom web)"
```

---

### Task 4: Threshold tunggal + guard verifikasi (TDD untuk bagian murni)

**Files:**
- Modify: `app/src/main/java/com/sukashawarma/superapp/utils/FaceRecognizer.kt`
- Modify: `app/src/main/java/com/sukashawarma/superapp/ui/features/attendance/AttendanceScreen.kt`
- Test: `app/src/test/java/com/sukashawarma/superapp/utils/FaceRecognizerTest.kt`

- [ ] **Step 1: Tulis failing test**

```kotlin
package com.sukashawarma.superapp.utils

import org.junit.Assert.*
import org.junit.Test

class FaceRecognizerTest {

    @Test
    fun cosineSimilarity_vektorIdentik_mendekatiSatu() {
        val v = floatArrayOf(0.6f, 0.8f)
        assertEquals(1f, FaceRecognizer.cosineSimilarity(v, v), 0.001f)
    }

    @Test
    fun cosineSimilarity_bedaDimensi_kembalikanMinusSatu() {
        // Guard: descriptor DB lama (mis. 192d model lama) vs embedding model baru (mis. 512d)
        // tidak boleh crash / diam-diam salah — harus gagal eksplisit.
        val a = floatArrayOf(0.1f, 0.2f, 0.3f)
        val b = floatArrayOf(0.1f, 0.2f)
        assertEquals(-1f, FaceRecognizer.cosineSimilarity(a, b), 0.0f)
        assertEquals(-1f, FaceRecognizer.cosineSimilarity(b, a), 0.0f)
    }

    @Test
    fun cosineSimilarity_vektorKosong_kembalikanMinusSatu() {
        assertEquals(-1f, FaceRecognizer.cosineSimilarity(FloatArray(0), FloatArray(0)), 0.0f)
    }

    @Test
    fun thresholdTunggal_adaDanMasukAkal() {
        // Satu konstanta untuk SEMUA jalur verifikasi (ganti 0.85/0.80 inline yang dulu beda-beda)
        assertTrue(FaceRecognizer.MOBILE_MATCH_THRESHOLD in 0.5f..0.95f)
    }
}
```

- [ ] **Step 2: Run test, verifikasi FAIL**

Run: `.\gradlew.bat :app:testDebugUnitTest --tests "*FaceRecognizerTest*"`
Expected: FAIL — `MOBILE_MATCH_THRESHOLD` belum ada; bedaDimensi crash/salah nilai.

- [ ] **Step 3: Implementasi di FaceRecognizer companion**

Di `FaceRecognizer.kt` companion object (baris ~125), tambah konstanta + guard di `cosineSimilarity`:
```kotlin
companion object {
    /**
     * Threshold cosine similarity verifikasi 1:1.
     * Nilai awal 0.80 — WAJIB dikalibrasi ulang via FaceDebugScreen setiap ganti model
     * (lihat Task 9). Pola kalibrasi web dulu: titik tengah skor orang-sama vs orang-beda.
     */
    const val MOBILE_MATCH_THRESHOLD = 0.80f

    fun cosineSimilarity(vectorA: FloatArray, vectorB: FloatArray): Float {
        // Guard dimensi: descriptor lama/korup vs model baru → gagal eksplisit, bukan crash
        if (vectorA.isEmpty() || vectorA.size != vectorB.size) return -1f
        var dotProduct = 0.0
        var normA = 0.0
        var normB = 0.0
        for (i in vectorA.indices) {
            dotProduct += vectorA[i] * vectorB[i]
            normA += vectorA[i] * vectorA[i]
            normB += vectorB[i] * vectorB[i]
        }
        if (normA == 0.0 || normB == 0.0) return 0f
        return (dotProduct / (sqrt(normA) * sqrt(normB))).toFloat()
    }
    // averageDescriptors tetap
}
```

- [ ] **Step 4: Run test, verifikasi PASS**

Run: `.\gradlew.bat :app:testDebugUnitTest --tests "*FaceRecognizerTest*"`
Expected: 4 tests PASS.

- [ ] **Step 5: AttendanceScreen — threshold tunggal + hapus bypass + guard belum-enroll**

Di `AttendanceScreen.kt`:

(a) **Guard belum-enroll di awal composable** (sebelum kamera dinyalakan). `AttendanceScreen(staffName: String?, staffFaceDescriptor: FloatArray?, onBackClick: () -> Unit)` — tambah di awal body:
```kotlin
if (staffFaceDescriptor == null || staffFaceDescriptor.isEmpty()) {
    NotEnrolledScreen(staffName = staffName, onBackClick = onBackClick)
    return
}
```
Tambahkan composable di file yang sama:
```kotlin
@Composable
private fun NotEnrolledScreen(staffName: String?, onBackClick: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            Icons.Default.Face,
            contentDescription = null,
            modifier = Modifier.size(72.dp),
            tint = MaterialTheme.colorScheme.primary
        )
        Spacer(Modifier.height(16.dp))
        Text("Wajah Belum Terdaftar", fontSize = 20.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text(
            "Halo${staffName?.let { ", $it" } ?: ""}. Kamu belum punya data wajah untuk absensi di aplikasi ini. Hubungi SPV/Leader untuk pendaftaran wajah (menu Enrollment).",
            textAlign = androidx.compose.ui.text.style.TextAlign.Center
        )
        Spacer(Modifier.height(24.dp))
        Button(onClick = onBackClick) { Text("Kembali") }
    }
}
```

(b) **Jalur INIT** (baris ~729-746): ganti `similarity >= 0.85f` → `similarity >= FaceRecognizer.MOBILE_MATCH_THRESHOLD`. **HAPUS** cabang `else { // Jika belum terdaftar di DB … "FaceDesc NULL! Bypass" }` — dengan guard (a), `staffFaceDescriptor` tidak mungkin null di sini; struktur menjadi:
```kotlin
if (embedding.isNotEmpty()) {
    if (staffFaceDescriptor.size != embedding.size) {
        livenessState = LivenessState.INIT
        debugMessage = "Data wajah tidak cocok dengan model (${staffFaceDescriptor.size}d vs ${embedding.size}d). Hubungi SPV untuk enroll ulang."
    } else {
        val similarity = FaceRecognizer.cosineSimilarity(embedding, staffFaceDescriptor)
        android.util.Log.d("FACE_MATCH", "Sim=$similarity (dims ${embedding.size})")
        if (similarity >= FaceRecognizer.MOBILE_MATCH_THRESHOLD) {
            livenessState = LivenessState.STRAIGHT
            debugMessage = "Cocok! (Sim: ${String.format("%.4f", similarity)})"
        } else {
            livenessState = LivenessState.INIT
            debugMessage = "Wajah tidak cocok (Sim: ${String.format("%.4f", similarity)})"
        }
    }
} else {
    livenessState = LivenessState.INIT
    debugMessage = "Gagal Ekstrak Embedding"
}
```

(c) **Jalur verifikasi final LEFT→frontal** (baris ~784-805): ganti `similarity >= 0.80f` → `similarity >= FaceRecognizer.MOBILE_MATCH_THRESHOLD`; **HAPUS** cabang `else { // Bypass; livenessState = VERIFIED }` — ganti jadi:
```kotlin
} else {
    livenessState = LivenessState.INIT
    debugMessage = "Gagal verifikasi final — ulangi dari awal"
}
```

- [ ] **Step 6: Run semua test + kompilasi**

Run: `.\gradlew.bat :app:testDebugUnitTest`
Expected: BUILD SUCCESSFUL, semua hijau.

- [ ] **Step 7: Commit**

```bash
git add app/src/main/java/com/sukashawarma/superapp/utils/FaceRecognizer.kt app/src/main/java/com/sukashawarma/superapp/ui/features/attendance/AttendanceScreen.kt app/src/test/java/com/sukashawarma/superapp/utils/FaceRecognizerTest.kt
git commit -m "feat(absensi): threshold tunggal MOBILE_MATCH_THRESHOLD, hapus bypass null-descriptor, guard dimensi & belum-enroll"
```

---

### Task 5: Role kanonik ekosistem (TDD)

**Files:**
- Create: `app/src/main/java/com/sukashawarma/superapp/data/Roles.kt`
- Create: `app/src/main/java/com/sukashawarma/superapp/ui/features/dashboard/DashboardMenu.kt`
- Modify: `NavigationManager.kt`, `DashboardScreen.kt`, `domain/BusinessLogic.kt` (~baris 230-235), `SupabaseClient.kt` (MockDelegate ~baris 691-720, ProductionDelegate.getUserRole ~baris 328)
- Test: Create `app/src/test/java/com/sukashawarma/superapp/ui/features/dashboard/DashboardMenuTest.kt`; Modify `NavigationFlowTest.kt`, `DashboardFlowTest.kt`, `SupabaseConnectionTest.kt`

- [ ] **Step 1: Buat Roles.kt (satu sumber kebenaran)**

```kotlin
package com.sukashawarma.superapp.data

/**
 * Role kanonik ekosistem Suka Shawarma (kolom outlet_staff.role):
 * admin, owner, spv, leader, korlap, kasir, crew, kiosk, kitchen, mitra, staff_pusat.
 * JANGAN pakai role fiktif lama (manager/cashier/kitchen_staff).
 */
object Roles {
    /** Boleh absen wajah 1:1 di HP pribadi. */
    val ATTENDANCE = setOf("crew", "kasir", "kitchen", "spv", "leader", "korlap", "admin", "owner")

    /** Boleh mendaftarkan/re-enroll wajah crew (SPV/leader-driven, konsisten kebijakan web). */
    val ENROLLMENT = setOf("spv", "leader", "korlap", "admin", "owner")

    /** Akses modul stub Inventory/Fulfillment (belum fungsional — fase 3). */
    val STUB_MODULES = setOf("admin", "owner")
}
```

- [ ] **Step 2: Tulis failing test DashboardMenu**

```kotlin
package com.sukashawarma.superapp.ui.features.dashboard

import org.junit.Assert.*
import org.junit.Test

class DashboardMenuTest {

    @Test
    fun crewHanyaAbsensi() {
        assertEquals(listOf("Absensi"), DashboardMenu.menuFor("crew"))
        assertEquals(listOf("Absensi"), DashboardMenu.menuFor("kasir"))
        assertEquals(listOf("Absensi"), DashboardMenu.menuFor("kitchen"))
    }

    @Test
    fun spvDapatEnrollmentDanAbsensi() {
        for (role in listOf("spv", "leader", "korlap", "admin", "owner")) {
            assertEquals("role=$role", listOf("Enrollment", "Absensi"), DashboardMenu.menuFor(role))
        }
    }

    @Test
    fun roleLainTanpaMenu() {
        assertEquals(emptyList<String>(), DashboardMenu.menuFor("mitra"))
        assertEquals(emptyList<String>(), DashboardMenu.menuFor("staff_pusat"))
        assertEquals(emptyList<String>(), DashboardMenu.menuFor(null))
    }

    @Test
    fun roleLamaFiktifTidakDapatApapun() {
        // manager/cashier/kitchen_staff bukan role kanonik — tidak boleh diam-diam dapat akses
        assertEquals(emptyList<String>(), DashboardMenu.menuFor("manager"))
        assertEquals(emptyList<String>(), DashboardMenu.menuFor("cashier"))
        assertEquals(emptyList<String>(), DashboardMenu.menuFor("kitchen_staff"))
    }
}
```

- [ ] **Step 3: Run test, verifikasi FAIL** — `.\gradlew.bat :app:testDebugUnitTest --tests "*DashboardMenuTest*"` → FAIL compile.

- [ ] **Step 4: Implementasi DashboardMenu**

```kotlin
package com.sukashawarma.superapp.ui.features.dashboard

import com.sukashawarma.superapp.data.Roles

/** Menu dashboard fase 1 — hanya fitur yang benar-benar fungsional (jangan tampilkan tile mati). */
object DashboardMenu {
    fun menuFor(role: String?): List<String> = buildList {
        if (role in Roles.ENROLLMENT) add("Enrollment")
        if (role in Roles.ATTENDANCE) add("Absensi")
    }
}
```

- [ ] **Step 5: Run test, verifikasi PASS** — `.\gradlew.bat :app:testDebugUnitTest --tests "*DashboardMenuTest*"` → 4 PASS.

- [ ] **Step 6: NavigationManager pakai Roles**

Ganti blok role-gating di `NavigationManager.kt` (baris 17-29):
```kotlin
// Role-based gating (role kanonik — lihat Roles.kt)
if (staff != null && screen != Screen.Login) {
    val allowed = when (screen) {
        Screen.Login, Screen.Dashboard -> true
        Screen.Attendance -> staff.role in Roles.ATTENDANCE
        Screen.Enroll -> staff.role in Roles.ENROLLMENT
        Screen.Inventory, Screen.Fulfillment -> staff.role in Roles.STUB_MODULES
    }
    if (!allowed) {
        return false // Navigation Gated
    }
}
```
Import: `com.sukashawarma.superapp.data.Roles`. (`Screen.FaceDebug` BELUM ada di task ini — object route-nya baru dibuat di Task 8; saat itu cabang `Screen.Enroll ->` diubah jadi `Screen.Enroll, Screen.FaceDebug ->`, lihat Task 8 Step 3e.)

- [ ] **Step 7: DashboardScreen pakai DashboardMenu**

Ganti blok pembuatan `apps` di `DashboardScreen.kt` (baris 84-95):
```kotlin
val appMeta = mapOf(
    "Enrollment" to PortalApp("Enrollment", Icons.Default.Face, PortalTheme.Tertiary, PortalTheme.TertiaryContainer),
    "Absensi" to PortalApp("Absensi", Icons.Default.Fingerprint, PortalTheme.Primary, PortalTheme.PrimaryContainer)
)
// Fase 1: hanya fitur fungsional. Tile Stok/Distribusi/POS/Kiosk/Dashboard menyusul
// saat modulnya nyata (fase 3) — jangan tampilkan tombol mati.
val apps = DashboardMenu.menuFor(staff?.role).mapNotNull { appMeta[it] }
```

- [ ] **Step 8: BusinessLogic.getRoleBasedViews role kanonik**

Di `domain/BusinessLogic.kt` (~baris 230-235), ganti mapping:
```kotlin
"admin", "owner" -> listOf("DASHBOARD", "INVENTORY", "HR", "FULFILLMENT", "POS")
"spv", "leader", "korlap" -> listOf("DASHBOARD", "HR")
"kasir" -> listOf("DASHBOARD", "POS")
"kitchen" -> listOf("DASHBOARD", "FULFILLMENT")
"crew" -> listOf("DASHBOARD")
```
(pertahankan cabang default existing untuk role tak dikenal.)

- [ ] **Step 9: MockDelegate & getUserRole role kanonik**

Di `SupabaseClient.kt`:
- `ProductionDelegate.getUserRole` (baris ~328): fallback `?: "cashier"` → `?: "crew"`.
- `MockDelegate.getUserRole` (baris ~691-697): `"cashier"` → `"kasir"`, `"kitchen_staff"` → `"kitchen"`, `"manager"` → `"spv"` (username mock `manager@` boleh diganti `spv@`).
- `MockDelegate.getStaffProfile` (baris ~707): username mock disesuaikan (`valid`/`admin`/`kasir`/`kitchen`/`spv`).
- `MockDelegate.getStaffList` (baris ~719-720): role mock `"cashier"` → `"kasir"`, `"kitchen_staff"` → `"kitchen"`.

- [ ] **Step 10: Update test existing ke role kanonik**

`NavigationFlowTest.kt`:
```kotlin
private val defaultAdmin = Staff("1", "Admin User", "admin", "outlet_1")
private val defaultKasir = Staff("2", "Kasir Joe", "kasir", "outlet_1")
private val defaultKitchen = Staff("3", "Chef Bob", "kitchen", "outlet_1")
```
Sesuaikan asersi dengan aturan baru (kasir & kitchen TIDAK boleh ke Inventory/Fulfillment; hanya admin/owner):
```kotlin
@Test
fun testTier2_RoleGatingKitchenGatedFromInventory() {
    loginUser()
    assertFalse(navManager.navigateTo(Screen.Inventory, defaultKitchen))
    assertFalse(navManager.navigateTo(Screen.Fulfillment, defaultKitchen)) // dulu true; stub kini admin/owner only
}
```
Tambah test baru:
```kotlin
@Test
fun testRoleGating_CrewBolehAbsensiTapiTidakEnroll() {
    loginUser()
    val crew = Staff("4", "Crew Andi", "crew", "outlet_1")
    assertTrue(navManager.navigateTo(Screen.Attendance, crew))
    assertFalse(navManager.navigateTo(Screen.Enroll, crew))
}

@Test
fun testRoleGating_SpvBolehEnroll() {
    loginUser()
    val spv = Staff("5", "SPV Budi", "spv", "outlet_1")
    assertTrue(navManager.navigateTo(Screen.Enroll, spv))
}
```
`DashboardFlowTest.kt` (baris 27, 48, 56, 113): `"cashier"` → `"kasir"`, `"kitchen_staff"` → `"kitchen"`; sesuaikan asersi `getRoleBasedViews` dengan mapping Step 8.
`SupabaseConnectionTest.kt` (baris 335-337): sesuaikan dengan mock baru:
```kotlin
assertEquals("kasir", client.getUserRole("kasir@sukashawarma.com"))
assertEquals("kitchen", client.getUserRole("kitchen@sukashawarma.com"))
assertEquals("spv", client.getUserRole("spv@sukashawarma.com"))
```

- [ ] **Step 11: Run SEMUA test** — `.\gradlew.bat :app:testDebugUnitTest` → BUILD SUCCESSFUL, semua hijau.

- [ ] **Step 12: Commit**

```bash
git add -A app/src
git commit -m "feat(role): sinkronkan gating ke role kanonik ekosistem (crew/kasir/spv/leader/... ganti manager/cashier)"
```

---

### Task 6: Hardening produksi — hapus jalur "sukses palsu"

**Files:**
- Modify: `utils/FaceRecognizer.kt` (extractEmbedding ~58-64), `MainActivity.kt` (~28-32), `ui/MainShell.kt` (~146, ~164-182)

- [ ] **Step 1: FaceRecognizer — hapus mock embedding**

Ganti awal `extractEmbedding` (baris 58-63):
```kotlin
fun extractEmbedding(bitmap: Bitmap): FloatArray {
    // Model tidak ter-load = kegagalan nyata. FloatArray kosong → semua jalur pemanggil
    // (cek embedding.isNotEmpty() + guard cosineSimilarity) gagal eksplisit. TIDAK ADA mock.
    val interp = interpreter ?: return FloatArray(0)
    ...
```
(sisa fungsi tetap). UI sudah punya gate `!faceRecognizer.isModelLoaded` → pesan "Model Error" tampil sebelum sampai sini.

- [ ] **Step 2: MainActivity — hapus fallback mock**

Ganti baris 28-32:
```kotlin
// Fail-fast: SuperAppApplication.onCreate SELALU initialize. Kalau sampai throw di sini,
// itu bug wiring yang harus ketahuan di dev — bukan diam-diam jalan pakai mock.
val authRepository = SupabaseClient.getInstance()
```
(Robolectric aman: manifest Application tetap `SuperAppApplication` yang memanggil `initialize()`; di bawah test, delegate otomatis Mock via deteksi `isUnderTest`.)

- [ ] **Step 3: MainShell — hapus "Andi", sembunyikan bottom nav dekoratif**

(a) Baris ~146: `Text("Halo, ${currentStaff?.name ?: "Andi"}", ...)` →
```kotlin
currentStaff?.name?.let { Text("Halo, $it", fontSize = 13.sp, color = Color.Gray) }
```
(b) HAPUS seluruh blok `bottomBar = { NavigationBar(...) { ... } }` (baris ~164-182) — Scaffold tanpa `bottomBar` (bottom nav fungsional = fase 3, jangan tampilkan tombol mati).

- [ ] **Step 4: Run semua test + build**

Run: `.\gradlew.bat :app:testDebugUnitTest` lalu `.\gradlew.bat :app:assembleDebug`
Expected: keduanya BUILD SUCCESSFUL.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/com/sukashawarma/superapp/utils/FaceRecognizer.kt app/src/main/java/com/sukashawarma/superapp/MainActivity.kt app/src/main/java/com/sukashawarma/superapp/ui/MainShell.kt
git commit -m "fix(prod): hapus mock embedding, fallback client mock, nama dummy, dan bottom nav dekoratif"
```

---

### Task 7: Kredensial Supabase via BuildConfig

**Files:**
- Modify: `app/build.gradle.kts`, `SuperAppApplication.kt`

- [ ] **Step 1: buildConfigField di gradle**

Di `app/build.gradle.kts`, dalam `android {}`:
```kotlin
buildFeatures {
    compose = true
    buildConfig = true
}
```
Dalam `defaultConfig {}` (setelah `testInstrumentationRunner`):
```kotlin
// Kredensial default = project produksi (anon key memang publik).
// Override per-mesin via local.properties: SUPABASE_URL / SUPABASE_ANON_KEY.
val localProps = java.util.Properties().apply {
    val f = rootProject.file("local.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
buildConfigField("String", "SUPABASE_URL",
    "\"${localProps.getProperty("SUPABASE_URL") ?: "https://khpkoreaaucvyqfhynfq.supabase.co"}\"")
buildConfigField("String", "SUPABASE_ANON_KEY",
    "\"${localProps.getProperty("SUPABASE_ANON_KEY") ?: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NjMyOTIsImV4cCI6MjA5NjUzOTI5Mn0.RdsvP6OKs6aiRnqqd02BYiv5gzbh4uGqO88dapo0Gso"}\"")
```

- [ ] **Step 2: SuperAppApplication pakai BuildConfig**

Ganti baris 15:
```kotlin
SupabaseClient.initialize(BuildConfig.SUPABASE_URL, BuildConfig.SUPABASE_ANON_KEY)
```
Import: `com.sukashawarma.superapp.BuildConfig` (satu package — tak perlu import eksplisit).

- [ ] **Step 3: Build + test** — `.\gradlew.bat :app:assembleDebug :app:testDebugUnitTest` → BUILD SUCCESSFUL.

- [ ] **Step 4: Commit**

```bash
git add app/build.gradle.kts app/src/main/java/com/sukashawarma/superapp/SuperAppApplication.kt
git commit -m "feat(config): kredensial Supabase via BuildConfig (override lewat local.properties)"
```

---

### Task 8: FaceDebugScreen — alat kalibrasi model & threshold

Layar internal (SPV/admin only) untuk mengukur similarity dua capture — dasar pemilihan model & threshold di Task 9. Pola sama dengan halaman `face-debug` web yang dulu menyelamatkan kalibrasi.

**Files:**
- Create: `app/src/main/java/com/sukashawarma/superapp/ui/features/facedebug/FaceDebugScreen.kt`
- Modify: `ui/navigation/Screen.kt`, `ui/MainShell.kt` (route + handler klik), `ui/features/dashboard/DashboardMenu.kt` + test, `ui/navigation/NavigationManager.kt` (tambah `Screen.FaceDebug` ke cabang ENROLLMENT bila belum — lihat Task 5 Step 6)

- [ ] **Step 1: Tambah route**

`Screen.kt`:
```kotlin
sealed class Screen(val route: String) {
    object Dashboard : Screen("dashboard")
    object Inventory : Screen("inventory")
    object Attendance : Screen("attendance")
    object Fulfillment : Screen("fulfillment")
    object Login : Screen("login")
    object Enroll : Screen("enroll")
    object FaceDebug : Screen("face_debug")
}
```

- [ ] **Step 2: Implementasi FaceDebugScreen**

```kotlin
package com.sukashawarma.superapp.ui.features.facedebug

import android.graphics.Bitmap
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.sukashawarma.superapp.ui.components.CameraPreview
import com.sukashawarma.superapp.utils.FaceRecognizer

/**
 * Alat kalibrasi internal (SPV/admin): capture 2 embedding (A/B) → lihat cosine similarity.
 * Prosedur: A = wajah orang X, B = wajah orang X lagi (skor orang-sama), lalu ulangi
 * dengan B = orang Y (skor orang-beda). Threshold = titik tengah dua kelompok skor.
 */
@androidx.annotation.OptIn(androidx.camera.core.ExperimentalGetImage::class)
@Composable
fun FaceDebugScreen(onBackClick: () -> Unit) {
    val context = LocalContext.current
    val faceRecognizer = remember { FaceRecognizer(context) }
    val detector = remember {
        FaceDetection.getClient(
            FaceDetectorOptions.Builder()
                .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
                .build()
        )
    }
    var slotA by remember { mutableStateOf<FloatArray?>(null) }
    var slotB by remember { mutableStateOf<FloatArray?>(null) }
    var captureTarget by remember { mutableStateOf<Char?>(null) }
    var status by remember { mutableStateOf(if (faceRecognizer.isModelLoaded) "Model OK" else "MODEL GAGAL: ${faceRecognizer.loadError}") }

    val similarity = if (slotA != null && slotB != null)
        FaceRecognizer.cosineSimilarity(slotA!!, slotB!!) else null

    Column(Modifier.fillMaxSize()) {
        Box(Modifier.weight(1f)) {
            CameraPreview(
                onFaceDetected = {},
                onImageCaptureReady = { imageProxy ->
                    val target = captureTarget
                    val mediaImage = imageProxy.image
                    if (target == null || mediaImage == null) {
                        imageProxy.close()
                        return@CameraPreview
                    }
                    val inputImage = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
                    detector.process(inputImage)
                        .addOnSuccessListener { faces ->
                            val face = faces.maxByOrNull { it.boundingBox.width() * it.boundingBox.height() }
                            val bitmap = try { imageProxy.toBitmap() } catch (e: Exception) { null }
                            if (face != null && bitmap != null) {
                                val b = face.boundingBox
                                val left = b.left.coerceIn(0, bitmap.width - 1)
                                val top = b.top.coerceIn(0, bitmap.height - 1)
                                val right = b.right.coerceIn(left + 1, bitmap.width)
                                val bottom = b.bottom.coerceIn(top + 1, bitmap.height)
                                val faceBitmap = Bitmap.createBitmap(bitmap, left, top, right - left, bottom - top)
                                val emb = faceRecognizer.extractEmbedding(faceBitmap)
                                if (emb.isNotEmpty()) {
                                    if (target == 'A') slotA = emb else slotB = emb
                                    captureTarget = null
                                    status = "Slot $target terisi (${emb.size}d)"
                                } else {
                                    status = "Gagal ekstrak embedding"
                                }
                            } else {
                                status = "Tidak ada wajah terdeteksi — coba lagi"
                            }
                        }
                        .addOnFailureListener { status = "Deteksi gagal: ${it.message}" }
                        .addOnCompleteListener { imageProxy.close() }
                }
            )
        }
        Column(Modifier.fillMaxWidth().padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(status, fontSize = 13.sp)
            Text(
                "A: ${slotA?.size?.let { "${it}d" } ?: "-"}  |  B: ${slotB?.size?.let { "${it}d" } ?: "-"}  |  Sim: ${similarity?.let { String.format("%.4f", it) } ?: "-"}",
                fontSize = 16.sp
            )
            Text("Threshold aktif: ${FaceRecognizer.MOBILE_MATCH_THRESHOLD}", fontSize = 13.sp)
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { captureTarget = 'A' }, enabled = faceRecognizer.isModelLoaded) { Text("Capture A") }
                Button(onClick = { captureTarget = 'B' }, enabled = faceRecognizer.isModelLoaded) { Text("Capture B") }
                OutlinedButton(onClick = onBackClick) { Text("Tutup") }
            }
        }
    }
}
```

- [ ] **Step 3: Route di MainShell + menu**

(a) `MainShell.kt` — tambah composable di NavHost:
```kotlin
composable(Screen.FaceDebug.route) {
    com.sukashawarma.superapp.ui.features.facedebug.FaceDebugScreen(onBackClick = { navController.popBackStack() })
}
```
(b) Handler klik dashboard di `MainShell.kt` (baris ~100-106) — tambah cabang:
```kotlin
} else if (appName == "Kalibrasi Wajah") {
    navController.navigate(Screen.FaceDebug.route)
}
```
(c) `DashboardMenu.menuFor` — tambah setelah "Enrollment":
```kotlin
if (role in Roles.ENROLLMENT) add("Kalibrasi Wajah")
```
(d) `DashboardScreen.appMeta` — tambah entri:
```kotlin
"Kalibrasi Wajah" to PortalApp("Kalibrasi Wajah", Icons.Default.Tune, PortalTheme.Secondary, PortalTheme.SecondaryContainer)
```
(e) `NavigationManager` — ubah cabang `Screen.Enroll ->` menjadi `Screen.Enroll, Screen.FaceDebug -> staff.role in Roles.ENROLLMENT` (wajib, karena `when` exhaustive atas sealed class — tanpa ini gagal compile setelah Step 1).

- [ ] **Step 4: Update DashboardMenuTest**

Ganti asersi spv:
```kotlin
assertEquals("role=$role", listOf("Enrollment", "Kalibrasi Wajah", "Absensi"), DashboardMenu.menuFor(role))
```

- [ ] **Step 5: Run semua test + build** — `.\gradlew.bat :app:testDebugUnitTest :app:assembleDebug` → BUILD SUCCESSFUL.

- [ ] **Step 6: Commit**

```bash
git add -A app/src
git commit -m "feat(debug): FaceDebugScreen untuk kalibrasi model & threshold (SPV/admin only)"
```

---

### Task 9: Evaluasi model & kalibrasi threshold (MANUAL — butuh HP fisik & manusia)

⚠️ Task ini human-in-the-loop; agen menyiapkan artefak, keputusan final oleh user di device. **Wajib selesai SEBELUM crew mana pun di-enroll di lapangan** (ganti model belakangan = re-enroll semua orang).

**Files:**
- Possibly replace: `app/src/main/assets/facenet.tflite`
- Modify (kalibrasi): `utils/FaceRecognizer.kt` (`MOBILE_MATCH_THRESHOLD`)

- [ ] **Step 1: Verifikasi model existing ter-bundle**

Run: `ls app/src/main/assets/`
Expected: `facenet.tflite` ada. Kalau TIDAK ada → app selama ini jalan di mock; unduh MobileFaceNet TFLite (input 112×112, output 192d) sebagai baseline sebelum lanjut.

- [ ] **Step 2: Siapkan kandidat model (best-effort, boleh gagal → fallback baseline)**

Urutan preferensi (dari riset spec):
1. **EdgeFace-XS/S** — repo resmi Idiap `github.com/otroshi/edgeface` (pretrained PyTorch). Konversi: PyTorch → ONNX (`torch.onnx.export`, input `1x3x112x112`) → TFLite via `onnx2tf` (`pip install onnx2tf; onnx2tf -i edgeface_s.onnx -o edgeface_tflite`). Ambil `*_float32.tflite`.
2. **GhostFaceNetV2** — repo `github.com/HamadYA/GhostFaceNets` (Keras .h5). Konversi: `tf.lite.TFLiteConverter.from_keras_model(model)` → `.tflite`.
3. **MobileFaceNet existing** — fallback tanpa kerja tambahan.

Catatan: normalisasi input `FaceRecognizer.convertBitmapToByteBuffer` = `(x-127.5)/127.5` (rentang [-1,1]) — cocok untuk ketiga keluarga model ini (standar ArcFace-family); verifikasi di dokumentasi model terpilih.

- [ ] **Step 3: Uji tiap kandidat di HP via FaceDebugScreen**

Untuk tiap model: replace `app/src/main/assets/facenet.tflite` → build & install (`.\gradlew.bat :app:installDebug`) → login akun spv → menu "Kalibrasi Wajah" → kumpulkan minimal:
- 3 pasang skor **orang-sama** (capture A & B orang yang sama, ulang 3 orang berbeda)
- 3 pasang skor **orang-beda** (A = orang X, B = orang Y)
Catat: model, dimensi output, skor min orang-sama, skor max orang-beda.

- [ ] **Step 4: CHECKPOINT — keputusan user**

Presentasikan tabel hasil ke user. Kriteria pilih: gap terbesar antara min(orang-sama) dan max(orang-beda). Threshold final = titik tengah gap (pola kalibrasi web: 0.53–0.86 → 0.725).

- [ ] **Step 5: Terapkan keputusan**

- Kunci file model terpilih sebagai `app/src/main/assets/facenet.tflite`.
- Update `MOBILE_MATCH_THRESHOLD` di `FaceRecognizer.kt` sesuai kalibrasi + update komentar (model apa, tanggal, data kalibrasi ringkas).
- Sesuaikan test `thresholdTunggal_adaDanMasukAkal` bila nilai final di luar 0.5–0.95 (seharusnya tidak).

- [ ] **Step 6: Run semua test lalu commit**

```bash
.\gradlew.bat :app:testDebugUnitTest
git add app/src/main/assets/facenet.tflite app/src/main/java/com/sukashawarma/superapp/utils/FaceRecognizer.kt
git commit -m "feat(face): model final <NAMA_MODEL> + threshold terkalibrasi <NILAI> (kalibrasi lapangan <TANGGAL>)"
```

---

### Task 10: Verifikasi final & smoke test

- [ ] **Step 1: Full test suite** — `.\gradlew.bat :app:testDebugUnitTest` → semua PASS, 0 failure.

- [ ] **Step 2: Build release** — `.\gradlew.bat :app:assembleRelease` → BUILD SUCCESSFUL.

- [ ] **Step 3: Regression guard lintas-platform (query DB nyata)**

Setelah 1 enrollment percobaan via app (akun spv, enroll 1 staff test):
```bash
supabase db query "SELECT id, name, face_descriptor IS NOT NULL AS web_desc, face_descriptor_mobile IS NOT NULL AS mobile_desc, mobile_enrolled_at FROM outlet_staff WHERE mobile_enrolled_at IS NOT NULL" --linked
```
Expected: staff test punya `mobile_desc = true`; nilai `web_desc` TIDAK berubah dari sebelum percobaan (kalau tadinya false tetap false, true tetap true).

- [ ] **Step 4: Smoke test manual HP fisik (checklist untuk user)**

1. Login akun SPV → menu Enrollment tampil → enroll 1 crew test → sukses.
2. Login akun crew ter-enroll → buka Absensi → verifikasi wajah lolos → clock-in tercatat (cek row `attendance`).
3. Login akun crew BELUM enroll → buka Absensi → layar "Wajah Belum Terdaftar" (bukan kamera, bukan bypass).
4. Minta orang lain scan di akun crew ter-enroll → DITOLAK.
5. Crew coba buka menu Enrollment → tidak tampil / ditolak.
6. Kiosk web absensi outlet ybs masih berfungsi normal untuk crew yang sama (kolom web utuh).

- [ ] **Step 5: Update dokumen**

- Spec: tandai status `Approved → Implemented (Fase 1)`.
- `CLAUDE.md`: tambah section session sesuai konvensi repo (ringkas: apa yang dikerjakan, gotcha, next steps fase 2-4).

- [ ] **Step 6: Commit terakhir**

```bash
git add -A docs CLAUDE.md
git commit -m "docs: tandai fase 1 absensi native-superapp selesai + catatan sesi"
```

---

## Catatan untuk pelaksana

- **Jangan pernah** menulis/mengubah kolom `face_descriptor`, `enrolled_at`, `re_enrolled_*`, `ref_photo_url` (web) dari kode Android — itu definisi rusaknya fase ini.
- `SupabaseClient.kt` punya deteksi `isUnderTest` (Robolectric/JUnit di classpath → MockDelegate otomatis). Test tidak butuh jaringan.
- Ada kerja paralel dev lain di repo & DB shared — sebelum `db push`/`git push`, cek `migration list` & `git pull` dulu.
- Urutan task: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 bisa berurutan langsung; Task 9 manual (bisa paralel setelah 8); Task 10 terakhir.
