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
    ): JsonObject {
        require(descriptor.isNotEmpty()) { "descriptor kosong" }
        return buildJsonObject {
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
}
