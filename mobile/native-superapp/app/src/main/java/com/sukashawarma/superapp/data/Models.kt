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
    val outletId: String,
    val name: String,
    val role: String,
    @SerialName("face_descriptor")
    val faceDescriptor: List<Float>? = null,
    @SerialName("enrolled_at")
    val enrolledAt: String? = null,
    @SerialName("re_enrolled_at")
    val reEnrolledAt: String? = null,
    @SerialName("re_enrolled_by")
    val reEnrolledBy: String? = null,
    @SerialName("re_enroll_reason")
    val reEnrollReason: String? = null,
    @SerialName("ref_photo_url")
    val refPhotoUrl: String? = null,
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
    val role: String, // "admin", "cashier", "kitchen_staff", "manager"
    val assignedOutletId: String,
    val faceDescriptor: FloatArray? = null,
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
