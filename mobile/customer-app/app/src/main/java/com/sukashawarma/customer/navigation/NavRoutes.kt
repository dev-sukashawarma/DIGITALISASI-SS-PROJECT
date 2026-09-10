package com.sukashawarma.customer.navigation

object Rute {
    const val ONBOARDING = "onboarding"

    /**
     * `tujuan` menentukan ke mana pelanggan dibawa setelah berhasil masuk.
     * Tanpa ini, masuk dari titik bayar akan melempar pelanggan kembali ke
     * katalog dan memaksanya menyusuri keranjang lagi dari awal.
     */
    const val MASUK = "masuk?tujuan={tujuan}"
    fun masuk(tujuan: String = "katalog") = "masuk?tujuan=$tujuan"

    const val BERANDA = "beranda"
    const val MENU = "menu"
    const val KATALOG = "beranda"
    const val PILIH_OUTLET = "pilih-outlet"
    const val KERANJANG = "keranjang"
    const val CHECKOUT = "checkout"
    const val DETAIL = "detail/{menuItemId}"
    fun detail(menuItemId: String) = "detail/$menuItemId"

    const val BAYAR = "bayar"
    const val SUKSES = "sukses/{orderId}?nomor={nomor}"
    fun sukses(orderId: String, nomor: Int?) = "sukses/$orderId?nomor=${nomor ?: -1}"
    const val STATUS = "status/{orderId}"
    fun status(orderId: String) = "status/$orderId"
    const val RIWAYAT = "riwayat"
    const val PROFIL = "profil"
    const val NOTIFIKASI = "notifikasi"
}
