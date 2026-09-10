package com.sukashawarma.customer.ui.home

/**
 * Ke mana ketukan banner membawa pelanggan.
 *
 * Daftar tertutup dengan sengaja: banner TIDAK boleh membuka URL bebas.
 * Siapa pun yang bisa menulis baris banner akan bisa mengarahkan pelanggan
 * ke alamat mana saja, dan itu tidak sebanding dengan manfaatnya.
 */
sealed class TujuanBanner {
    object TidakAda : TujuanBanner()
    object Menu : TujuanBanner()
    data class Item(val menuItemId: String) : TujuanBanner()
}

/**
 * Aksi yang tak dikenal jatuh ke [TujuanBanner.TidakAda], bukan melempar.
 * Aplikasi yang sudah terpasang harus tetap hidup kalau gateway suatu saat
 * mengirim aksi yang lebih baru daripada APK ini.
 */
fun tujuanBanner(aksi: String, targetMenuItemId: String?): TujuanBanner = when (aksi) {
    "menu" -> TujuanBanner.Menu
    "menu_item" -> targetMenuItemId?.takeIf { it.isNotBlank() }
        ?.let { TujuanBanner.Item(it) }
        ?: TujuanBanner.TidakAda
    else -> TujuanBanner.TidakAda
}

/** Popup tampil sekali per banner per pelanggan (keputusan owner K3). */
fun popupBolehTampil(popupId: String?, sudahDilihat: Set<String>): Boolean {
    if (popupId.isNullOrBlank()) return false
    return popupId !in sudahDilihat
}
