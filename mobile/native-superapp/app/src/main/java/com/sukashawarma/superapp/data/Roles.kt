package com.sukashawarma.superapp.data

/**
 * Role kanonik ekosistem Suka Shawarma (kolom outlet_staff.role):
 * admin, owner, spv, leader, korlap, kasir, crew, kiosk, kitchen, mitra, staff_pusat.
 * JANGAN pakai role fiktif lama (manager/cashier/kitchen_staff).
 */
object Roles {
    /** Boleh absen wajah 1:1 di HP pribadi. */
    val ATTENDANCE = setOf("crew", "kasir", "kitchen", "spv", "leader", "korlap", "admin", "owner")

    /** Boleh mendaftarkan/re-enroll wajah crew (SPV/leader-driven, konsisten kebijakan web). */
    val ENROLLMENT = setOf("spv", "leader", "korlap", "admin", "owner")

    /** Akses modul stub Inventory/Fulfillment (belum fungsional — fase 3). */
    val STUB_MODULES = setOf("admin", "owner")
}
