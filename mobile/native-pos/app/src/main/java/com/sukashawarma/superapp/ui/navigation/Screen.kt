package com.sukashawarma.superapp.ui.navigation

sealed class Screen(val route: String) {
    object POS : Screen("pos")
    object Login : Screen("login")
}
