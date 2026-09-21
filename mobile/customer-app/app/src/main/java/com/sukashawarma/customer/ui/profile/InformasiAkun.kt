package com.sukashawarma.customer.ui.profile

/**
 * Logika murni halaman Informasi Akun, dipisah supaya bisa diuji tanpa Android.
 */
object InformasiAkun {

    /** Inisial untuk avatar: huruf pertama dari dua kata pertama nama. */
    fun inisial(nama: String?): String {
        val huruf = nama
            ?.trim()
            ?.split(Regex("\\s+"))
            ?.filter { it.isNotEmpty() }
            ?.take(2)
            ?.map { it.first().uppercaseChar() }
            ?.joinToString("")
        return if (huruf.isNullOrEmpty()) "SS" else huruf
    }

    /** Teks kosong atau hanya spasi dianggap tidak ada. */
    fun teksAtauNull(nilai: String?): String? = nilai?.trim()?.takeIf { it.isNotEmpty() }
}
