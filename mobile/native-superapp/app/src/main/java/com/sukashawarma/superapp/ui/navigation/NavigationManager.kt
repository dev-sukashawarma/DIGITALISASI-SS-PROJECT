package com.sukashawarma.superapp.ui.navigation

import com.sukashawarma.superapp.data.AuthRepository
import com.sukashawarma.superapp.data.Roles
import com.sukashawarma.superapp.data.Staff

class NavigationManager(private val authRepository: AuthRepository) {
    private var currentScreen: Screen = Screen.Login
    private val backStack = mutableListOf<Screen>()

    fun navigateTo(screen: Screen, staff: Staff? = null): Boolean {
        if (!authRepository.isAuthenticated() && screen != Screen.Login) {
            currentScreen = Screen.Login
            backStack.clear()
            return false
        }

        // Role-based gating (role kanonik — lihat Roles.kt)
        if (staff != null && screen != Screen.Login) {
            val allowed = when (screen) {
                Screen.Login, Screen.Dashboard -> true
                Screen.Attendance -> staff.role in Roles.ATTENDANCE
                Screen.Enroll -> staff.role in Roles.ENROLLMENT
                Screen.Inventory, Screen.Fulfillment -> staff.role in Roles.STUB_MODULES
            }
            if (!allowed) {
                return false // Navigation Gated
            }
        }

        backStack.add(currentScreen)
        currentScreen = screen
        return true
    }

    fun getCurrentScreen(): Screen = currentScreen

    fun getBackStackSize(): Int = backStack.size

    fun goBack(): Boolean {
        if (backStack.isNotEmpty()) {
            currentScreen = backStack.removeAt(backStack.size - 1)
            return true
        }
        return false
    }

    fun logout() {
        authRepository.logout()
        currentScreen = Screen.Login
        backStack.clear()
    }
}
