package com.sukashawarma.superapp.ui.features.dashboard

import com.sukashawarma.superapp.data.Roles

/** Menu dashboard fase 1 — hanya fitur yang benar-benar fungsional (jangan tampilkan tile mati). */
object DashboardMenu {
    fun menuFor(role: String?): List<String> = buildList {
        if (role in Roles.ENROLLMENT) add("Enrollment")
        if (role in Roles.ENROLLMENT) add("Kalibrasi Wajah")
        if (role in Roles.ATTENDANCE) add("Absensi")
    }
}
