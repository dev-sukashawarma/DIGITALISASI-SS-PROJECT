package com.sukashawarma.superapp.data

/**
 * Role kanonik ekosistem Suka Shawarma (kolom outlet_staff.role):
 * admin, owner, spv, leader, korlap, kasir, crew, kiosk, kitchen, mitra, staff_pusat.
 * JANGAN pakai role fiktif lama (manager/cashier/kitchen_staff).
 * Catatan: role "kasir" sudah dihapus dari DB (migration 20260626102000, dimigrasi ke crew) —
 * entri di set ini inert, dipertahankan untuk kompat.
 */
object Roles {
    /** Boleh absen wajah 1:1 di HP pribadi. */
    val ATTENDANCE = setOf("crew", "kasir", "kitchen", "spv", "leader", "korlap", "admin", "owner")

    /** Boleh mendaftarkan/re-enroll wajah crew (SPV/Leader/Area Manager/Regional Manager/Admin HR/Admin/Owner). */
    val ENROLLMENT = setOf("spv", "leader", "korlap", "admin", "admin_hr", "area_manager", "regional_manager", "owner")

    /** Akses modul stub Inventory/Fulfillment (belum fungsional — fase 3). */
    val STUB_MODULES = setOf("admin", "owner")
}
