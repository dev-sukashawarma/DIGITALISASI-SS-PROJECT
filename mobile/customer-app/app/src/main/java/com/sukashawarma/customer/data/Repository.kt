package com.sukashawarma.customer.data

import com.sukashawarma.customer.data.api.AuthResponse
import com.sukashawarma.customer.data.api.BannersResponse
import com.sukashawarma.customer.data.api.CartItemPayload
import com.sukashawarma.customer.data.api.CheckoutValidateRequest
import com.sukashawarma.customer.data.api.CheckoutValidateResponse
import com.sukashawarma.customer.data.api.ConfigDto
import com.sukashawarma.customer.data.api.CreateOrderRequest
import com.sukashawarma.customer.data.api.CreateOrderResponse
import com.sukashawarma.customer.data.api.GatewayClient
import com.sukashawarma.customer.data.api.GatewayResult
import com.sukashawarma.customer.data.api.MenuItemDto
import com.sukashawarma.customer.data.api.OrderDetailDto
import com.sukashawarma.customer.data.api.OutletDto
import com.sukashawarma.customer.data.api.SplashDto
import com.sukashawarma.customer.data.api.VoucherDto
import com.sukashawarma.customer.data.api.VouchersRequest

/**
 * Satu-satunya pintu data aplikasi. Semua layar lewat sini, dan sini hanya
 * bicara ke [GatewayClient] — tidak ada jalur lain ke database.
 *
 * `open` agar ViewModel dapat diuji di unit test JVM dengan subclass palsu.
 */
open class Repository(private val gateway: GatewayClient?) {

    open suspend fun loginGoogle(idToken: String): GatewayResult<AuthResponse> =
        gateway!!.loginGoogle(idToken)

    open suspend fun outlets(): GatewayResult<List<OutletDto>> =
        when (val hasil = gateway!!.outlets()) {
            is GatewayResult.Sukses -> GatewayResult.Sukses(hasil.data.outlets)
            is GatewayResult.Gagal -> hasil
        }

    open suspend fun banners(): GatewayResult<BannersResponse> = gateway!!.banners()

    open suspend fun splash(): GatewayResult<SplashDto> = gateway!!.splash()

    open suspend fun config(): GatewayResult<ConfigDto> = gateway!!.config()

    open suspend fun unduhGambarSplash(url: String): ByteArray? = gateway!!.unduhGambarSplash(url)

    open suspend fun katalog(outletId: String): GatewayResult<List<MenuItemDto>> =
        when (val hasil = gateway!!.catalog(outletId)) {
            is GatewayResult.Sukses -> GatewayResult.Sukses(hasil.data.items)
            is GatewayResult.Gagal -> hasil
        }

    open suspend fun validasiCheckout(
        outletId: String,
        items: List<CartItemPayload>,
        voucher: PilihanVoucher? = null
    ): GatewayResult<CheckoutValidateResponse> =
        gateway!!.checkoutValidate(
            CheckoutValidateRequest(
                outletId = outletId,
                items = items,
                voucherId = voucher?.id,
                kodeVoucher = voucher?.kode
            )
        )

    open suspend fun buatPesanan(
        clientOrderId: String,
        outletId: String,
        items: List<CartItemPayload>,
        telepon: String? = null,
        voucher: PilihanVoucher? = null
    ): GatewayResult<CreateOrderResponse> =
        gateway!!.createOrder(
            CreateOrderRequest(
                clientOrderId = clientOrderId,
                outletId = outletId,
                items = items,
                customerPhone = telepon,
                voucherId = voucher?.id,
                kodeVoucher = voucher?.kode
            )
        )

    open suspend fun vouchers(
        outletId: String? = null,
        items: List<CartItemPayload>? = null
    ): GatewayResult<List<VoucherDto>> =
        when (val hasil = gateway!!.vouchers(VouchersRequest(outletId = outletId, items = items))) {
            is GatewayResult.Sukses -> GatewayResult.Sukses(hasil.data.vouchers)
            is GatewayResult.Gagal -> hasil
        }

    open suspend fun statusPesanan(orderId: String): GatewayResult<OrderDetailDto> =
        gateway!!.orderDetail(orderId)

    open suspend fun batalkanPesanan(orderId: String): GatewayResult<Unit> =
        gateway!!.cancelOrder(orderId)

    open suspend fun riwayat(): GatewayResult<List<OrderDetailDto>> =
        when (val hasil = gateway!!.ordersList()) {
            is GatewayResult.Sukses -> GatewayResult.Sukses(hasil.data.orders)
            is GatewayResult.Gagal -> hasil
        }

    open suspend fun ambilNotifikasi(kategori: String? = null): GatewayResult<com.sukashawarma.customer.data.api.NotificationListResponse> =
        gateway!!.getNotifications(kategori)

    open suspend fun tandaiNotifikasiDibaca(notificationId: String? = null, tandaiSemua: Boolean = false): GatewayResult<Unit> =
        gateway!!.markNotificationRead(notificationId, tandaiSemua)

    open suspend fun daftarkanFcmToken(token: String, deviceInfo: String? = null): GatewayResult<Unit> =
        gateway!!.registerFcmToken(com.sukashawarma.customer.data.api.FcmTokenRequest(fcmToken = token, deviceInfo = deviceInfo))

    open suspend fun ambilPreferensiNotifikasi(): GatewayResult<com.sukashawarma.customer.data.api.NotificationPreferencesResponse> =
        gateway!!.getNotificationPreferences()

    open suspend fun simpanPreferensiNotifikasi(pesanan: Boolean? = null, promo: Boolean? = null): GatewayResult<Unit> =
        gateway!!.updateNotificationPreferences(
            com.sukashawarma.customer.data.api.UpdateNotificationPreferencesRequest(
                notifyOrderStatus = pesanan,
                notifyPromotions = promo
            )
        )

    open suspend fun profil(): GatewayResult<com.sukashawarma.customer.data.api.CustomerDto> =
        when (val h = gateway!!.profile()) {
            is GatewayResult.Sukses -> GatewayResult.Sukses(h.data.customer)
            is GatewayResult.Gagal -> h
        }

    open suspend fun simpanProfil(nama: String?, telepon: String?): GatewayResult<com.sukashawarma.customer.data.api.CustomerDto> =
        when (val h = gateway!!.updateProfile(
            com.sukashawarma.customer.data.api.UpdateProfileRequest(name = nama, phone = telepon)
        )) {
            is GatewayResult.Sukses -> GatewayResult.Sukses(h.data.customer)
            is GatewayResult.Gagal -> h
        }

    open suspend fun hapusAkun(): GatewayResult<Unit> = gateway!!.deleteAccount()
}
