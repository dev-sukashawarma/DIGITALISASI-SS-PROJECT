package com.sukashawarma.customer.data

import android.content.Context

/** Penyimpanan pasangan kunci-nilai sederhana untuk [OrderAttemptStore]; dipisah agar bisa diuji di JVM. */
interface AttemptPersistence {
    fun baca(kunci: String): String?
    fun tulis(kunci: String, nilai: String)
    fun hapusSemua(kunci: List<String>)
}

/**
 * Percobaan pemesanan yang sedang berjalan.
 *
 * Menyimpan `client_order_id`, `order_id`, `payment_url`, dan `cart_fingerprint`
 * lintas proses. Sidik jari keranjang memastikan perubahan keranjang/voucher/outlet
 * tidak diam-diam melanjutkan QRIS pesanan lama.
 */
class OrderAttemptStore internal constructor(private val penyimpan: AttemptPersistence) {

    constructor(context: Context) : this(PrefsAttemptPersistence(context.applicationContext))

    fun clientOrderId(): String? = penyimpan.baca(KEY_CLIENT_ORDER_ID)

    fun orderId(): String? = penyimpan.baca(KEY_ORDER_ID)

    fun paymentUrl(): String? = penyimpan.baca(KEY_PAYMENT_URL)

    fun sidikJari(): String? = penyimpan.baca(KEY_FINGERPRINT)

    fun simpanClientOrderId(id: String) {
        penyimpan.tulis(KEY_CLIENT_ORDER_ID, id)
    }

    fun simpanOrderId(id: String) {
        penyimpan.tulis(KEY_ORDER_ID, id)
    }

    fun simpanPaymentUrl(url: String) {
        penyimpan.tulis(KEY_PAYMENT_URL, url)
    }

    fun simpanSidikJari(sidikJari: String) {
        penyimpan.tulis(KEY_FINGERPRINT, sidikJari)
    }

    /**
     * Menutup percobaan (dibayar, dibatalkan, gagal, kedaluwarsa, atau keranjang berubah).
     */
    fun selesai() {
        penyimpan.hapusSemua(listOf(KEY_CLIENT_ORDER_ID, KEY_ORDER_ID, KEY_PAYMENT_URL, KEY_FINGERPRINT))
    }

    companion object {
        private const val FILE_NAME = "suka_customer_order_attempt"
        private const val KEY_CLIENT_ORDER_ID = "client_order_id"
        private const val KEY_ORDER_ID = "order_id"
        private const val KEY_PAYMENT_URL = "payment_url"
        private const val KEY_FINGERPRINT = "cart_fingerprint"

        fun diMemori(): OrderAttemptStore = OrderAttemptStore(MemoriAttemptPersistence())
    }

    private class PrefsAttemptPersistence(context: Context) : AttemptPersistence {
        private val prefs = context.getSharedPreferences(FILE_NAME, Context.MODE_PRIVATE)
        override fun baca(kunci: String): String? = prefs.getString(kunci, null)
        override fun tulis(kunci: String, nilai: String) {
            prefs.edit().putString(kunci, nilai).apply()
        }
        override fun hapusSemua(kunci: List<String>) {
            prefs.edit().apply { kunci.forEach { remove(it) } }.apply()
        }
    }

    private class MemoriAttemptPersistence : AttemptPersistence {
        private val data = mutableMapOf<String, String>()
        override fun baca(kunci: String): String? = data[kunci]
        override fun tulis(kunci: String, nilai: String) { data[kunci] = nilai }
        override fun hapusSemua(kunci: List<String>) { kunci.forEach { data.remove(it) } }
    }
}
