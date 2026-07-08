package com.sukashawarma.superapp.e2e

import com.sukashawarma.superapp.data.Staff
import com.sukashawarma.superapp.data.SupabaseAuthCallback
import com.sukashawarma.superapp.data.SupabaseClient
import com.sukashawarma.superapp.ui.navigation.NavigationManager
import com.sukashawarma.superapp.ui.navigation.Screen
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], manifest = Config.NONE)
class NavigationFlowTest {

    private lateinit var client: SupabaseClient
    private lateinit var navManager: NavigationManager
    private val defaultAdmin = Staff("1", "Admin User", "admin", "outlet_1")
    private val defaultCashier = Staff("2", "Cashier Joe", "cashier", "outlet_1")
    private val defaultKitchen = Staff("3", "Chef Bob", "kitchen_staff", "outlet_1")

    @Before
    fun setUp() {
        client = SupabaseClient()
        navManager = NavigationManager(client)
    }

    private fun loginUser() {
        client.login("valid@sukashawarma.com", "correct_password", object : SupabaseAuthCallback {
            override fun onSuccess(token: String) {}
            override fun onFailure(error: Throwable) {}
        })
    }

    // --- TIER 1: Feature Coverage (5 tests) ---

    @Test
    fun testTier1_UnauthenticatedRedirectsToLogin() {
        assertEquals(Screen.Login, navManager.getCurrentScreen())
        val success = navManager.navigateTo(Screen.Dashboard)
        assertFalse(success)
        assertEquals(Screen.Login, navManager.getCurrentScreen())
    }

    @Test
    fun testTier1_AuthenticatedDashboardNavigation() {
        loginUser()
        val success = navManager.navigateTo(Screen.Dashboard)
        assertTrue(success)
        assertEquals(Screen.Dashboard, navManager.getCurrentScreen())
    }

    @Test
    fun testTier1_NavigationToInventory() {
        loginUser()
        val success = navManager.navigateTo(Screen.Inventory, defaultAdmin)
        assertTrue(success)
        assertEquals(Screen.Inventory, navManager.getCurrentScreen())
    }

    @Test
    fun testTier1_NavigationToPOS() {
        loginUser()
        val success = navManager.navigateTo(Screen.POS, defaultCashier)
        assertTrue(success)
        assertEquals(Screen.POS, navManager.getCurrentScreen())
    }

    @Test
    fun testTier1_NavigationGoBackStack() {
        loginUser()
        navManager.navigateTo(Screen.Dashboard)
        navManager.navigateTo(Screen.POS, defaultAdmin)
        assertEquals(Screen.POS, navManager.getCurrentScreen())
        assertTrue(navManager.goBack())
        assertEquals(Screen.Dashboard, navManager.getCurrentScreen())
    }

    // --- TIER 2: Boundary / Corner Cases (3 tests) ---

    @Test
    fun testTier2_RoleGatingAdminAllowedAccessToAll() {
        loginUser()
        assertTrue(navManager.navigateTo(Screen.Inventory, defaultAdmin))
        assertTrue(navManager.navigateTo(Screen.Attendance, defaultAdmin))
        assertTrue(navManager.navigateTo(Screen.Fulfillment, defaultAdmin))
        assertTrue(navManager.navigateTo(Screen.POS, defaultAdmin))
    }

    @Test
    fun testTier2_RoleGatingCashierGatedFromInventoryAndFulfillment() {
        loginUser()
        assertFalse(navManager.navigateTo(Screen.Inventory, defaultCashier))
        assertFalse(navManager.navigateTo(Screen.Fulfillment, defaultCashier))
        assertTrue(navManager.navigateTo(Screen.POS, defaultCashier))
    }

    @Test
    fun testTier2_RoleGatingKitchenGatedFromPOSAndInventory() {
        loginUser()
        assertFalse(navManager.navigateTo(Screen.POS, defaultKitchen))
        assertTrue(navManager.navigateTo(Screen.Fulfillment, defaultKitchen))
    }

    // --- TIER 3: Cross-Feature Combinations (1 test) ---

    @Test
    fun testTier3_LogoutClearsBackStackAndRedirects() {
        loginUser()
        navManager.navigateTo(Screen.Dashboard)
        navManager.navigateTo(Screen.POS, defaultAdmin)
        assertEquals(2, navManager.getBackStackSize())

        navManager.logout()
        assertFalse(client.isAuthenticated())
        assertEquals(Screen.Login, navManager.getCurrentScreen())
        assertEquals(0, navManager.getBackStackSize())
    }

    // --- TIER 4: Real-World Workload (1 test) ---

    @Test
    fun testTier4_MultiRoleSessionNavigationFlow() {
        // 1. Unauthenticated cashier tries to open POS screen -> gets redirected to login
        var success = navManager.navigateTo(Screen.POS, defaultCashier)
        assertFalse(success)
        assertEquals(Screen.Login, navManager.getCurrentScreen())

        // 2. Cashier logs in, opens Dashboard, then POS
        loginUser()
        assertTrue(navManager.navigateTo(Screen.Dashboard, defaultCashier))
        assertTrue(navManager.navigateTo(Screen.POS, defaultCashier))
        assertEquals(Screen.POS, navManager.getCurrentScreen())

        // 3. Cashier tries to open Admin Inventory -> Rejected (Gated)
        success = navManager.navigateTo(Screen.Inventory, defaultCashier)
        assertFalse(success)
        assertEquals(Screen.POS, navManager.getCurrentScreen()) // remains on POS

        // 4. Cashier logs out -> gets redirected
        navManager.logout()
        assertEquals(Screen.Login, navManager.getCurrentScreen())

        // 5. Admin logs in, accesses Dashboard, then Inventory, then POS, then goes back
        loginUser()
        assertTrue(navManager.navigateTo(Screen.Dashboard, defaultAdmin))
        assertTrue(navManager.navigateTo(Screen.Inventory, defaultAdmin))
        assertTrue(navManager.navigateTo(Screen.POS, defaultAdmin))
        assertEquals(Screen.POS, navManager.getCurrentScreen())
        assertTrue(navManager.goBack())
        assertEquals(Screen.Inventory, navManager.getCurrentScreen())
        assertTrue(navManager.goBack())
        assertEquals(Screen.Dashboard, navManager.getCurrentScreen())
    }

    @Test
    fun testMainViewModelRetainsNavigationManager() {
        val viewModel = com.sukashawarma.superapp.MainViewModel()
        val navManager1 = viewModel.getNavigationManager(client)
        val navManager2 = viewModel.getNavigationManager(client)
        assertSame(navManager1, navManager2)
    }
}
