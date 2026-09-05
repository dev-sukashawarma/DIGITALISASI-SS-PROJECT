package com.sukashawarma.customer.data

import android.content.Context

/**
 * Outlet yang sedang dipilih pelanggan.
 *
 * SharedPreferences biasa, BUKAN terenkripsi seperti [SessionStore]: ini
 * preferensi tampilan, bukan identitas. Menyimpannya bersama token justru
 * mencampur data biasa ke dalam berkas yang seharusnya hanya berisi rahasia.
 *
 * Hanya id dan nama yang disimpan. Status buka-tutup TIDAK disimpan — outlet
 * bisa tutup kapan saja, dan status basi yang tersimpan di HP akan membuat
 * aplikasi menjanjikan outlet buka padahal sudah tidak.
 */
class OutletStore(context: Context) {

    private val prefs = context.getSharedPreferences(FILE_NAME, Context.MODE_PRIVATE)

    fun simpan(id: String, nama: String) {
        prefs.edit().putString(KEY_ID, id).putString(KEY_NAMA, nama).apply()
    }

    fun idTerpilih(): String? = prefs.getString(KEY_ID, null)

    fun namaTerpilih(): String? = prefs.getString(KEY_NAMA, null)

    fun hapus() {
        prefs.edit().remove(KEY_ID).remove(KEY_NAMA).apply()
    }

    private companion object {
        const val FILE_NAME = "suka_customer_outlet"
        const val KEY_ID = "outlet_id"
        const val KEY_NAMA = "outlet_nama"
    }
}
