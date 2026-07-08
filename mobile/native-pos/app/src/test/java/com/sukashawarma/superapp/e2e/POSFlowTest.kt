package com.sukashawarma.superapp.e2e

import com.sukashawarma.superapp.data.*
import com.sukashawarma.superapp.domain.InventoryService
import com.sukashawarma.superapp.domain.POSService
import com.sukashawarma.superapp.ui.navigation.NavigationManager
import com.sukashawarma.superapp.ui.navigation.Screen
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], manifest = Config.NONE)
class POSFlowTest {

    private lateinit var client: SupabaseClient
    private lateinit var navManager: NavigationManager

    // Items
    private val patty = StockItem("patty", "Beef Patty", "SKU1", 100, 20, 3.5)
    private val bread = StockItem("bread", "Saj Bread", "SKU2", 150, 30, 0.8)
    private val sauce = StockItem("sauce", "Garlic Sauce", "SKU3", 80, 15, 0.4)

    // Recipe for Shawarma Large: 1 patty, 1 bread, 2 units of sauce
    private val shawarmaRecipe = Recipe(
        productId = "prod_shawarma_lg",
        ingredients = listOf(
            RecipeIngredient("patty", 1),
            RecipeIngredient("bread", 1),
            RecipeIngredient("sauce", 2)
        )
    )

    private val sampleRecipes = mapOf("prod_shawarma_lg" to shawarmaRecipe)

    @Before
    fun setUp() {
        client = SupabaseClient()
        navManager = NavigationManager(client)
    }

    // --- TIER 1: Feature Coverage (5 tests) ---

    @Test
    fun testTier1_RealtimeChannelSubscriptionRegistration() {
        var callbackRegistered = false
        client.subscribeToChannel("pos_login", "test", object : RealtimeSubscriptionCallback {
            override fun onEvent(event: String, payload: Map<String, Any>) {
                callbackRegistered = true
            }
        })
        client.triggerRealtimeEvent("pos_login", "test", emptyMap())
        assertTrue(callbackRegistered)
    }

    @Test
    fun testTier1_RealtimeEventTriggerCallback() {
        val payloadRef = AtomicReference<Map<String, Any>>()
        client.subscribeToChannel("pos_events", "checkout", object : RealtimeSubscriptionCallback {
            override fun onEvent(event: String, payload: Map<String, Any>) {
                payloadRef.set(payload)
            }
        })
        client.triggerRealtimeEvent("pos_events", "checkout", mapOf("amount" to 45.0))
        assertNotNull(payloadRef.get())
        assertEquals(45.0, payloadRef.get()["amount"])
    }

    @Test
    fun testTier1_CalculateCartCogsMultipleItems() {
        val cart = listOf(
            CartItem(patty, 2), // 2 * 3.5 = 7.0
            CartItem(bread, 3)  // 3 * 0.8 = 2.4
        )
        val totalCogs = POSService.calculateCartCogs(cart)
        assertEquals(9.4, totalCogs, 0.001)
    }

    @Test
    fun testTier1_RecipeIngredientStockDeduction() {
        val stock = mapOf("patty" to 10, "bread" to 10, "sauce" to 10)
        val updatedStock = POSService.deductRecipeIngredients(stock, sampleRecipes, "prod_shawarma_lg", 3)

        assertEquals(7, updatedStock["patty"]) // 10 - (1*3)
        assertEquals(7, updatedStock["bread"]) // 10 - (1*3)
        assertEquals(4, updatedStock["sauce"]) // 10 - (2*3)
    }

    @Test
    fun testTier1_RecipeCartCogsSingleItem() {
        val cart = listOf(CartItem(sauce, 5)) // 5 * 0.4 = 2.0
        assertEquals(2.0, POSService.calculateCartCogs(cart), 0.001)
    }

    // --- TIER 2: Boundary / Corner Cases (3 tests) ---

    @Test
    fun testTier2_RecipeDeductionFailsOnInsufficientStock() {
        val stock = mapOf("patty" to 2, "bread" to 10, "sauce" to 10)
        try {
            POSService.deductRecipeIngredients(stock, sampleRecipes, "prod_shawarma_lg", 3) // needs 3 patties, only has 2
            fail("Should fail due to insufficient stock")
        } catch (e: IllegalArgumentException) {
            // Success
        }
    }

    @Test
    fun testTier2_EmptyCartCogs() {
        val total = POSService.calculateCartCogs(emptyList())
        assertEquals(0.0, total, 0.0)
    }

