package com.sukashawarma.superapp.ui.navigation

sealed class Screen(val route: String) {
    object Dashboard : Screen("dashboard")
    object Inventory : Screen("inventory")
    object Attendance : Screen("attendance")
    object Fulfillment : Screen("fulfillment")
    object Login : Screen("login")
    object Enroll : Screen("enroll")
    object FaceDebug : Screen("face_debug")
}
