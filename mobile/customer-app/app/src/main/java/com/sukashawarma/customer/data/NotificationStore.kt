package com.sukashawarma.customer.data

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class PreferensiNotifikasi(
    val statusPesanan: Boolean = true,
    val promo: Boolean = true
)

/**
 * Penyimpanan lokal untuk preferensi notifikasi dan jumlah unread badge.
 */
class NotificationStore(context: Context) {

    private val prefs = context.getSharedPreferences(FILE_NAME, Context.MODE_PRIVATE)

    private val _unreadCount = MutableStateFlow(prefs.getInt(KEY_UNREAD_COUNT, 0))
    val unreadCount: StateFlow<Int> = _unreadCount.asStateFlow()

    fun bacaPreferensi(): PreferensiNotifikasi = PreferensiNotifikasi(
        statusPesanan = prefs.getBoolean(KEY_STATUS_PESANAN, true),
        promo = prefs.getBoolean(KEY_PROMO, true)
    )

    fun simpanPreferensi(statusPesanan: Boolean, promo: Boolean) {
        prefs.edit()
            .putBoolean(KEY_STATUS_PESANAN, statusPesanan)
            .putBoolean(KEY_PROMO, promo)
            .apply()
    }

    fun setUnreadCount(count: Int) {
        val safeCount = count.coerceAtLeast(0)
        prefs.edit().putInt(KEY_UNREAD_COUNT, safeCount).apply()
        _unreadCount.value = safeCount
    }

    fun simpanFcmToken(token: String) {
        prefs.edit().putString(KEY_FCM_TOKEN, token).apply()
    }

    fun bacaFcmToken(): String? = prefs.getString(KEY_FCM_TOKEN, null)

    private companion object {
        const val FILE_NAME = "suka_customer_notifications"
        const val KEY_STATUS_PESANAN = "notify_order_status"
        const val KEY_PROMO = "notify_promotions"
        const val KEY_UNREAD_COUNT = "unread_count"
        const val KEY_FCM_TOKEN = "fcm_token"
    }
}
