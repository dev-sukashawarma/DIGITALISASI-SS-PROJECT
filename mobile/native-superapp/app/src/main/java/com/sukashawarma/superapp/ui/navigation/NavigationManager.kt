package com.sukashawarma.superapp.ui.navigation

import com.sukashawarma.superapp.data.AuthRepository
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

        // Role-based gating
        if (staff != null && screen != Screen.Login) {
            val allowed = when (staff.role) {
                "admin" -> true
                "manager" -> screen != Screen.Login
                "cashier" -> screen == Screen.Dashboard
                "kitchen_staff" -> screen == Screen.Dashboard || screen == Screen.Fulfillment
                else -> screen == Screen.Dashboard
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