    @Test
    fun testTier2_ProductWithNoRecipeDoesNotModifyStock() {
        val stock = mapOf("patty" to 10)
        val updatedStock = POSService.deductRecipeIngredients(stock, emptyMap(), "non_existent_prod", 1)
        assertEquals(10, updatedStock["patty"])
    }

    // --- TIER 3: Cross-Feature Combinations (1 test) ---

    @Test
    fun testTier3_RealtimeAutoLoginUpdatesClientAndRedirects() {
        // Cashier scans QR code which fires a realtime channel event
        client.subscribeToChannel("auth_qr_channel", "login_event", object : RealtimeSubscriptionCallback {
            override fun onEvent(event: String, payload: Map<String, Any>) {
                if (event == "login_event") {
                    val email = payload["email"] as String
                    val password = payload["password"] as String
                    client.login(email, password, object : SupabaseAuthCallback {
                        override fun onSuccess(token: String) {
                            navManager.navigateTo(Screen.Dashboard)
                        }
                        override fun onFailure(error: Throwable) {}
                    })
                }
            }
        })

        // Verify initial state
        assertFalse(client.isAuthenticated())
        assertEquals(Screen.Login, navManager.getCurrentScreen())

        // Fire auto-login event
        client.triggerRealtimeEvent(
            "auth_qr_channel",
            "login_event",
            mapOf("email" to "valid@sukashawarma.com", "password" to "correct_password")
        )

        // Verify authenticated and navigated
        assertTrue(client.isAuthenticated())
        assertEquals(Screen.Dashboard, navManager.getCurrentScreen())
    }

    // --- TIER 4: Real-World Workload (1 test) ---

    @Test
    fun testTier4_POSBusyCheckoutAndOptimizeWorkflow() {
        // 1. Cashier checks out 25 units of "Suka Shawarma Large"
        // Current Stock at Sudirman branch
        val sudirmanStock = mapOf("patty" to 40, "bread" to 100, "sauce" to 50)

        // Deduct ingredients
        val afterCheckoutStock = POSService.deductRecipeIngredients(sudirmanStock, sampleRecipes, "prod_shawarma_lg", 25)

        // Beef Patty: 40 - (25 * 1) = 15. Reorder point is 20.
        // Saj Bread: 100 - (25 * 1) = 75. Reorder point is 30.
        // Garlic Sauce: 50 - (25 * 2) = 0. Reorder point is 15.
        assertEquals(15, afterCheckoutStock["patty"]!!)
        assertEquals(75, afterCheckoutStock["bread"]!!)
        assertEquals(0, afterCheckoutStock["sauce"]!!)

        // 2. Both patty and sauce fall below reorder point!
        // We run optimization suggestion search.
        // Central Kitchen stocks:
        val centralStocks = mapOf("patty" to 100, "sauce" to 80)
        val sudirmanStocks = mapOf("patty" to 15, "sauce" to 0)

        // Reorder points:
        val reorderPoints = mapOf("central" to 30, "sudirman" to 20)

        // Run optimization for Beef Patty
        val pattyStocks = mapOf("central" to 100, "sudirman" to 15)
        val pattyRPs = mapOf("central" to 30, "sudirman" to 20)
        val pattyTransfers = InventoryService.generateTransferSuggestions("patty", pattyStocks, pattyRPs)

        // Surplus for central: 100 - 30 = 70. Deficit for sudirman: 15 - 20 = -5 (need 5).
        assertEquals(1, pattyTransfers.size)
        assertEquals("central", pattyTransfers[0].fromOutletId)
        assertEquals("sudirman", pattyTransfers[0].toOutletId)
        assertEquals(5, pattyTransfers[0].quantity)

        // Run optimization for Garlic Sauce
        val sauceStocks = mapOf("central" to 80, "sudirman" to 0)
        val sauceRPs = mapOf("central" to 15, "sudirman" to 15)
        val sauceTransfers = InventoryService.generateTransferSuggestions("sauce", sauceStocks, sauceRPs)

        // Surplus for central: 80 - 15 = 65. Deficit for sudirman: 0 - 15 = -15 (need 15).
        assertEquals(1, sauceTransfers.size)
        assertEquals("central", sauceTransfers[0].fromOutletId)
        assertEquals("sudirman", sauceTransfers[0].toOutletId)
        assertEquals(15, sauceTransfers[0].quantity)
    }
}
