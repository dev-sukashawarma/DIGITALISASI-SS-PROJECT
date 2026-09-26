package com.sukashawarma.customer.ui.home

import com.sukashawarma.customer.data.api.MenuItemDto

/** Beranda menampilkan grid 2 kolom. */
const val JUMLAH_MENU_TERLARIS = 2

/** Aturan lama, dipakai bila admin belum mengkurasi (atau semua pilihannya habis). */
private val KATA_KUNCI_CADANGAN = listOf("Ayam", "Sapi")

/**
 * Menu Terlaris di Beranda.
 *
 * Urutan kurasi admin (`menu_terlaris_ids` dari /config) diikuti, melewati
 * menu yang tidak ada di katalog outlet ini atau sedang habis -- yang di
 * bawahnya otomatis naik. Kalau tak satu pun tersisa, aturan lama dipakai
 * supaya bagian ini tidak kosong.
 */
fun pilihMenuTerlaris(katalog: List<MenuItemDto>, kurasiIds: List<String>): List<MenuItemDto> {
    val tersedia = katalog.filter { it.isAvailable }
    val peta = tersedia.associateBy { it.id }
    val dariKurasi = kurasiIds.distinct().mapNotNull { peta[it] }.take(JUMLAH_MENU_TERLARIS)
    if (dariKurasi.isNotEmpty()) return dariKurasi

    val cocok = KATA_KUNCI_CADANGAN.mapNotNull { kata ->
        tersedia.firstOrNull { it.name.contains(kata, ignoreCase = true) }
    }.distinct()
    return (if (cocok.isEmpty()) tersedia else cocok).take(JUMLAH_MENU_TERLARIS)
}
