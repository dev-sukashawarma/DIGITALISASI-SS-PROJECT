package com.sukashawarma.customer

import android.content.Context
import com.sukashawarma.customer.data.CartStore
import com.sukashawarma.customer.data.OutletStore
import com.sukashawarma.customer.data.Repository
import com.sukashawarma.customer.data.SessionStore
import com.sukashawarma.customer.data.api.GatewayClient

/**
 * Perakitan dependensi seadanya. Tidak memakai kerangka injeksi apa pun:
 * aplikasi ini punya satu klien HTTP dan dua penyimpanan, dan kerangka DI
 * hanya akan menambah lapisan tanpa menghapus satu pun keputusan.
 */
class AppContainer(context: Context) {
    private val appContext = context.applicationContext

    val sessionStore: SessionStore by lazy { SessionStore(appContext) }
    val outletStore: OutletStore by lazy { OutletStore(appContext) }
    val cartStore: CartStore by lazy { CartStore.persisten(appContext) }
    private val gateway: GatewayClient by lazy { GatewayClient(sessionStore) }
    val repository: Repository by lazy { Repository(gateway) }
}
