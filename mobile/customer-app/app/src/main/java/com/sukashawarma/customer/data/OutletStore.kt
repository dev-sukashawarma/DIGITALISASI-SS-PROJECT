package com.sukashawarma.customer.data

import android.content.Context

interface OutletPersistence {
    fun bacaId(): String?
    fun bacaNama(): String?
    fun simpan(id: String, nama: String)
    fun hapus()
}

/**
 * Outlet yang sedang dipilih pelanggan secara eksplisit.
 *
 * Hanya id dan nama yang disimpan. Status buka-tutup TIDAK disimpan — outlet
 * bisa tutup kapan saja.
 */
class OutletStore internal constructor(private val penyimpan: OutletPersistence) {

    constructor(context: Context) : this(PrefsOutletPersistence(context.applicationContext))

    fun simpan(id: String, nama: String) = penyimpan.simpan(id, nama)

    fun idTerpilih(): String? = penyimpan.bacaId()

    fun namaTerpilih(): String? = penyimpan.bacaNama()

    fun hapus() = penyimpan.hapus()

    companion object {
        private const val FILE_NAME = "suka_customer_outlet"
        private const val KEY_ID = "outlet_id"
        private const val KEY_NAMA = "outlet_nama"

        fun diMemori(): OutletStore = OutletStore(MemoriOutletPersistence())
    }

    private class PrefsOutletPersistence(context: Context) : OutletPersistence {
        private val prefs = context.getSharedPreferences(FILE_NAME, Context.MODE_PRIVATE)
        override fun bacaId(): String? = prefs.getString(KEY_ID, null)
        override fun bacaNama(): String? = prefs.getString(KEY_NAMA, null)
        override fun simpan(id: String, nama: String) {
            prefs.edit().putString(KEY_ID, id).putString(KEY_NAMA, nama).apply()
        }
        override fun hapus() {
            prefs.edit().remove(KEY_ID).remove(KEY_NAMA).apply()
        }
    }

    private class MemoriOutletPersistence : OutletPersistence {
        private var id: String? = null
        private var nama: String? = null
        override fun bacaId(): String? = id
        override fun bacaNama(): String? = nama
        override fun simpan(id: String, nama: String) {
            this.id = id
            this.nama = nama
        }
        override fun hapus() {
            id = null
            nama = null
        }
    }
}
