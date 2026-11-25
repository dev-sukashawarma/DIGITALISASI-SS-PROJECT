package com.sukashawarma.customer

import android.content.Context
import com.sukashawarma.customer.data.CartStore
import com.sukashawarma.customer.data.OrderAttemptStore
import com.sukashawarma.customer.data.OutletStore
import com.sukashawarma.customer.data.Repository
import com.sukashawarma.customer.data.SessionStore
import com.sukashawarma.customer.data.SplashStore
import com.sukashawarma.customer.data.api.GatewayClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.SharedFlow

/**
 * Perakitan dependensi seadanya. Hidup di [SukaCustomerApp] (tingkat proses)
 * supaya satu instans `CartStore`, `NotificationStore`, dan `GatewayClient`
 * dipakai bersama di seluruh lifecycle Activity.
 */
class AppContainer(context: Context) {
    private val appContext = context.applicationContext

    /** Scope tingkat proses untuk pekerjaan yang harus tuntas walau layar ditutup (mis. batalkan draft). */
    val appScope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    val sessionStore: SessionStore by lazy { SessionStore(appContext) }
    val outletStore: OutletStore by lazy { OutletStore(appContext) }
    val lokasiPelanggan: com.sukashawarma.customer.ui.home.LokasiPelanggan by lazy {
        com.sukashawarma.customer.ui.home.LokasiPelanggan(appContext)
    }
    val cartStore: CartStore by lazy { CartStore.persisten(appContext) }
    val orderAttemptStore: OrderAttemptStore by lazy { OrderAttemptStore(appContext) }
    val splashStore: SplashStore by lazy { SplashStore(appContext) }
    val notificationStore: com.sukashawarma.customer.data.NotificationStore by lazy {
        com.sukashawarma.customer.data.NotificationStore(appContext)
    }
    private val gateway: GatewayClient by lazy { GatewayClient(sessionStore) }
    val repository: Repository by lazy { Repository(gateway) }
    val sesiHabis: SharedFlow<Unit> get() = gateway.sesiHabis
}
