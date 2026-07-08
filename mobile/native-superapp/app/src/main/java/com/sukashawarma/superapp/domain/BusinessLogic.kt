package com.sukashawarma.superapp.domain

import com.sukashawarma.superapp.data.*
import java.io.IOException
import java.util.*
import kotlin.math.*

// 1. HR Domain Logic
object HRService {
    fun calculateDistanceInMeters(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val r = 6371000.0 // Earth's radius in meters
        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)
        val a = sin(dLat / 2).pow(2) + cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * sin(dLon / 2).pow(2)
        val c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return r * c
    }

    fun verifyGeofence(
        deviceLat: Double,
        deviceLon: Double,
        accuracy: Double,
        outletLat: Double,
        outletLon: Double,
        radius: Double,
        accuracyBufferEnabled: Boolean = true
    ): Boolean {
        val distance = calculateDistanceInMeters(deviceLat, deviceLon, outletLat, outletLon)
        val effectiveDistance = if (accuracyBufferEnabled) {
            max(0.0, distance - accuracy)
        } else {
            distance
        }
        return effectiveDistance <= radius
    }

    fun determineAttendanceStatus(
        timestamp: Date,
        type: String, // "CLOCK_IN", "CLOCK_OUT"
        shiftStartHour: Int = 8,
        shiftStartMin: Int = 0,
        shiftEndHour: Int = 17,
        shiftEndMin: Int = 0,
        toleranceMin: Int = 15
    ): String {
        val calendar = Calendar.getInstance().apply { time = timestamp }
        val hour = calendar.get(Calendar.HOUR_OF_DAY)
        val minute = calendar.get(Calendar.MINUTE)
        val currentMinutes = hour * 60 + minute

        return if (type == "CLOCK_IN") {
            val targetMinutes = shiftStartHour * 60 + shiftStartMin
            if (currentMinutes <= targetMinutes + toleranceMin) {
                "ON_TIME"
            } else {
                "LATE"
            }
        } else {
            val targetMinutes = shiftEndHour * 60 + shiftEndMin
            if (currentMinutes >= targetMinutes - toleranceMin) {
                "ON_TIME"
            } else {
                "EARLY_OUT"
            }
        }
    }
}

// 2. Inventory Domain Logic
object InventoryService {
    fun computeOpnameDifference(expected: Int, actual: Int): Int {
        return actual - expected
    }

    fun createLedgerEntry(
        id: String,
        stockItemId: String,
        outletId: String,
        change: Int,
        reason: String,
        timestamp: Date = Date()
    ): LedgerEntry {
        return LedgerEntry(id, stockItemId, outletId, change, reason, timestamp)
    }

    fun getReorderStatus(quantity: Int, reorderPoint: Int): String {
        return if (quantity <= 0) {
            "OUT_OF_STOCK"
        } else if (quantity <= reorderPoint) {
            "CRITICAL"
        } else if (quantity <= reorderPoint * 1.5) {
            "WARNING"
        } else {
            "NORMAL"
        }
    }

    data class TransferSuggestion(
        val stockItemId: String,
        val fromOutletId: String,
        val toOutletId: String,
        val quantity: Int
    )

    fun generateTransferSuggestions(
        stockItemId: String,
        outletStocks: Map<String, Int>, // outletId -> quantity
        reorderPoints: Map<String, Int> // outletId -> reorderPoint
    ): List<TransferSuggestion> {
        val balances = outletStocks.mapValues { (outletId, qty) ->
            val rp = reorderPoints[outletId] ?: 0
            qty - rp
        }

        // Sort surpluses descending, deficits (represented as positive values) descending
        val surpluses = balances.filter { it.value > 0 }
            .map { it.key to it.value }
            .sortedByDescending { it.second }
            .toMutableList()

        val deficits = balances.filter { it.value < 0 }
            .map { it.key to -it.value }
            .sortedByDescending { it.second }
            .toMutableList()

        val suggestions = mutableListOf<TransferSuggestion>()
        var surplusIdx = 0
        var deficitIdx = 0

        while (surplusIdx < surpluses.size && deficitIdx < deficits.size) {
            val (fromOutlet, surplusQty) = surpluses[surplusIdx]
            val (toOutlet, deficitQty) = deficits[deficitIdx]

            val transferQty = min(surplusQty, deficitQty)
            if (transferQty > 0) {
                suggestions.add(TransferSuggestion(stockItemId, fromOutlet, toOutlet, transferQty))
                surpluses[surplusIdx] = fromOutlet to (surplusQty - transferQty)
                deficits[deficitIdx] = toOutlet to (deficitQty - transferQty)
            }

            if (surpluses[surplusIdx].second == 0) {
                surplusIdx++
            }
            if (deficits[deficitIdx].second == 0) {
                deficitIdx++
            }
        }
        return suggestions
    }
}

