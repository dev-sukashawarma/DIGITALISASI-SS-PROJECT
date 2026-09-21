package com.sukashawarma.customer.ui.profile

import com.sukashawarma.customer.data.uraiWaktuIso
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

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

    /**
     * Masa berlaku sesi dalam WIB, mis. "21 Oktober 2026, 14.30 WIB".
     * Null bila kosong atau tidak bisa dibaca, supaya layar menyembunyikan
     * barisnya alih-alih menampilkan teks mentah atau tanggal palsu.
     *
     * TIDAK memakai `java.time`: API 26, sedangkan minSdk aplikasi ini 24 --
     * dipanggil di HP Android 7 ia crash, dan tes JVM tak akan menangkapnya.
     * Penguraian lewat [uraiWaktuIso] yang sudah menangani variasi pecahan
     * detik & offset dari gateway.
     */
    fun formatBerlakuSampai(iso: String?): String? {
        val teks = teksAtauNull(iso) ?: return null
        val epoch = uraiWaktuIso(teks) ?: return null
        val format = SimpleDateFormat("d MMMM yyyy, HH.mm 'WIB'", Locale("id", "ID")).apply {
            timeZone = TimeZone.getTimeZone("Asia/Jakarta")
        }
        return format.format(Date(epoch))
    }
}
