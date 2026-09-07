package com.sukashawarma.customer.data

import android.content.Context

/**
 * Percobaan pemesanan yang sedang berjalan.
 *
 * **Kenapa ini harus bertahan lintas proses.** Pembayaran membawa pelanggan
 * keluar aplikasi -- ke Custom Tabs, lalu ke aplikasi e-wallet. Android boleh
 * mematikan proses aplikasi selama itu. Kalau `client_order_id` hanya hidup di
 * memori, percobaan berikutnya memakai id baru, dan pelanggan mendapat
 * **tagihan kedua** untuk keranjang yang sama.
 *
 * Karena itu id disimpan sebelum permintaan pertama dikirim, bukan setelah
 * balasannya datang.
 */
class OrderAttemptStore(context: Context) {

    private val prefs = context.applicationContext
        .getSharedPreferences(FILE_NAME, Context.MODE_PRIVATE)

    fun clientOrderId(): String? = prefs.getString(KEY_CLIENT_ORDER_ID, null)

    fun orderId(): String? = prefs.getString(KEY_ORDER_ID, null)

    fun simpanClientOrderId(id: String) {
        prefs.edit().putString(KEY_CLIENT_ORDER_ID, id).apply()
    }

    fun simpanOrderId(id: String) {
        prefs.edit().putString(KEY_ORDER_ID, id).apply()
    }

    /**
     * URL halaman pembayaran percobaan ini.
     *
     * Disimpan supaya pelanggan bisa MEMBUKANYA LAGI setelah kembali ke
     * aplikasi. Tanpa ini, percobaan yang masih hidup hanya bisa dipantau --
     * pelanggan menatap pemuat tanpa satu pun cara membayar, sementara
     * tagihannya masih berlaku dan pesanan kedua ditolak demi mencegah
     * tagihan ganda. Jalan buntu yang sempurna.
     */
    fun paymentUrl(): String? = prefs.getString(KEY_PAYMENT_URL, null)

    fun simpanPaymentUrl(url: String) {
        prefs.edit().putString(KEY_PAYMENT_URL, url).apply()
    }

    /**
     * Menutup percobaan. Dipanggil hanya setelah pesanan benar-benar selesai
     * (dibayar, atau dibatalkan pelanggan) -- bukan saat galat, karena galat
     * justru keadaan di mana id lama harus dipertahankan.
     */
    fun selesai() {
        prefs.edit()
            .remove(KEY_CLIENT_ORDER_ID)
            .remove(KEY_ORDER_ID)
            .remove(KEY_PAYMENT_URL)
            .apply()
    }

    private companion object {
        const val FILE_NAME = "suka_customer_order_attempt"
        const val KEY_CLIENT_ORDER_ID = "client_order_id"
        const val KEY_ORDER_ID = "order_id"
        const val KEY_PAYMENT_URL = "payment_url"
    }
}