// 3. Fulfillment Domain Logic
object FulfillmentService {
    fun processShipmentTransition(
        shipment: Shipment,
        newStatus: String
    ): Shipment {
        val current = shipment.status
        val allowed = when (current) {
            "PENDING" -> listOf("IN_TRANSIT")
            "IN_TRANSIT" -> listOf("DELIVERED", "DISCREPANCY")
            else -> emptyList() // Final states cannot be changed
        }
        if (newStatus !in allowed) {
            throw IllegalStateException("Cannot transition shipment from $current to $newStatus")
        }
        return shipment.copy(status = newStatus)
    }

    fun verifyQrCode(shipment: Shipment, scannedCode: String): Boolean {
        return shipment.qrCode == scannedCode
    }

    fun calculateDiscrepancies(
        shipment: Shipment,
        receivedQuantities: Map<String, Int> // stockItemId -> receivedQuantity
    ): List<ShipmentItem> {
        return shipment.items.map { item ->
            val rec = receivedQuantities[item.stockItemId] ?: 0
            item.copy(receivedQuantity = rec)
        }
    }

    fun updateStockOnReceipt(
        currentStock: Map<String, Int>, // stockItemId -> quantity
        receivedItems: List<ShipmentItem>
    ): Map<String, Int> {
        val updated = currentStock.toMutableMap()
        for (item in receivedItems) {
            val currentVal = updated[item.stockItemId] ?: 0
            updated[item.stockItemId] = currentVal + item.receivedQuantity
        }
        return updated
    }
}

// 4. POS Domain Logic
object POSService {
    fun calculateCartCogs(cartItems: List<CartItem>): Double {
        return cartItems.sumOf { it.stockItem.cogs * it.quantity }
    }

    fun deductRecipeIngredients(
        outletStock: Map<String, Int>, // stockItemId -> current qty
        recipes: Map<String, Recipe>, // productId -> recipe
        productId: String,
        quantitySold: Int
    ): Map<String, Int> {
        val recipe = recipes[productId] ?: return outletStock
        val updatedStock = outletStock.toMutableMap()
        for (ingredient in recipe.ingredients) {
            val totalNeeded = ingredient.quantityNeeded * quantitySold
            val currentQty = updatedStock[ingredient.stockItemId] ?: 0
            if (currentQty < totalNeeded) {
                throw IllegalArgumentException("Insufficient stock for ingredient ${ingredient.stockItemId}")
            }
            updatedStock[ingredient.stockItemId] = currentQty - totalNeeded
        }
        return updatedStock
    }
}

// 5. Dashboard Domain Logic
object DashboardService {
    fun filterCriticalStock(items: List<StockItem>, thresholdMultiplier: Double = 1.0): List<StockItem> {
        return items.filter { it.quantity <= it.reorderPoint * thresholdMultiplier }
    }

    fun getRoleBasedViews(role: String): List<String> {
        return when (role) {
            "admin" -> listOf("DASHBOARD", "INVENTORY", "HR", "FULFILLMENT", "POS", "SETTINGS")
            "manager" -> listOf("DASHBOARD", "INVENTORY", "HR", "FULFILLMENT", "POS")
            "cashier" -> listOf("DASHBOARD", "POS")
            "kitchen_staff" -> listOf("DASHBOARD", "FULFILLMENT")
            else -> listOf("DASHBOARD")
        }
    }
}
