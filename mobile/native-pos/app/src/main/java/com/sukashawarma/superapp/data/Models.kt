package com.sukashawarma.superapp.data

import java.util.Date

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
    val assignedOutletId: String
)

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
