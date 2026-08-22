package com.sukashawarma.superapp.ui.features.dashboard

import org.junit.Assert.*
import org.junit.Test

class DashboardMenuTest {

    @Test
    fun crewHanyaAbsensi() {
        assertEquals(listOf("Absensi"), DashboardMenu.menuFor("crew"))
        assertEquals(listOf("Absensi"), DashboardMenu.menuFor("kasir"))
        assertEquals(listOf("Absensi"), DashboardMenu.menuFor("kitchen"))
    }

    @Test
    fun leaderDanAmDapatEnrollmentDanAbsensi() {
        for (role in listOf("leader", "area_manager", "spv", "korlap")) {
            assertEquals("role=$role", listOf("Enrollment", "Kalibrasi Wajah", "Absensi"), DashboardMenu.menuFor(role))
        }
    }

    @Test
    fun rmHrAdminOwnerDapatSettingAbsensiLengkap() {
        for (role in listOf("regional_manager", "admin_hr", "admin", "owner")) {
            assertEquals("role=$role", listOf("Enrollment", "Setting Absensi", "Kalibrasi Wajah", "Absensi"), DashboardMenu.menuFor(role))
        }
    }

    @Test
    fun roleLainTanpaMenu() {
        assertEquals(emptyList<String>(), DashboardMenu.menuFor("mitra"))
        assertEquals(emptyList<String>(), DashboardMenu.menuFor("staff_pusat"))
        assertEquals(emptyList<String>(), DashboardMenu.menuFor(null))
    }

    @Test
    fun roleLamaFiktifTidakDapatApapun() {
        // manager/cashier/kitchen_staff bukan role kanonik — tidak boleh diam-diam dapat akses
        assertEquals(emptyList<String>(), DashboardMenu.menuFor("manager"))
        assertEquals(emptyList<String>(), DashboardMenu.menuFor("cashier"))
        assertEquals(emptyList<String>(), DashboardMenu.menuFor("kitchen_staff"))
    }
}
