package com.sukashawarma.customer.ui.components

/**
 * Inisial avatar pelanggan: dua huruf pertama dari nama, lalu huruf pertama
 * email bila nama kosong. Satu sumber untuk SEMUA avatar -- dulu header
 * menampilkan "SK" yang ditulis mati, sementara Profil menampilkan inisial
 * asli, sehingga pelanggan melihat inisial orang lain di Beranda.
 */
fun inisialNama(nama: String?, email: String? = null): String {
    val dariNama = nama
        ?.trim()
        ?.split(Regex("\\s+"))
        ?.mapNotNull { kata -> kata.firstOrNull { it.isLetterOrDigit() } }
        ?.take(2)
        ?.joinToString("")
        ?.uppercase()
    if (!dariNama.isNullOrEmpty()) return dariNama

    val dariEmail = email?.trim()?.firstOrNull { it.isLetterOrDigit() }?.uppercase()
    return dariEmail ?: "?"
}
