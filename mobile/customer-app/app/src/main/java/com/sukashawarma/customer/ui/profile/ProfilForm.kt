package com.sukashawarma.customer.ui.profile

/**
 * Validasi form Informasi Akun. Cermin PERSIS dari
 * apps/retail-gateway/src/lib/profil.ts -- gateway tetap penentu, validasi di
 * sini hanya supaya pesan salah muncul tanpa menunggu jaringan.
 */
object ProfilForm {
    const val NAMA_MIN = 2
    const val NAMA_MAKS = 60

    fun rapikanNama(masukan: String): String = masukan.trim().replace(Regex("\\s+"), " ")

    /** Pesan salah untuk nama, atau null bila sah. */
    fun galatNama(masukan: String): String? {
        val rapi = rapikanNama(masukan)
        return when {
            rapi.length < NAMA_MIN -> "Nama minimal $NAMA_MIN huruf."
            rapi.length > NAMA_MAKS -> "Nama maksimal $NAMA_MAKS huruf."
            else -> null
        }
    }

    /** Nomor HP Indonesia -> bentuk kanonik 628xxxx, atau null bila tidak wajar. */
    fun normalisasiWhatsApp(masukan: String): String? {
        val bersih = masukan.replace(Regex("[\\s\\-().]"), "")
        val angka = when {
            bersih.startsWith("+62") -> "62" + bersih.substring(3)
            bersih.startsWith("62") -> bersih
            bersih.startsWith("0") -> "62" + bersih.substring(1)
            else -> return null
        }
        return if (Regex("^628\\d{7,12}$").matches(angka)) angka else null
    }

    /** Pesan salah untuk nomor WA, atau null bila sah. Kosong itu sah (tanpa nomor). */
    fun galatWhatsApp(masukan: String): String? {
        if (masukan.isBlank()) return null
        return if (normalisasiWhatsApp(masukan) == null) {
            "Nomor WhatsApp harus nomor HP Indonesia, mis. 0812 3456 7890."
        } else null
    }

    /**
     * Bentuk yang ditampilkan di kolom isian: 628xxxx -> 08xxxx, sebab begitulah
     * orang Indonesia menulis nomornya sendiri. Nilai lain dibiarkan apa adanya.
     */
    fun untukIsian(tersimpan: String?): String {
        val t = tersimpan?.trim().orEmpty()
        return if (t.startsWith("62")) "0" + t.substring(2) else t
    }
}
