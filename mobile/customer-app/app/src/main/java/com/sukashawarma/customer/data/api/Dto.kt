package com.sukashawarma.customer.data.api

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// Bentuk balasan gateway dicerminkan PERSIS dari
// apps/retail-gateway/src/app/api/v1/**/route.ts — jangan mengarang nama
// field. `pickup_code` sengaja TIDAK ADA di sini: dibuang dari seluruh
// balasan gateway, pesanan sekarang memakai `pos_order_number`.

@Serializable
data class GoogleAuthRequest(
    @SerialName("id_token") val idToken: String
)

@Serializable
data class CustomerDto(
    val id: String,
    val name: String? = null,
    val email: String? = null,
    val phone: String? = null
)

@Serializable
data class AuthResponse(
    val token: String,
    @SerialName("expires_at") val expiresAt: String,
    val customer: CustomerDto
)

@Serializable
data class OutletDto(
    val id: String,
    val name: String,
    val address: String? = null,
    val lat: Double? = null,
    val lng: Double? = null,
    @SerialName("is_active") val isActive: Boolean
)

@Serializable
data class OutletsResponse(
    val outlets: List<OutletDto>
)

@Serializable
data class MenuItemDto(
    val id: String,
    val name: String,
    val description: String? = null,
    val price: Double,
    @SerialName("image_url") val imageUrl: String? = null,
    @SerialName("is_available") val isAvailable: Boolean,
    @SerialName("category_id") val categoryId: String? = null,
    @SerialName("sort_order") val sortOrder: Int? = null,
    // Nama kategori dikirim gateway sejak commit "kirim nama kategori bersama
    // katalog". Default null supaya aplikasi versi ini tetap jalan melawan
    // gateway yang belum di-redeploy: judul kelompok hilang, menu tetap tampil.
    @SerialName("category_name") val categoryName: String? = null,
    @SerialName("category_sort_order") val categorySortOrder: Int? = null
)

@Serializable
data class CatalogResponse(
    val items: List<MenuItemDto>
)

@Serializable
data class CartItemPayload(
    @SerialName("menu_item_id") val menuItemId: String,
    val name: String,
    @SerialName("unit_price") val unitPrice: Double,
    val quantity: Int,
    val note: String? = null
)

@Serializable
data class CheckoutValidateRequest(
    @SerialName("outlet_id") val outletId: String,
    val items: List<CartItemPayload>
)

/**
 * `discountAmount` sengaja camelCase — checkout/validate tidak konsisten
 * dengan endpoint lain (snake_case). Ketidakseragaman nyata di gateway,
 * dicerminkan apa adanya, bukan "diperbaiki" di sisi Android.
 */
@Serializable
data class CartProblemDto(
    @SerialName("menu_item_id") val menuItemId: String,
    val name: String,
    val jenis: String,
    @SerialName("harga_baru") val hargaBaru: Double? = null
)

@Serializable
data class CheckoutValidateResponse(
    val ok: Boolean,
    val subtotal: Double? = null,
    val discountAmount: Double? = null,
    val total: Double? = null,
    val alasan: String? = null,
    val pesan: String? = null,
    val masalah: List<CartProblemDto>? = null
)

@Serializable
data class CreateOrderRequest(
    @SerialName("client_order_id") val clientOrderId: String,
    @SerialName("outlet_id") val outletId: String,
    val items: List<CartItemPayload>,
    @SerialName("customer_phone") val customerPhone: String? = null
)

@Serializable
data class CreateOrderResponse(
    @SerialName("order_id") val orderId: String,
    @SerialName("payment_url") val paymentUrl: String? = null,
    @SerialName("total_amount") val totalAmount: Double,
    @SerialName("expires_at") val expiresAt: String,
    val duplicate: Boolean? = null
)

@Serializable
data class OrderDetailDto(
    val id: String,
    val status: String,
    @SerialName("status_dapur") val statusDapur: String? = null,
    @SerialName("total_amount") val totalAmount: Double,
    // `Int`, bukan `String`. Kolomnya `pos_order_number int` di
    // retail.order_drafts, dan gateway meneruskannya apa adanya sebagai angka
    // JSON. Dideklarasikan String, kotlinx-serialization melempar saat
    // menguraikannya -- dan karena pengurai dipanggil di dalam try/catch klien,
    // kegagalannya menyamar jadi "galat jaringan". Layar status dan riwayat
    // akan SELALU gagal, dengan pesan yang menuduh koneksi pelanggan.
    @SerialName("pos_order_number") val posOrderNumber: Int? = null,
    @SerialName("outlet_name") val outletName: String? = null,
    @SerialName("created_at") val createdAt: String
)

@Serializable
data class OrdersListResponse(
    val orders: List<OrderDetailDto>
)
