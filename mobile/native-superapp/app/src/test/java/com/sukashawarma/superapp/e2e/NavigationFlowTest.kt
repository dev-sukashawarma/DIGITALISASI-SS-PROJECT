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
    private val defaultKasir = Staff("2", "Kasir Joe", "kasir", "outlet_1")
    private val defaultKitchen = Staff("3", "Chef Bob", "kitchen", "outlet_1")

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
    fun testTier1_NavigationGoBackStack() {
        loginUser()
        navManager.navigateTo(Screen.Dashboard)
        navManager.navigateTo(Screen.Inventory, defaultAdmin)
        assertEquals(Screen.Inventory, navManager.getCurrentScreen())
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
    }

    @Test
    fun testTier2_RoleGatingKasirGatedFromInventoryAndFulfillment() {
        loginUser()
        assertFalse(navManager.navigateTo(Screen.Inventory, defaultKasir))
        assertFalse(navManager.navigateTo(Screen.Fulfillment, defaultKasir))
    }

    @Test
    fun testTier2_RoleGatingKitchenGatedFromInventory() {
        loginUser()
        assertFalse(navManager.navigateTo(Screen.Inventory, defaultKitchen))
        assertFalse(navManager.navigateTo(Screen.Fulfillment, defaultKitchen)) // dulu true; stub kini admin/owner only
    }

    @Test
    fun testRoleGating_CrewBolehAbsensiTapiTidakEnroll() {
        loginUser()
        val crew = Staff("4", "Crew Andi", "crew", "outlet_1")
        assertTrue(navManager.navigateTo(Screen.Attendance, crew))
        assertFalse(navManager.navigateTo(Screen.Enroll, crew))
    }

    @Test
    fun testRoleGating_SpvBolehEnroll() {
        loginUser()
        val spv = Staff("5", "SPV Budi", "spv", "outlet_1")
        assertTrue(navManager.navigateTo(Screen.Enroll, spv))
    }

    // --- TIER 3: Cross-Feature Combinations (1 test) ---

    @Test
    fun testTier3_LogoutClearsBackStackAndRedirects() {
        loginUser()
        navManager.navigateTo(Screen.Dashboard)
        navManager.navigateTo(Screen.Inventory, defaultAdmin)
        assertEquals(2, navManager.getBackStackSize())

        navManager.logout()
        assertFalse(client.isAuthenticated())
        assertEquals(Screen.Login, navManager.getCurrentScreen())
        assertEquals(0, navManager.getBackStackSize())
    }

    // --- TIER 4: Real-World Workload (1 test) ---

    @Test
    fun testTier4_MultiRoleSessionNavigationFlow() {
        // 1. Unauthenticated kasir tries to open Inventory screen -> gets redirected to login
        var success = navManager.navigateTo(Screen.Inventory, defaultKasir)
        assertFalse(success)
        assertEquals(Screen.Login, navManager.getCurrentScreen())

        // 2. Kasir logs in, opens Dashboard
        loginUser()
        assertTrue(navManager.navigateTo(Screen.Dashboard, defaultKasir))

        // 3. Kasir tries to open Admin Inventory -> Rejected (Gated)
        success = navManager.navigateTo(Screen.Inventory, defaultKasir)
        assertFalse(success)
        assertEquals(Screen.Dashboard, navManager.getCurrentScreen()) // remains on Dashboard

        // 4. Kasir logs out -> gets redirected
        navManager.logout()
        assertEquals(Screen.Login, navManager.getCurrentScreen())

        // 5. Admin logs in, accesses Dashboard, then Inventory, then goes back
        loginUser()
        assertTrue(navManager.navigateTo(Screen.Dashboard, defaultAdmin))
        assertTrue(navManager.navigateTo(Screen.Inventory, defaultAdmin))
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
