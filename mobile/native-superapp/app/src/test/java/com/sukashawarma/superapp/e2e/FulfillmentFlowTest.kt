package com.sukashawarma.superapp.e2e

import com.sukashawarma.superapp.data.Shipment
import com.sukashawarma.superapp.data.ShipmentItem
import com.sukashawarma.superapp.domain.FulfillmentService
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], manifest = Config.NONE)
class FulfillmentFlowTest {

    private val sampleItems = listOf(
        ShipmentItem("item_patty", 100),
        ShipmentItem("item_bread", 200)
    )

    private val sampleShipment = Shipment(
        id = "SJ-12345",
        sourceOutletId = "central_kitchen",
        destinationOutletId = "outlet_sudirman",
        status = "PENDING",
        qrCode = "QR_SIGNATURE_SJ12345",
        items = sampleItems
    )

    // --- TIER 1: Feature Coverage (5 tests) ---

    @Test
    fun testTier1_ShipmentPendingToInTransit() {
        val updated = FulfillmentService.processShipmentTransition(sampleShipment, "IN_TRANSIT")
        assertEquals("IN_TRANSIT", updated.status)
    }

    @Test
    fun testTier1_ShipmentInTransitToDelivered() {
        val inTransit = sampleShipment.copy(status = "IN_TRANSIT")
        val updated = FulfillmentService.processShipmentTransition(inTransit, "DELIVERED")
        assertEquals("DELIVERED", updated.status)
    }

    @Test
    fun testTier1_QrCodeMatchingSuccess() {
        val isVerified = FulfillmentService.verifyQrCode(sampleShipment, "QR_SIGNATURE_SJ12345")
        assertTrue(isVerified)
    }

    @Test
    fun testTier1_DiscrepancyCalculationPositive() {
        val receivedMap = mapOf("item_patty" to 95, "item_bread" to 200)
        val itemsWithRec = FulfillmentService.calculateDiscrepancies(sampleShipment, receivedMap)

        val pattyItem = itemsWithRec.find { it.stockItemId == "item_patty" }!!
        assertEquals(100, pattyItem.expectedQuantity)
        assertEquals(95, pattyItem.receivedQuantity)
    }

    @Test
    fun testTier1_DiscrepancyCalculationZero() {
        val receivedMap = mapOf("item_patty" to 100, "item_bread" to 200)
        val itemsWithRec = FulfillmentService.calculateDiscrepancies(sampleShipment, receivedMap)
        assertTrue(itemsWithRec.all { it.expectedQuantity == it.receivedQuantity })
    }

    // --- TIER 2: Boundary / Corner Cases (3 tests) ---

    @Test
    fun testTier2_InvalidShipmentTransitionThrows() {
        // Direct transition PENDING -> DELIVERED is illegal
        try {
            FulfillmentService.processShipmentTransition(sampleShipment, "DELIVERED")
            fail("Expected IllegalStateException")
        } catch (e: IllegalStateException) {
            // Success
        }
    }

    @Test
    fun testTier2_FinalizedShipmentStateChangeThrows() {
        val delivered = sampleShipment.copy(status = "DELIVERED")
        try {
            FulfillmentService.processShipmentTransition(delivered, "IN_TRANSIT")
            fail("Expected IllegalStateException")
        } catch (e: IllegalStateException) {
            // Success
        }
    }

    @Test
    fun testTier2_QrCodeMismatchFails() {
        val isVerified = FulfillmentService.verifyQrCode(sampleShipment, "WRONG_QR_CODE")
        assertFalse(isVerified)
    }

    // --- TIER 3: Cross-Feature Combinations (1 test) ---

    @Test
    fun testTier3_VerificationUpdatesStockLevels() {
        val currentStock = mapOf("item_patty" to 50, "item_bread" to 40)
        val receivedItems = listOf(
            ShipmentItem("item_patty", 100, receivedQuantity = 95),
            ShipmentItem("item_bread", 200, receivedQuantity = 200)
        )

        val updatedStock = FulfillmentService.updateStockOnReceipt(currentStock, receivedItems)

        assertEquals(145, updatedStock["item_patty"]) // 50 + 95
        assertEquals(240, updatedStock["item_bread"]) // 40 + 200
    }

    // --- TIER 4: Real-World Workload (1 test) ---

    @Test
    fun testTier4_CentralKitchenFulfillmentWorkflow() {
        // 1. Central Kitchen creates shipment (status: PENDING)
        var shipment = sampleShipment
        assertEquals("PENDING", shipment.status)

        // 2. Driver scans QR code to verify transit
        assertTrue(FulfillmentService.verifyQrCode(shipment, "QR_SIGNATURE_SJ12345"))
        shipment = FulfillmentService.processShipmentTransition(shipment, "IN_TRANSIT")
        assertEquals("IN_TRANSIT", shipment.status)

        // 3. Driver arrives at Sudirman Outlet. Manager scans QR and inputs goods receipt.
        assertTrue(FulfillmentService.verifyQrCode(shipment, "QR_SIGNATURE_SJ12345"))

        // Manager inputs received quantities (patty matches, but bread is missing 10 units)
        val receivedMap = mapOf("item_patty" to 100, "item_bread" to 190)
        val itemsWithRec = FulfillmentService.calculateDiscrepancies(shipment, receivedMap)

        // Check if there is discrepancy
        val hasDiscrepancy = itemsWithRec.any { it.expectedQuantity != it.receivedQuantity }
        assertTrue(hasDiscrepancy)

        // Transition status to DISCREPANCY
        shipment = FulfillmentService.processShipmentTransition(shipment, "DISCREPANCY")
        assertEquals("DISCREPANCY", shipment.status)

        // 4. Update Sudirman's local stock with the received amounts
        val localStock = mapOf("item_patty" to 10, "item_bread" to 15)
        val updatedStock = FulfillmentService.updateStockOnReceipt(localStock, itemsWithRec)

        assertEquals(110, updatedStock["item_patty"]) // 10 + 100
        assertEquals(205, updatedStock["item_bread"]) // 15 + 190
    }
}
