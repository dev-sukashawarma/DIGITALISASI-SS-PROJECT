package com.sukashawarma.superapp.data

import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.float
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
        // Kolom mobile WAJIB ada, dengan NILAI yang benar
        val descriptor = payload["face_descriptor_mobile"]!!.jsonArray.map { it.jsonPrimitive.float }
        assertEquals(listOf(0.1f, 0.2f, 0.3f), descriptor)
        assertEquals("outlet-1/staff-1_mobile.jpg", payload["ref_photo_url_mobile"]!!.jsonPrimitive.content)
        assertEquals("2026-07-17T00:00:00Z", payload["mobile_enrolled_at"]!!.jsonPrimitive.content)
        assertEquals("admin-1", payload["mobile_enrolled_by"]!!.jsonPrimitive.content)
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
        assertEquals("2026-07-17T00:00:00Z", tanpaConsent["consent_at"]!!.jsonPrimitive.content)
        assertEquals("admin-1", tanpaConsent["consent_by"]!!.jsonPrimitive.content)

        val sudahConsent = build(hasExistingConsent = true)
        assertFalse(sudahConsent.containsKey("consent_at"))
        assertFalse(sudahConsent.containsKey("consent_by"))
    }

    @Test
    fun alasanHanyaSaatReEnroll() {
        val enrollBaru = build(isReEnroll = false, reason = "salah orang")
        assertFalse(enrollBaru.containsKey("mobile_re_enroll_reason"))

        val reEnroll = build(isReEnroll = true, reason = "wajah berubah")
        assertEquals("wajah berubah", reEnroll["mobile_re_enroll_reason"]!!.jsonPrimitive.content)
    }

    @Test
    fun descriptorKosongDitolak() {
        try {
            EnrollmentPayload.build(
                descriptor = FloatArray(0),
                photoUrl = "outlet-1/staff-1_mobile.jpg",
                now = "2026-07-17T00:00:00Z",
                adminId = "admin-1",
                isReEnroll = false,
                reason = null,
                hasExistingConsent = false
            )
            fail("Harus melempar IllegalArgumentException untuk descriptor kosong")
        } catch (expected: IllegalArgumentException) {
            // OK
        }
    }
}
