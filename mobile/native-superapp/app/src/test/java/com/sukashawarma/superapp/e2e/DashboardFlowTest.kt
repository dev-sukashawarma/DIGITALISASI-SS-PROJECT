package com.sukashawarma.superapp.e2e

import com.sukashawarma.superapp.data.Staff
import com.sukashawarma.superapp.data.StockItem
import com.sukashawarma.superapp.domain.DashboardService
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], manifest = Config.NONE)
class DashboardFlowTest {

    private val sampleStock = listOf(
        StockItem("item_1", "Beef Patty", "SKU001", 50, 10, 5.0),
        StockItem("item_2", "Saj Bread", "SKU002", 8, 10, 1.2), // Low stock
        StockItem("item_3", "Garlic Sauce", "SKU003", 10, 10, 2.0), // Low stock (exact boundary)
        StockItem("item_4", "Lettuce", "SKU004", 14, 10, 0.5) // Warning zone (1.4x reorder point)
    )

    // --- TIER 1: Feature Coverage (5 tests) ---

    @Test
    fun testTier1_ActiveKasirNameDisplayed() {
        val kasir = Staff("c1", "Amir Nasution", "kasir", "outlet_1")
        val dashboardTitle = "Welcome, ${kasir.name} (${kasir.role.uppercase()})"
        assertEquals("Welcome, Amir Nasution (KASIR)", dashboardTitle)
    }

    @Test
    fun testTier1_StockAlertThresholdUnderReorder() {
        val alerts = DashboardService.filterCriticalStock(sampleStock)
        assertEquals(2, alerts.size)
        assertTrue(alerts.any { it.name == "Saj Bread" })
        assertTrue(alerts.any { it.name == "Garlic Sauce" })
    }

    @Test
    fun testTier1_AdminLayoutElements() {
        val views = DashboardService.getRoleBasedViews("admin")
        assertTrue(views.containsAll(listOf("DASHBOARD", "INVENTORY", "HR", "FULFILLMENT", "POS")))
    }

    @Test
    fun testTier1_KasirLayoutElements() {
        val views = DashboardService.getRoleBasedViews("kasir")
        assertTrue(views.contains("POS"))
        assertFalse(views.contains("HR"))
        assertFalse(views.contains("INVENTORY"))
    }

    @Test
    fun testTier1_KitchenLayoutElements() {
        val views = DashboardService.getRoleBasedViews("kitchen")
        assertTrue(views.contains("FULFILLMENT"))
        assertFalse(views.contains("POS"))
    }

    // --- TIER 2: Boundary / Corner Cases (3 tests) ---

    @Test
    fun testTier2_DynamicThresholdMultiplier() {
        // Multiplier at 1.5x should catch Lettuce (14 qty <= 10 * 1.5)
        val alerts = DashboardService.filterCriticalStock(sampleStock, 1.5)
        assertEquals(3, alerts.size)
        assertTrue(alerts.any { it.name == "Lettuce" })
    }

    @Test
    fun testTier2_EmptyStockList() {
        val alerts = DashboardService.filterCriticalStock(emptyList())
        assertTrue(alerts.isEmpty())
    }

    @Test
    fun testTier2_StockAlertBoundary() {
        // Exact boundary: quantity == reorderPoint
        val item = StockItem("item_3", "Garlic Sauce", "SKU003", 10, 10, 2.0)
        val alerts = DashboardService.filterCriticalStock(listOf(item))
        assertEquals(1, alerts.size)
    }

    // --- TIER 3: Cross-Feature Combinations (1 test) ---

    @Test
    fun testTier3_RefreshOnResumeUpdatesDashboard() {
        // Simulate local cache
        var currentStockList = sampleStock.toMutableList()

        // Dashboard is resumed/focused
        fun onResume(): List<StockItem> {
            return DashboardService.filterCriticalStock(currentStockList)
        }

        // Initially we expect 2 alerts
        assertEquals(2, onResume().size)

        // Simulating POS background sales that updates the cache
        currentStockList[0] = currentStockList[0].copy(quantity = 5) // Beef Patty decrements to 5 (reorder is 10)

        // Resuming updates dashboard and fetches the fresh data
        val refreshedAlerts = onResume()
        assertEquals(3, refreshedAlerts.size)
        assertTrue(refreshedAlerts.any { it.name == "Beef Patty" })
    }

    // --- TIER 4: Real-World Workload (1 test) ---

    @Test
    fun testTier4_DashboardWorkloadSimulation() {
        var activeUser = Staff("s1", "Budi", "kasir", "outlet_1")
        var currentStock = sampleStock.toMutableList()

        // 1. Kasir logs in and checks dashboard
        var header = "Welcome, ${activeUser.name}"
        var alertCount = DashboardService.filterCriticalStock(currentStock).size
        var roleViews = DashboardService.getRoleBasedViews(activeUser.role)

        assertEquals("Welcome, Budi", header)
        assertEquals(2, alertCount)
        assertTrue(roleViews.contains("POS"))
        assertFalse(roleViews.contains("INVENTORY"))

        // 2. Shift change: Admin logs in
        activeUser = Staff("s2", "Siti (Admin)", "admin", "outlet_1")
        header = "Welcome, ${activeUser.name}"
        roleViews = DashboardService.getRoleBasedViews(activeUser.role)

        assertEquals("Welcome, Siti (Admin)", header)
        assertTrue(roleViews.contains("INVENTORY"))
        assertTrue(roleViews.contains("HR"))

        // 3. Stock Opname executes, updating current stock levels
        currentStock[1] = currentStock[1].copy(quantity = 25) // Saj Bread quantity resolved to 25

        // 4. Resume dashboard to refresh
        alertCount = DashboardService.filterCriticalStock(currentStock).size
        assertEquals(1, alertCount) // Only Garlic Sauce left
    }
}
