package com.sukashawarma.superapp.e2e

import com.sukashawarma.superapp.data.LedgerEntry
import com.sukashawarma.superapp.data.StockItem
import com.sukashawarma.superapp.domain.InventoryService
import com.sukashawarma.superapp.domain.InventoryService.TransferSuggestion
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.util.Date

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], manifest = Config.NONE)
class InventoryFlowTest {

    // --- TIER 1: Feature Coverage (5 tests) ---

    @Test
    fun testTier1_OpnameDifferencePositive() {
        val diff = InventoryService.computeOpnameDifference(expected = 100, actual = 120)
        assertEquals(20, diff) // surplus
    }

    @Test
    fun testTier1_OpnameDifferenceNegative() {
        val diff = InventoryService.computeOpnameDifference(expected = 100, actual = 85)
        assertEquals(-15, diff) // deficit
    }

    @Test
    fun testTier1_LedgerEntryCreation() {
        val timestamp = Date()
        val entry = InventoryService.createLedgerEntry(
            id = "ledger_99",
            stockItemId = "item_patty",
            outletId = "outlet_sudirman",
            change = -5,
            reason = "SALE",
            timestamp = timestamp
        )
        assertEquals("ledger_99", entry.id)
        assertEquals("item_patty", entry.stockItemId)
        assertEquals("outlet_sudirman", entry.outletId)
        assertEquals(-5, entry.change)
        assertEquals("SALE", entry.reason)
        assertEquals(timestamp, entry.timestamp)
    }

    @Test
    fun testTier1_ReorderStatusNormal() {
        val status = InventoryService.getReorderStatus(quantity = 25, reorderPoint = 10)
        assertEquals("NORMAL", status)
    }

    @Test
    fun testTier1_ReorderStatusWarning() {
        val status = InventoryService.getReorderStatus(quantity = 14, reorderPoint = 10)
        assertEquals("WARNING", status)
    }

    // --- TIER 2: Boundary / Corner Cases (4 tests) ---

    @Test
    fun testTier2_OpnameDifferenceZero() {
        val diff = InventoryService.computeOpnameDifference(expected = 50, actual = 50)
        assertEquals(0, diff)
    }

    @Test
    fun testTier2_ReorderStatusCritical() {
        val status = InventoryService.getReorderStatus(quantity = 10, reorderPoint = 10)
        assertEquals("CRITICAL", status)
    }

    @Test
    fun testTier2_ReorderStatusOutOfStock() {
        val status = InventoryService.getReorderStatus(quantity = 0, reorderPoint = 10)
        assertEquals("OUT_OF_STOCK", status)
    }

    @Test
    fun testTier2_GreedyTransferSuggestionSingle() {
        // Outlet A has 25 patties (reorder point 10) -> Surplus of +15
        // Outlet B has 5 patties (reorder point 10) -> Deficit of -5
        val outletStocks = mapOf("outlet_A" to 25, "outlet_B" to 5)
        val reorderPoints = mapOf("outlet_A" to 10, "outlet_B" to 10)

        val suggestions = InventoryService.generateTransferSuggestions("item_patty", outletStocks, reorderPoints)
        assertEquals(1, suggestions.size)
        val sugg = suggestions[0]
        assertEquals("item_patty", sugg.stockItemId)
        assertEquals("outlet_A", sugg.fromOutletId)
        assertEquals("outlet_B", sugg.toOutletId)
        assertEquals(5, sugg.quantity)
    }

    // --- TIER 3: Cross-Feature Combinations (1 test) ---

    @Test
    fun testTier3_OpnameMismatchCreatesLedgerAndAdjustsStock() {
        val originalStock = StockItem("item_patty", "Patty", "SKU1", 50, 10, 2.5)

        // Physical opname count: 42 (missing 8)
        val actualCount = 42
        val diff = InventoryService.computeOpnameDifference(originalStock.quantity, actualCount)
        assertEquals(-8, diff)

        // If there is a mismatch, update stock and create ledger entry
        val updatedStock = originalStock.copy(quantity = actualCount)
        val ledger = InventoryService.createLedgerEntry(
            id = "ledger_opname_1",
            stockItemId = updatedStock.id,
            outletId = "outlet_1",
            change = diff,
            reason = "OPNAME"
        )

        assertEquals(42, updatedStock.quantity)
        assertEquals(-8, ledger.change)
        assertEquals("OPNAME", ledger.reason)
    }

    // --- TIER 4: Real-World Workload (1 test) ---

    @Test
    fun testTier4_EndToEndStockOptimizationWorkload() {
        // Multi-outlet scenario for "Saj Bread" (reorder point 20 for all)
        val reorderPoints = mapOf(
            "Central_Kitchen" to 50, // supply hub
            "Outlet_Thamrin" to 20,
            "Outlet_Kemang" to 20,
            "Outlet_Depok" to 20
        )

        // Stocks
        // Central: 120 (surplus of +70)
        // Thamrin: 5 (deficit of -15)
        // Kemang: 25 (surplus of +5)
        // Depok: 0 (deficit of -20)
        val stocks = mapOf(
            "Central_Kitchen" to 120,
            "Outlet_Thamrin" to 5,
            "Outlet_Kemang" to 25,
            "Outlet_Depok" to 0
        )

        // Generate greedy transfers
        val suggestions = InventoryService.generateTransferSuggestions("saj_bread", stocks, reorderPoints)

        // Let's analyze suggestions:
        // Surpluses: Central (+70), Kemang (+5)
        // Deficits: Depok (-20), Thamrin (-15)
        // Greedy matching:
        // Central (+70) transfers to Depok (needs 20) -> Central surplus becomes +50
        // Central (+50) transfers to Thamrin (needs 15) -> Central surplus becomes +35
        // Remaining surpluses: Central (+35), Kemang (+5). Deficits: 0
        assertEquals(2, suggestions.size)

        val first = suggestions.find { it.toOutletId == "Outlet_Depok" }!!
        assertEquals("Central_Kitchen", first.fromOutletId)
        assertEquals(20, first.quantity)

        val second = suggestions.find { it.toOutletId == "Outlet_Thamrin" }!!
        assertEquals("Central_Kitchen", second.fromOutletId)
        assertEquals(15, second.quantity)
    }
}
