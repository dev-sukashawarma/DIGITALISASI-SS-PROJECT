package com.sukashawarma.superapp.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.SerialName
import java.util.Date

@Serializable
data class OutletNameDto(
    val name: String
)

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

// Models
data class Outlet(
    val id: String,
    val name: String,
    val latitude: Double,
    val longitude: Double,
    val radiusMeter: Double = 100.0
)

data class Staff(
    val id: String,
    val name: String,
    val role: String, // role kanonik: admin, owner, spv, leader, korlap, kasir, crew, kiosk, kitchen, mitra, staff_pusat
    val assignedOutletId: String,
    val outletId: String? = null, // UUID outlet mentah (outlet_staff.outlet_id) — assignedOutletId tetap nama display
    val faceDescriptor: FloatArray? = null, // MOBILE descriptor (kolom face_descriptor_mobile)
    val enrolledAt: String? = null,
    val reEnrolledAt: String? = null,
    val reEnrolledBy: String? = null,
    val reEnrollReason: String? = null,
    val refPhotoUrl: String? = null,
    val consentAt: String? = null,
    val consentBy: String? = null
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as Staff
        if (id != other.id) return false
        if (name != other.name) return false
        if (role != other.role) return false
        if (assignedOutletId != other.assignedOutletId) return false
        if (outletId != other.outletId) return false
        if (enrolledAt != other.enrolledAt) return false
        if (reEnrolledAt != other.reEnrolledAt) return false
        if (reEnrolledBy != other.reEnrolledBy) return false
        if (reEnrollReason != other.reEnrollReason) return false
        if (refPhotoUrl != other.refPhotoUrl) return false
        if (consentAt != other.consentAt) return false
        if (consentBy != other.consentBy) return false
        if (faceDescriptor != null) {
            if (other.faceDescriptor == null) return false
            if (!faceDescriptor.contentEquals(other.faceDescriptor)) return false
        } else if (other.faceDescriptor != null) return false
        return true
    }

    override fun hashCode(): Int {
        var result = id.hashCode()
        result = 31 * result + name.hashCode()
        result = 31 * result + role.hashCode()
        result = 31 * result + assignedOutletId.hashCode()
        result = 31 * result + (outletId?.hashCode() ?: 0)
        result = 31 * result + (enrolledAt?.hashCode() ?: 0)
        result = 31 * result + (reEnrolledAt?.hashCode() ?: 0)
        result = 31 * result + (reEnrolledBy?.hashCode() ?: 0)
        result = 31 * result + (reEnrollReason?.hashCode() ?: 0)
        result = 31 * result + (refPhotoUrl?.hashCode() ?: 0)
        result = 31 * result + (consentAt?.hashCode() ?: 0)
        result = 31 * result + (consentBy?.hashCode() ?: 0)
        result = 31 * result + (faceDescriptor?.contentHashCode() ?: 0)
        return result
    }
}

data class StockItem(
    val id: String,
    val name: String,
    val sku: String,
    val quantity: Int,
    val reorderPoint: Int,
    val cogs: Double
)

data class Attendance(
    val id: String,
    val staffId: String,
    val outletId: String,
    val timestamp: Date,
    val type: String, // "CLOCK_IN", "CLOCK_OUT"
    val latitude: Double,
    val longitude: Double,
    val accuracy: Double,
    val status: String, // "ON_TIME", "LATE", "EARLY_OUT", "PENDING_SYNC"
    val isOffline: Boolean = false
)

@Serializable
data class OutletAttendanceConfigDto(
    @SerialName("outlet_id") val outletId: String,
    @SerialName("jam_masuk") val jamMasuk: String,
    @SerialName("jam_keluar") val jamKeluar: String,
    @SerialName("toleransi_menit") val toleransiMenit: Int,
    @SerialName("absen_window_mode") val absenWindowMode: String = "auto",
    @SerialName("radius_m") val radiusM: Int? = 100
)

/** Body request POST /api/submit-attendance (endpoint web absensi — kontrak server). */
@Serializable
data class AttendanceSubmitRequest(
    val id: String,
    @SerialName("outlet_staff_id") val outletStaffId: String,
    @SerialName("outlet_id") val outletId: String,
    val type: String, // "in" / "out"
    @SerialName("ts_client") val tsClient: String,
    @SerialName("gps_lat") val gpsLat: Double? = null,
    @SerialName("gps_lng") val gpsLng: Double? = null,
    @SerialName("gps_accuracy") val gpsAccuracy: Double? = null,
    @SerialName("match_distance") val matchDistance: Double? = null,
    @SerialName("selfie_path") val selfiePath: String? = null,
    @SerialName("from_queue") val fromQueue: Boolean = false
)

/** Row tabel attendance (untuk BACA via postgrest — kolom sesuai skema nyata). */
@Serializable
data class AttendanceRowDto(
    val id: String? = null,
    @SerialName("outlet_staff_id") val outletStaffId: String,
    @SerialName("outlet_id") val outletId: String? = null,
    val type: String,
    @SerialName("ts_client") val tsClient: String? = null,
    @SerialName("ts_server") val tsServer: String? = null,
    val status: String? = null
)

data class Shipment(
    val id: String, // Surat Jalan ID
    val sourceOutletId: String, // e.g. "central_kitchen"
    val destinationOutletId: String,
    val status: String, // "PENDING", "IN_TRANSIT", "DELIVERED", "DISCREPANCY"
    val qrCode: String,
    val items: List<ShipmentItem>
)

data class ShipmentItem(
    val stockItemId: String,
    val expectedQuantity: Int,
    val receivedQuantity: Int = 0
)

data class CartItem(
    val stockItem: StockItem,
    val quantity: Int
)

data class LedgerEntry(
    val id: String,
    val stockItemId: String,
    val outletId: String,
    val change: Int,
    val reason: String, // "OPNAME", "SALE", "TRANSFER_IN", "TRANSFER_OUT"
    val timestamp: Date
)

data class Recipe(
    val productId: String,
    val ingredients: List<RecipeIngredient>
)

data class RecipeIngredient(
    val stockItemId: String,
    val quantityNeeded: Int
)
