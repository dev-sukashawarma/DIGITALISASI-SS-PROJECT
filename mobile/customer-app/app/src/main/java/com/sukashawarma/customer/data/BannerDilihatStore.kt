package com.sukashawarma.customer.data

import android.content.Context

/**
 * Id banner popup yang sudah pernah dilihat pelanggan di HP ini.
 *
 * SharedPreferences biasa, BUKAN terenkripsi seperti [SessionStore]: ini
 * preferensi tampilan, bukan identitas. Menyimpannya bersama token justru
 * mencampur data biasa ke dalam berkas yang seharusnya hanya berisi rahasia.
 *
 * Disimpan per-HP dengan sengaja. Pelanggan yang ganti HP atau menghapus
 * data akan melihat popup lagi; itu wajar dan tidak perlu ditutup dengan
 * menyimpannya di server.
 */
class BannerDilihatStore(context: Context) {

    private val prefs = context.getSharedPreferences(FILE_NAME, Context.MODE_PRIVATE)

    fun sudahDilihat(): Set<String> = prefs.getStringSet(KEY_DILIHAT, emptySet()) ?: emptySet()

    fun tandai(id: String) {
        // Salin dulu: getStringSet mengembalikan instance yang TIDAK boleh
        // diubah di tempat -- mengubahnya membuat perilaku simpan tak
        // terdefinisi menurut dokumentasi Android.
        val baru = sudahDilihat().toMutableSet().apply { add(id) }
        prefs.edit().putStringSet(KEY_DILIHAT, baru).apply()
    }

    private companion object {
        const val FILE_NAME = "banner_dilihat"
        const val KEY_DILIHAT = "popup_dilihat"
    }
}
